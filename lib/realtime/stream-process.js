var defined = require('defined');
var path = require('path');
var canvasConnection = require('./canvas-connection.js');
var net = require('net');
global.logger = require(path.join(process.env.APP_DIR, 'lib/logger.js'));

var paperCanvas;
process.on('message', function(msg, data){
    switch(msg.message){
        case 'connect':
            paperCanvas = new canvasConnection(msg.roomname, process.stdin);
            paperCanvas.connect(msg.options);
            break;
        case 'disconnect':
            paperCanvas.disconnect();
            break;
        case 'get_id':
            process.send({message: 'id', id: paperCanvas.guid});
    }
});
process.on('uncaughtException', (err)=>{
    global.logger.error('Stream process uncaught exception', err);
});

process.on('unhandledRejection', (reason, p)=>{
    global.logger.warn('Unhandled promise rejection', reason, p);
});

process.on('warning', (warning)=>{
    global.logger.warn('Stream process warning', warning);
});

process.on('exit', (exitCode)=>{
    global.logger.info('Stream process exiting', exitCode);
});


module
