const TeleBot = require('telebot');
const http = require('http');
const Promise = require('bluebird');

var monk = require('monk');

//const db = monk(process.env.MONGODB_HOST + ':' + process.env.MONGODB_PORT + '/' + process.env.MONGODB_DATABASE)
const db = monk('localhost:27017/webcomicDB');
const subscribers = db.get("subscribers");
const comicnums = db.get("comicnums");

const bot = new TeleBot({
    token: '165690867:AAF-6Gvt2yWe0MCm3SEJVl7pW_4iOL5_Msc',
    pooling: { // Optional. Use pooling.
        interval: 1000, // Optional. How often check updates (in ms).
        timeout: 0, // Optional. Update pulling timeout (0 - short polling).
        limit: 100, // Optional. Limits the number of updates to be retrieved.
        retryTimeout: 5000 // Optional. Reconnecting timeout (in ms).
    }
});

var repos = {
    nerfnow:{
        host: 'www.nerfnow.com',
        subpath: '/comic/',
        latestpath: '',
        id: ''
    },
    cnh:{
        host: 'explosm.net',
        subpath: '/comics/',
        latestpath: '/comics/latest',
        id: ''
    }
};

//init db numbers if not
for (var key in repos) {
    initDBNumbers(key);
}

function initDBNumbers(key){
    if (repos.hasOwnProperty(key)) {
        comicnums.findOne({name: key}).then((doc) =>{
            console.log(doc);
            if (doc){
                repos[key].id = doc.id;
            } else {
                comicnums.insert({name: key, id: 1});
            }
        })
    }
}

var CronJob = require('cron').CronJob;

new CronJob('0 0 9 * * *', function() {
    console.log("Cron Update Fired!");

    for (var key in repos) {
        if (repos.hasOwnProperty(key)) {
            var update = fetchImg({host: repos[key].host, path: repos[key].subpath + (repos[key].id +1).toString(), key: key})
            if (update)
            {
                comicnums.findOneAndUpdate({name: key}, {$set: {id: repos[key].id + 1}});
                repos[key].id++;
                subscribers.find({key: key}, (err,docs)=> {
                    for (var i = 0; i < docs.subscribers.length; i++){
                        bot.sendMessage(docs.subscribers[i], '#' + repos[key].id);
                        bot.sendPhoto(docs.subscribers[i], update);
                    }
                })
            } else {
                console.log('no new update for ' + key);
            }
        }
    }
},null,true,'Asia/Singapore');

//options.host, options.path, options.key
function fetchImg(options){
    return fetchHTML(options).then(data => {
        var strUpdate = data;

        if (strUpdate.length > 10){
            var img = imgGetter(options.key, strUpdate);
            return img;
        }
    }).catch((err)=>{
        console.log('no new update');
        return false;
    })
}

function fetchImgNumber(options){
    return fetchHTML(options).then(data => {
        var strUpdate = data;

        var num = numGetter(options.key, strUpdate);
        return num;

    }).catch((err)=>{
        console.log('something gone wrong');
        return false;
    })
}

function fetchHTML(options){
    return new Promise(function(resolve,reject){
        var str = ''

        http.request('http://' + options.host + options.path,function(response) {

            response.on('data', function (chunk) {
                str += chunk;
            });
            response.on('end', function () {
                resolve(str);
            });

            response.on('error', function(){
                console.log("Request Error, most likely 404");
                reject(str);
            });
        }).end();
    });
};

function imgGetter(hostname, html){
    switch (hostname){
        case 'nerfnow':
            return html.split("<div id=\"comic\">")[1].split("src=\"")[1].split("\"")[0];
            break;
        case 'cnh':
            return html.split("<img id=\"main-comic\" ")[1].split("src=\"//")[1].split("\"")[0];
            break;
        default:
            return;
    }
};

function numGetter(hostname, html){
    switch (hostname){
        case 'nerfnow':
            return html.split("<div id=\"comic\">")[1].split(".com/img/")[1].split("/")[0];
            break;
        case 'cnh':
            return html.split("<meta property=\"og:url\" content=\"http://explosm.net/comics/")[1].split("/")[0];
            break;
        default:
            return;
    }
}

