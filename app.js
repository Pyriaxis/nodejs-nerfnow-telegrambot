const TeleBot = require('telebot');
const Twitter = require('twitter');

const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const bot = new TeleBot({
    token: '@tobefilled',
    pooling: { // Optional. Use pooling.
        interval: 1000, // Optional. How often check updates (in ms).
        timeout: 0, // Optional. Update pulling timeout (0 - short polling).
        limit: 100, // Optional. Limits the number of updates to be retrieved.
        retryTimeout: 5000 // Optional. Reconnecting timeout (in ms).
    }
});

const client = new Twitter({
    consumer_key: '@tobefilled',
    consumer_secret: '@tobefilled',
    access_token_key: '@tobefilled',
    access_token_secret: '@tobefilled',
})

var CronJob = require('cron').CronJob;

new CronJob('0 55 8 * * 1', function() {
    console.log("Cron Update Fired!");
    searchAndSend();
},null,true,'Asia/Singapore');

function searchAndSend(){
    console.log('Search and Send!');
    client.get('search/tweets', {q: '月曜日のたわわ from:Strangestone to:Strangestone'})
    .then(function(response){

        var subscribers = fs.readFileSync(path.join(__dirname + '/tawawa', 'subscribers'), 'utf8').split([' ']);
        for (var i = 0; i < subscribers.length - 1; i++){
            bot.sendMessage(subscribers[i], response.statuses[0].text);
        }
    });
}

function subscribe(cid, chattitle){
    var subscribers = fs.readFileSync(path.join(__dirname + '/tawawa', 'subscribers'), 'utf8').split([' ']);
    console.log(subscribers);
    console.log(cid.toString());

    if (subscribers.indexOf(cid.toString()) == -1){
        fs.appendFileSync(path.join(__dirname + '/tawawa', 'subscribers'), cid + ' ');
        if (chattitle === "")
        {
            return bot.sendMessage(cid, 'You have successfully subscribed to Getsuyoubi no Tawawa');
        }
        else {
            return bot.sendMessage(cid, chattitle + " has been subscribed to Getsuyoubi no Tawawa");
        }
    } else {
        return bot.sendMessage(cid, 'Already subscribed.');
    }
}

// function unsubscribe(cid, chattitle){
//     subscribers.findOneAndUpdate({key: comicname},{$pull: {subscribers: cid}}, {upsert: true}, function(err,doc){
//         if (err) {
//             console.log(err);
//             return bot.sendMessage(cid, 'DB Error!');
//         } else {
//             if (chattitle === "")
//             {
//                 return bot.sendMessage(cid, 'You have successfully unsubscribed from the webcomic ' + comicname +'!');
//             }
//             else{
//                 return bot.sendMessage(cid, chattitle + " has been unsubscribed from the webcomic " + comicname + '!');
//             }
//         }
//     });
// }

/************************************
 *         BOT COMMANDS
 ************************************/


bot.on('/start', function(msg) {

    var chatId = msg.chat.id;

    return bot.sendMessage(chatId, 'Hi there! I\'m the WebComic bot (Tawawa Branch)! ' +
        'I deliver weekly editions of Getsuyoubi no Tawawa automatically!' +
        '\n\nYou can interact with me by sending me these commands:' +
        '\n\n/help - Display this message.' +
        '\n/latest comic - Get the latest Tawawa comic.' +
        '\n/subscribe - Get an automated update every Monday!')
});

bot.on('/subscribe', function(msg) {
    var chatId = msg.chat.id;
    var chatTitle = msg.chat.title || "";

    return subscribe(chatId, chatTitle)
});

// bot.on('/unsubscribe', function(msg) {
//     var chatId = msg.chat.id;
//     var chatTitle = msg.chat.title || "";
//
//     var comicname = msg.text.split('/unsubscribe ')[1];
//     if (repos.hasOwnProperty(comicname)){
//         return unsubscribe(chatId, chatTitle, comicname)
//     } else {
//         return bot.sendMessage(chatId, 'Sorry, you have specified an invalid webcomic. Use /list to see a list of supported webcomics.');
//     }
// });

bot.on('/debug', function(msg){

    console.log(msg);
    var chatId = msg.chat.id;
    return bot.sendMessage(chatId, "Debug: ID of chat = " + chatId.toString());

})

bot.on('/help', function(msg){

    var chatId = msg.chat.id;

    return bot.sendMessage(chatId, 'Hi there! I\'m the WebComic bot (Tawawa Branch)! ' +
        'I deliver weekly editions of Getsuyoubi no Tawawa automatically!' +
        '\n\nYou can interact with me by sending me these commands:' +
        '\n\n/help - Display this message.' +
        '\n/latest comic - Get the latest Tawawa comic.' +
        '\n/subscribe - Get an automated update every Monday!')
});

bot.on('/latest', function(msg){

    client.get('search/tweets', {q: '月曜日のたわわ from:Strangestone to:Strangestone'})
    .then(function(response){
        bot.sendMessage(msg.chat.id, response.statuses[0].text);
        //bot.sendPhoto(msg.chat.id, response.statuses[0].entities.media[0].media_url);
    });
});

bot.on('/broadcast', function(msg){
    searchAndSend();
});

bot.connect();