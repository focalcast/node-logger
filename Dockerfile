FROM node:boron

RUN mkdir -p /usr/src/app

COPY package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /opt/app && cp -a /tmp/node_modules /usr/src/app/

COPY package.json /usr/src/app

WORKDIR /usr/src/app

COPY lib/ /usr/src/app/lib
COPY logs /usr/src/app/logs

RUN rm -rf /usr/src/app/logs/*
RUN touch /usr/src/app/logs/focalnode-debug.log
RUN touch /usr/src/app/logs/focalnode-error.log
RUN touch /usr/src/app/logs/focalnode-info.log
RUN touch /usr/src/app/logs/focalnode-warn.log



EXPOSE 4000

CMD ["npm", "start"]
