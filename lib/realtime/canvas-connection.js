var socketio = require('socket.io-client');
var defined = require('defined');
var StreamingCanvas = require('./paper/canvas/streaming-canvas.js');
class PaperCanvas {
    constructor(roomname) {
        this.roomname = roomname;
        this.log('Initialized ' + this.roomname);
        this.connectFn = () => {
            this.log('Connected');
            this.initListeners();
            this.canvas.videoStream.start();
            this.connected = true;
        };
    }
    connect(params) {
        this.guid = params.guid;
        this.username = params.username;
        this.password = params.password;
        this.subdomain = params.subdomain;
        if(!defined(this.guid) || !defined(this.username) || !defined(this.password)){
            throw new Error('Invalid Qumu credentials');
        }
        try {
            this.canvas = new StreamingCanvas(this);
            this.socket = socketio('http://127.0.0.1:8080', {
                query: `room=${this.roomname}`
            });
            this.socket.once('connect', this.connectFn);
        }
        catch(err) {
            global.logger.error('Error on connection', err);
        }
    }
    disconnect() {
        try {
            this.canvas.pngStream.stop();
        }
        catch(err) {
            global.logger.error('Error on stop -- could not convert video', err)
        }
        this.socket.disconnect();
        this.connected = false;
    }
    initListeners() {
        this.socket.on('disconnect', (reason) => {
            this.log('Disconnected');
        });
        this.socket.on('reconnect', () => {});
        this.canvas.renderer.setListeners(this.socket);
    }
    log(message) {
        global.logger.debug(`Canvas Listener:'${this.roomname}' message: ${message}`);
    }
}

module.exports = PaperCanvas;
