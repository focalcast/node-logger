FROM node:argon

RUN mkdir -p /usr/src/app

COPY package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /opt/app && cp -a /tmp/node_modules /usr/src/app/

COPY ervices.js /usr/src/app/
COPY package.json /usr/src/app

WORKDIR /usr/src/app

COPY lib /usr/src/app

EXPOSE 4000

CMD ["npm", "start"]

