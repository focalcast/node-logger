var express = require('express');
var winston = require('winston');
var restLog = require('./rest-log.js');
var timestampFunction = function() {
    return new Date().toUTCString();
};
var app = new express();
var CanvasConnection = require('./realtime/canvas-connection.js');

app.listen('8080');
// var canvasConnection;
// app.all('/start/:roomname/', (req, res, next) => {
//     try {
//         canvasConnection = new CanvasConnection(req.params.roomname);
//         canvasConnection.connect();
//         res.send(`Starting -- ${req.params.roomname}`);
//     }
//     catch(err) {
//         global.logger.error(err);
//     }
// });
// app.all('/stop/:roomname/', (req, res, next) => {
//     try {
//         canvasConnection.disconnect();
//         res.send(`Stopping -- ${req.params.roomname}`);
//     }
//     catch(err) {
//         global.logger.error(err);
//     }
// });
global.logger = new(winston.Logger)({
    transports: [
        new(winston.transports.Console)({
            level: 'debug',
            colorize: true,
            json: false,
            handleExceptions: true,
            timestamp: timestampFunction
        }),
        new(winston.transports.Console)({
            name: 'focalnode-info',
            level: 'info',
            handleExceptions: true,
            json: false,
            colorize: false,
            timestamp: timestampFunction
        }),
        new(winston.transports.Console)({
            name: 'focalnode-error',
            level: 'error',
            timestamp: timestampFunction,
            handleExceptions: true
        })
    ],
    exitOnError: false
});
restLog(app);
