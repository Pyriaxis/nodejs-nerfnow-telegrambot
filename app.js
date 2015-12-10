/**
 * Created by roger on 3/12/15.
 */

var TeleBot = require('telebot');
var http = require('http');
var Promise = require('bluebird');


var bot = new TeleBot({
    token: '<YOUR API TOKEN>',
    sleep: 1000, // How often check updates (in ms)
    timeout: 0, // Update pulling timeout (0 - short polling)
    limit: 100, // Limits the number of updates to be retrieved
});

var latest = 1704;
var subscribers = [];

var options = {
    host: 'www.nerfnow.com',
    path: '/comic/1704'
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

            for (var i = 0; i < subscribers.length; i++) {
                bot.sendMessage(subscribers[i], "#"+ latest.toString());
                bot.sendPhoto(subscribers[i], img);
            }
        } else
        {
            console.log('no new update');
        }
    }).catch(function(err){
        console.log(err);
       console.log("Promise Error");
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
            console.log("oops");
        });

    }).end();
}

bot.on('/start', function(msg) {
    console.log(msg);
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
        var index = subscribers.indexOf(id);
        if (index === -1) {
            subscribers.push(id);
            return bot.sendMessage(id, 'You have been subscribed to Nerfnow Updates!');
        } else {
            return bot.sendMessage(id, 'You are already subscribed!');
        }
    }
    else {
        if (index === -1) {
            subscribers.push(chatId);
            return bot.sendMessage(chatId, chatTitle + " has been subscribed to Nerfnow Updates!");
        } else {
            return bot.sendMessage(chatId, chatTitle + " is already subscribed!");
        }
    }
});

bot.on('/unsubscribe', function(msg) {
    var id = msg.from.id;
    var chatId = msg.chat.id;
    var chatTitle = msg.chat.title || "";
    if (!chatTitle) {
        var index = subscribers.indexOf(id);
        if (index !== -1) {
            subscribers.splice(index, 1);
            return bot.sendMessage(id, 'You have been unsubscribed from Nerfnow Updates.');
        } else{
            return bot.sendMessage(id, 'You weren\'t even subscribed in the first place!');
        }
    }
    else {
        var index = subscribers.indexOf(chatId);
        if (index !== -1) {
            subscribers.splice(index, 1);
            return bot.sendMessage(chatId, chatTitle + " has been subscribed from Nerfnow Updates.");
        } else{
            return bot.sendMessage(chatId, chatTitle + ' wasn\'t even subscribed in the first place!');
        }
    }
});

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