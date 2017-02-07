var defined = require('defined');
var path = require('path');
var canvasConnection = require('./canvas-connection.js');
global.logger = require(path.join(process.env.APP_DIR, 'lib/logger.js'));

var paperCanvas;
process.on('message', function(msg, data){
    switch(msg.message){
        case 'connect':
            paperCanvas = new canvasConnection(msg.roomname);
            paperCanvas.connect(msg.options);
            break;
        case 'disconnect':
            paperCanvas.disconnect();
            break;
        case 'get_id':
            process.send({message: 'id', id: paperCanvas.guid});
    }
});

module
