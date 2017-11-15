# nodejs-nerfnow-telegrambot
Telegram bot in NodeJS to serve nerf now comics.

Simple Bot written in NodeJS with Telebot to scrape Strangestone's Tweets and get the latest Getsuyoubi no Tawawa.

To use, build the image with Docker.

`docker build . -t tawawa`

Then run it with docker, mounting a directory with an empty subscribers file in it.

```
mkdir /home/ubuntu/tawawa
touch /home/ubuntu/tawawa/subscribers
docker run -d --name tawawa --volume=/home/ubuntu/tawawa:/usr/src/app/tawawa: tawawa
```
