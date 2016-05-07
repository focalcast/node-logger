var winston = require('winston');
var path = require('path');

var timestampFunction = function(){
    return new Date().toUTCString();
};

logger = new (winston.Logger)({
    transports : [
        new (winston.transports.Console)({ 
            level: 'debug',
            colorize : true,
            json: false,
            handleExceptions: true,
            timestamp: timestampFunction
        }),
        new (winston.transports.File)({
            name : 'focalnode-info',
            filename: path.join(__dirname, './logs/focalnode-info.log'),
            level : 'info',
            handleExceptions : true,
            json : true,
            maxsize: 5242880,
            maxFiles: 5,
            colorize: false,
            timestamp : timestampFunction
        }),
        new (winston.transports.File)({
            name : 'focalnode-error',
            filename: path.join(__dirname, './logs/focalnode-error.log'),
            level: 'error',
            timestamp : timestampFunction,
            handleExceptions: true
        }),
        new (winston.transports.File)({
            name : 'focalnode-debug',
            filename : path.join(__dirname, './logs/focalnode-debug.log'),
            level : 'debug',
            colorize : true,
            json: true,
            handleExceptions : true,
            timestamp : timestampFunction
        }),
        new (winston.transports.File)({
            name : 'focalnode-warn',
            filename : path.join(__dirname, './logs/focalnode-warn.log'),
            level : 'warn',
            timestamp : timestampFunction
        })
    ],
    exitOnError: false
});

winston.emitErrs = true;

