const TeleBot = require('telebot');
const http = require('http');
const https = require('https');
const Promise = require('bluebird');

var monk = require('monk');

const db = monk(process.env.MONGODB_HOST + ':' + process.env.MONGODB_PORT + '/' + process.env.MONGODB_DATABASE)
//const db = monk('localhost:27017/webcomicDB');
const subscribers = db.get("subscribers");
const comicnums = db.get("comicnums");

const bot = new TeleBot({
    token: '@to be filled',
    pooling: { // Optional. Use pooling.
        interval: 1000, // Optional. How often check updates (in ms).
        timeout: 0, // Optional. Update pulling timeout (0 - short polling).
        limit: 100, // Optional. Limits the number of updates to be retrieved.
        retryTimeout: 5000 // Optional. Reconnecting timeout (in ms).
    }
});

const repos = {
    nerfnow:{
        host: 'www.nerfnow.com',
        subpath: '/comic/',
        latestpath: '',
        id: '',
        numbered: true,
        https: false,
        fullname: 'NerfNow!'
    },
    cnh:{
        host: 'explosm.net',
        subpath: '/comics/',
        latestpath: '/comics/latest',
        id: '',
        numbered: true,
        https: false,
        fullname: 'Cyanide and Happiness'
    },
    pennyarcade:{
        host: 'www.penny-arcade.com',
        subpath: '/comic/',
        latestpath: '/comic',
        id: '',
        numbered: false,
        https: true,
        fullname: 'Penny Arcade (Unnumbered)'
    },
    bizarro:{
        host: 'bizarro.com',
        subpath: '',
        latestpath: '',
        id: '',
        numbered: false,
        https: false,
        fullname: 'Bizarro (Unnumbered)'
    },
    dilbert:{
        host: 'dilbert.com',
        subpath: '',
        latestpath: '',
        id: '',
        numbered: false,
        https: false,
        fullname: 'Dilbert (Unnumbered)'
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
                comicnums.insert({name: key, id: '1'});
            }
        })
    }
}

var CronJob = require('cron').CronJob;

new CronJob('0 0 9 * * *', function() {
    console.log("Cron Update Fired!");
    updateAndSend();
},null,true,'Asia/Singapore');

function updateAndSend(){
    var count = 0;
    for (var key in repos) {
        let comic = key;
        count++;
        setTimeout(function(){
            if (repos.hasOwnProperty(comic)) {
                comicnums.findOne({name: comic}).then((doc)=>{
                    var scopeComic = comic;
                    fetchHTML({host: repos[scopeComic].host, path: repos[scopeComic].latestpath, key: scopeComic, https: repos[scopeComic].https})
                        .then(function(html){
                            var comicId = numGetter(scopeComic, html);

                            if (comicId !== doc.id){
                                //update
                                var comicUrl = imgGetter(scopeComic, html);
                                comicnums.findOneAndUpdate({name: scopeComic}, {$set: {id: comicId}});
                                repos[scopeComic].id = comicId;

                                console.log(scopeComic);

                                subscribers.findOne({key: scopeComic}).then((docs) => {

                                    for (var i = 0; i < docs.subscribers.length; i++){
                                        bot.sendMessage(docs.subscribers[i], '#' + repos[scopeComic].id);
                                        bot.sendPhoto(docs.subscribers[i], comicUrl);
                                    }
                                });
                            } else {
                                //nope
                                console.log('no new update for ' + comic);
                            }
                        });
                });
            }
        }, 4000 * count);
    }
}

//options.host, options.path, options.key, options.https,
function fetchHTML(options){
    var str = '';

    console.log(options);

    return new Promise(function(resolve,reject){
        if (options.https){
            https.request('https://' + options.host + options.path,function(response) {

                response.on('data', function (chunk) {
                    str += chunk;
                });
                response.on('end', function () {
                    resolve(str);
                });

                response.on('error', function(){
                    console.log("Request Error, most likely 404");
                    reject('fetch html error');
                });
            }).end();
        } else {
            http.request('http://' + options.host + options.path,function(response) {

                response.on('data', function (chunk) {
                    str += chunk;
                });
                response.on('end', function () {
                    resolve(str);
                });

                response.on('error', function(){
                    console.log("Request Error, most likely 404");
                    reject('fetch html error');
                });
            }).end();
        }
    });
};

//Fetches the actual comic img URL from the HTML.
function imgGetter(hostname, html){
    switch (hostname){
        case 'nerfnow':
            return html.split("<div id=\"comic\">")[1].split("src=\"")[1].split("\"")[0];
            break;
        case 'cnh':
            return html.split("<img id=\"main-comic\" ")[1].split("src=\"//")[1].split("\"")[0];
            break;
        case 'pennyarcade':
            return html.split('"comicFrame"><img src="')[1].split('"')[0];
            break;
        case 'bizarro':
            return html.split("<!--  the comic panel -->")[1].split('<img src="')[1].split('"')[0];
            break;
        case 'dilbert':
            return html.split('img-comic-container">')[1].split('src="')[1].split('"')[0];
            break;
        default:
            throw new Error('Unable to get Image URL');
    }
};

