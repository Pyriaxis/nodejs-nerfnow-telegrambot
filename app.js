/**
 * Created by roger on 3/12/15.
 */

var TeleBot = require('telebot');
var http = require('http');
var Promise = require('bluebird');
var winston = require('winston');

var monk = require('monk');

var db = monk('localhost:27017/nerfnow')
var subscribers = db.get("subscribers");

var bot = new TeleBot({
    token: 'APIKEYHERE',
    sleep: 1000, // How often check updates (in ms)
    timeout: 0, // Update pulling timeout (0 - short polling)
    limit: 100, // Limits the number of updates to be retrieved
});

var logger = new winston.Logger({
    transports: [
        new winston.transports.File({
            filename: 'errorlog.log',
            handleExceptions: true,
            humanReadableUhandledException: true
        })
    ],
    exitOnError: false
});

var latest = 1705;

var options = {
    host: 'www.nerfnow.com',
    path: '/comic/1705'
};

function checkUpdate(options){
    return new Promise(function(resolve,reject){
        var str = ''

        http.request(options,function(response) {

            response.on('data', function (chunk) {
                str += chunk;
            });
            response.on('end', function () {
                resolve(str);
            });

            response.on('error', function(){
                logger.log('error', 'Check Update error');
                console.log("oops");
                reject(str);
            });
        }).end();
    });
};

var CronJob = require('cron').CronJob;

new CronJob('0 0 9 * * *', function() {
    console.log("Cron Update Fired!");

    var strUpdate = '';

    checkUpdate({host: 'www.nerfnow.com', path: '/comic/' + (latest+1).toString()}).then(function (data)
    {
        strUpdate = data;
        console.log(strUpdate.length);

        if (strUpdate.length > 10) {
            latest += 1;
            var img = strUpdate.split("<div id=\"comic\">")[1].split("src=\"")[1].split("\"")[0];

            var sendlist = subscribers.find({}, function(err,docs){
                if (err){
                    logger.log('error', err)
                    console.log(err);
                }

                console.log(docs.length);
                for (var count = 0; count < docs.length; count++){
                    bot.sendMessage(docs[count].chatid, "#"+ latest);
                    bot.sendPhoto(docs[count].chatid, img);
                }
            });

        } else
        {
            logger.log('info', 'No new update.');
            console.log('no new update');
        }
    }).catch(function(err){
        logger.log('err', err);
        console.log(err);
    });

},null,true,'Asia/Singapore');

function getPic(mID, number, auto){
    options.path = '/comic/' + number;


    var picurl = http.request(options,function(response) {
        var str = '';
        response.on('data', function (chunk) {
            str += chunk;
        });

        response.on('end', function () {
            try {
                var img = str.split("<div id=\"comic\">")[1].split("src=\"")[1].split("\"")[0];
                console.log(img);
                bot.sendMessage(mID, "#"+ number)
                bot.sendPhoto(mID, img);
            } catch (e)
            {
                console.log(e);
                console.log(latest);
                if (!auto) {bot.sendMessage(mID, "Error with grabbing desired comic. Please check input.");}
            }
        });

        response.on('error', function(){
            logger.log("error", "getPic error.");
            console.log("oops");
        });

    }).end();
}

function subscribe(cid, chattitle){
    subscribers.findOne({chatid: cid}, function(err,doc){
        if (err) {
            console.log(err);
            return bot.sendMessage(cid, 'DB Error!');
        } else if (doc === null){
            subscribers.insert({chatid: cid},
                function (err,doc){
                    if (err) {
                        console.log(err)
                        return bot.sendMessage(cid, "Subscribe Error!")}
                    else {

                        if (chattitle === "")
                        {
                            return bot.sendMessage(cid, 'You have successfully subscribed to Nerfnow Updates!!');
                        }
                        else{
                            return bot.sendMessage(cid, chattitle + " has been subscribed to Nerfnow Updates!");
                        }
                    }
                });
        } else {
            if (chattitle === "") {
                return bot.sendMessage(cid, "You are already subscribed!");
            } else {
                return bot.sendMessage(cid, chattitle + " is already subscribed!")
            }
        }
    });
}

function unsubscribe(cid, chattitle){
    subscribers.findOne({chatid: cid}, function(err,doc){
        if (err) {
            console.log(err);
            return bot.sendMessage(cid, 'DB Error!');
        } else if (doc !== null){
            subscribers.remove({chatid: cid},
                function (err,doc){
                    if (err) {
                        console.log(err)
                        return bot.sendMessage(cid, "Unsubscribe Error!")}
                    else {

                        if (chattitle === "")
                        {
                            return bot.sendMessage(cid, 'You have successfully unsubscribed from Nerfnow Updates!!');
                        }
                        else{
                            return bot.sendMessage(cid, chattitle + " has been unsubscribed from Nerfnow Updates!");
                        }
                    }
                });
        } else {
            if (chattitle === "") {
                return bot.sendMessage(cid, "You weren't subscribed to begin with!");
            } else {
                return bot.sendMessage(cid, chattitle + " wasn't subscribed to begin with!")
            }
        }
    });
}


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
    if (!chatTitle) {
        subscribe(id,"");
    }
    else {
        subscribe(chatId,chatTitle);
    }
});

bot.on('/unsubscribe', function(msg) {
    var id = msg.from.id;
    var chatId = msg.chat.id;
    var chatTitle = msg.chat.title || "";
    if (!chatTitle) {
        unsubscribe(id, "");
    }
    else {
        unsubscribe(chatId, chatTitle);
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
bot.on('/latest', function(msg){

    var input = latest.toString();
    var chatId = msg.chat.id;

    getPic(chatId, input, false);
})

bot.on('/grab', function(msg){
    var input = this.cmd[1] || (latest).toString();

    var chatId = msg.chat.id;

    getPic(chatId, input, false);
})

bot.connect();