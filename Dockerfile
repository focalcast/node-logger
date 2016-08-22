FROM node:argon

RUN mkdir -p /usr/src/app

COPY package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /opt/app && cp -a /tmp/node_modules /usr/src/app/

COPY service.js /usr/src/app/
COPY package.json /usr/src/app

WORKDIR /usr/src/app

COPY lib/ /usr/src/app/lib
COPY logs /usr/src/app/logs

RUN rm -rf /usr/src/app/logs/*
RUN touch /user/src/app/logs/focalnode-debug.logs
RUN touch /user/src/app/logs/focalnode-error.logs
RUN touch /user/src/app/logs/focalnode-info.logs
RUN touch /user/src/app/logs/focalnode-warn.logs



EXPOSE 4000

CMD ["npm", "start"]
