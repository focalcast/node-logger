var socketio = require('socket.io-client');
var defined = require('defined');
var StreamingCanvas = require('./paper/canvas/streaming-canvas.js');
var Qumu = require('./qumu.js');
class PaperCanvas {
    constructor(roomname, stdin) {
        this.stdin = stdin;
        this.roomname = roomname;
        this.log('Initialized ' + this.roomname);
        this.connectFn = () => {
            this.log('Connected');
            this.initListeners();
            // this.canvas.videoStream.start();
            this.connected = true;
        };
    }
    connect(params) {
        if(defined(this.socket) && this.socket.connected) {
            throw new Error('Attempting to start already connected canvas-connection!', this.roomname, this.socket.id);
        }
        this.qumu = new Qumu(this, params);
        try {
            this.canvas = new StreamingCanvas(this);
            this.socket = socketio('http://127.0.0.1:8080', {
                query: `room=${this.roomname}&guid=${params.guid}&recorder=true`
            });
            this.socket.once('connect', this.connectFn);
        } catch(err) {
            global.logger.error('Error on connection', err);
        }
    }
    disconnect() {
        global.logger.debug('calling disconnect');
        try {
            this.socket.disconnect();
            process.send({ message: 'finished' });
        } catch(err) {
            global.logger.error('Error on disconnect', err);
        }
        this.connected = false;
    }
    initListeners() {
        this.socket.on('disconnect', (reason) => {
            this.log('Stream process socket disconnected');
            try {
                if(defined(this.canvas.pngStream)) {
                    this.canvas.pngStream.stop();
                }
            } catch(err) {
                global.logger.error('Error on stop -- could not convert video', err)
            }
        });
        this.socket.on('reconnect', () => {});
        this.canvas.renderer.setListeners(this.socket);
    }
    log(...args) {
        global.logger.debug(`Canvas Listener:'${this.roomname}' message:`, ...args);
    }
}
module.exports = PaperCanvas;
