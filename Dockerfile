FROM node:boron

RUN mkdir -p /usr/src/app

COPY package.json /usr/src/app

WORKDIR /usr/src/app

COPY lib/ /usr/src/app/lib
COPY logs /usr/src/app/logs

RUN rm -rf /usr/src/app/logs/*
RUN touch /usr/src/app/logs/focalnode-debug.log
RUN touch /usr/src/app/logs/focalnode-error.log
RUN touch /usr/src/app/logs/focalnode-info.log
RUN touch /usr/src/app/logs/focalnode-warn.log

RUN wget -O /tmp/ffmpeg.tar.xz -x "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-64bit-static.tar.xz"
RUN mkdir -p /tmp/ffmpeg && tar -xvf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1

ENV PATH $PATH:/tmp/ffmpeg
RUN apt-get update
RUN apt-get install --assume-yes build-essential
RUN apt-get install --assume-yes libav-tools
RUN apt-get install --assume-yes pkg-config libcairo2-dev libpango1.0-dev libssl-dev libjpeg62-turbo-dev libgif-dev

COPY package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /opt/app && cp -a /tmp/node_modules /usr/src/app/


RUN mkdir /usr/src/app/videos
ENV VIDEO_DIR /usr/src/app/videos/

EXPOSE 4000

CMD ["npm", "start"]