function subscribe(cid, chattitle, comicname){
    subscribers.findOneAndUpdate({key: comicname},{$addToSet: {subscribers: cid}},{upsert: true}, function(err,doc){
        if (err) {
            console.log(err);
            return bot.sendMessage(cid, 'DB Error!');
        } else {
            if (chattitle === "")
            {
                return bot.sendMessage(cid, 'You have successfully subscribed to the webcomic ' + comicname + '!');
            }
            else {
                return bot.sendMessage(cid, chattitle + " has been subscribed to the webcomic " + comicname + '!');
            }
        }
    });
}

function unsubscribe(cid, chattitle, comicname){
    subscribers.findOneAndUpdate({key: comicname},{$pull: {subscribers: cid}}, {upsert: true}, function(err,doc){
        if (err) {
            console.log(err);
            return bot.sendMessage(cid, 'DB Error!');
        } else {
            if (chattitle === "")
            {
                return bot.sendMessage(cid, 'You have successfully unsubscribed from the webcomic ' + comicname +'!');
            }
            else{
                return bot.sendMessage(cid, chattitle + " has been unsubscribed from the webcomic " + comicname + '!');
            }
        }
    });
}

/**
 * BOT COMMANDS
 */


bot.on('/start', function(msg) {

    var id = msg.from.id;
    var mId = msg.message_id;
    var chatId = msg.chat.id;
    var chatTitle = msg.chat.title || "";
    var firstName = msg.from.first_name;
    var lastName = msg.from.last_name || "";
    if (!chatTitle){
        return bot.sendMessage(id, 'Welcome, ' + firstName + ' ' + lastName+ '!', { reply: mId });}
    else {
        return bot.sendMessage(chatId, 'Welcome, ' + firstName + ' ' + lastName + '! This is a debug message.', {reply: mId});
    }
});

bot.on('/subscribe', function(msg) {
    var id = msg.from.id;
    var chatId = msg.chat.id;
    var chatTitle = msg.chat.title || "";

    var comicname = msg.text.split('/subscribe ')[1];
    if (repos.hasOwnProperty(comicname)){
        return subscribe(chatId, chatTitle, comicname)
    } else {
        return bot.sendMessage(chatId, 'Sorry, you have specified an invalid webcomic. Use /list to see a list of supported websites.');
    }
});

bot.on('/unsubscribe', function(msg) {
    var id = msg.from.id;
    var chatId = msg.chat.id;
    var chatTitle = msg.chat.title || "";

    var comicname = msg.text.split('/unsubscribe ')[1]
    if (repos.hasOwnProperty(comicname)){
        return unsubscribe(chatId, chatTitle, comicname)
    } else {
        return bot.sendMessage(chatId, 'Sorry, you have specified an invalid webcomic. Use /list to see a list of supported webcomics.');
    }
});

bot.on('/debug', function(msg){

    console.log(msg);
    chatId = msg.chat.id;
    logger.log('info', msg);
    return bot.sendMessage(chatId, "Debug: ID of chat = " + chatId.toString());

})

bot.on('/help', function(msg){

    var chatId = msg.chat.id;

    return bot.sendMessage(chatId, 'Hi there! I\'m the NerfNow bot! ' +
        'I serve you NerfNow comic updates, or you can request them directly through me!' +
        '\n\nYou can interact with me by sending me these commands:' +
        '\n\n/help - Display this message' +
        '\n/latest - Grab the latest comic' +
        '\n/grab #number - Grab the specified comic, or the latest if blank' +
        '\n/subscribe - Subscribe this chat to automated updates!' +
        '\n/unsubscribe - Unsubscribe this chat from automated updates.');
});

// bot.on('/latest', function(msg){
//
//     var input = latest.toString();
//     var chatId = msg.chat.id;
//
//     getPic(chatId, input, false);
// });

bot.on('/update', function(msg){

    console.log(msg);

    for (var key in repos) {
        if (repos.hasOwnProperty(key)) {
            fetchImgNumber({host: repos[key].host, path: repos[key].latestpath, key: key})
            .then((update) => {
                if (update){
                    comicnums.findOneAndUpdate({name: key}, {$set: {id: update}});
                    repos[key].id = update;
                    bot.sendMessage(msg.chat.id, 'Webcomic ' + key + ' has been updated to #' + update + '.');
                } else {
                    bot.sendMessage(msg.chat.id, 'Webcomic ' + key + ' has no new updates.');
                }
            });
        }
    }
});

// bot.on('/grab', function(msg){
//     var input = this.cmd[1] || (latest).toString();
//
//     var chatId = msg.chat.id;
//
//     getPic(chatId, input, false);
// });

bot.connect();