//Fetches some comic ID from the HTML
function numGetter(hostname, html){
    switch (hostname){
        case 'nerfnow':
            return html.split("<div id=\"comic\">")[1].split(".com/img/")[1].split("/")[0];
            break;
        case 'cnh':
            return html.split("<meta property=\"og:url\" content=\"http://explosm.net/comics/")[1].split("/")[0];
            break;
        case 'pennyarcade':
            return html.split('"comicFrame"><img src="')[1].split('" alt="')[1].split('"')[0];
            break;
        case 'bizarro':
            return html.split('"comic-date">')[1].split('</div>')[0].trim();
            break;
        case 'dilbert':
            return html.split('img-comic-container">')[1].split('data-id="')[1].split('"')[0];
            break;
        default:
            throw new Error('Unable to get Comic ID');
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

/************************************
 *         BOT COMMANDS
 ************************************/


bot.on('/start', function(msg) {

    var chatId = msg.chat.id;

    return bot.sendMessage(chatId, 'Hi there! I\'m the WebComic bot! ' +
        'I serve you various Webcomic updates, or you can request them directly through me!' +
        '\n\nYou can interact with me by sending me these commands:' +
        '\n\n/help - Display this message.' +
        '\n/list - Display a list of supported webcomics.' +
        '\n/latest comic - Grab the latest in the specified comic.' +
        '\n/grab comic #number - Grab the specified comic number from a numbered series.' +
        '\n/subscribe comic - Subscribe this chat to automated updates!' +
        '\n/unsubscribe comic - Unsubscribe this chat from automated updates.');
});

bot.on('/subscribe', function(msg) {
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
    var chatId = msg.chat.id;
    var chatTitle = msg.chat.title || "";

    var comicname = msg.text.split('/unsubscribe ')[1];
    if (repos.hasOwnProperty(comicname)){
        return unsubscribe(chatId, chatTitle, comicname)
    } else {
        return bot.sendMessage(chatId, 'Sorry, you have specified an invalid webcomic. Use /list to see a list of supported webcomics.');
    }
});

bot.on('/debug', function(msg){

    console.log(msg);
    chatId = msg.chat.id;
    return bot.sendMessage(chatId, "Debug: ID of chat = " + chatId.toString());

})

bot.on('/help', function(msg){

    var chatId = msg.chat.id;

    return bot.sendMessage(chatId, 'Hi there! I\'m the WebComic bot! ' +
        'I serve you various Webcomic updates, or you can request them directly through me!' +
        '\n\nYou can interact with me by sending me these commands:' +
        '\n\n/help - Display this message.' +
        '\n/list - Display a list of supported webcomics.' +
        '\n/latest !comic - Grab the latest in the specified comic.' +
        '\n/grab !comic #number - Grab the specified comic number from a numbered series.' +
        '\n/subscribe !comic - Subscribe this chat to automated updates!' +
        '\n/unsubscribe !comic - Unsubscribe this chat from automated updates.');
});

bot.on('/list', function(msg){
    var retstr = "Here's a list of currently supported comics:\n\n";
    console.log(repos);
    for (var key in repos){
        if (repos.hasOwnProperty(key)){
            retstr += key + ' - ' + repos[key].fullname + '\n';
        };
    }
    return bot.sendMessage(msg.chat.id, retstr);
});

bot.on('/grab', function(msg){
    try {
        var textArr = msg.text.split(' ');
        var key = textArr[1];

        if (!repos.hasOwnProperty(key) || !repos[key].numbered){
            return bot.sendMessage(msg.chat.id, 'Sorry, the comic ' + key + ' is either not supported or unnumbered. Please use /list to get a list of supported comics.');
        }

        var number = textArr[2];

        fetchHTML({host: repos[key].host, path: repos[key].subpath + number, key: key, https: repos[key].https})
        .then(function(html){
            var comicId = numGetter(key, html);
            var comicImg = imgGetter(key, html);
            bot.sendMessage(msg.chat.id, '#' + comicId);
            bot.sendPhoto(msg.chat.id, comicImg);

        });
    } catch (err){
        console.log(err);
        return bot.sendMessage(msg.chat.id, 'Eto.. an error occurred processing your command.. Maybe the comic has not been released yet?');
    }
});

bot.on('/latest', function(msg){
    try {
        var textArr = msg.text.split(' ');
        var key = textArr[1];

        if (!repos.hasOwnProperty(key)){
            return bot.sendMessage(msg.chat.id, 'Sorry, the comic ' + key + ' is not supported. Please use /list to get a list of supported comics.');
        }

        fetchHTML({host: repos[key].host, path: repos[key].latestpath, key: key, https: repos[key].https})
        .then(function(html){
            var comicId = numGetter(key, html);
            var comicImg = imgGetter(key, html);
            bot.sendMessage(msg.chat.id, '#' + comicId);
            bot.sendPhoto(msg.chat.id, comicImg);
        });

    } catch (err){
        return bot.sendMessage(msg.chat.id, 'Eto.. an error occurred processing your command.. Mayhap check your syntax?');
    }
});

bot.on('/fireCron', function(msg){
    updateAndSend();
})

bot.on('/update', function(msg){
    Object.keys(repos).forEach(function(key,index){
        console.log(key);

        comicnums.findOne({name: key}).then((doc)=>{
            fetchHTML({host: repos[key].host, path: repos[key].latestpath, key: key, https: repos[key].https})
                .then(function(html){
                    var comicId = numGetter(key, html);
                    comicnums.findOneAndUpdate({name: key}, {$set: {id: comicId}});
                    bot.sendMessage(msg.chat.id, 'Webcomic ' + key + ' has been updated to #' + comicId + '.');
                });
        });
    });
});

bot.connect();