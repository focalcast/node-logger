var defined = require('defined');
var PngStream = require('./png-stream.js');
var FrameBuffer = require('./frame-buffer.js');
var RenderQuality = require('./rendering-quality.js');
var VideoStream = require('./video-stream.js');
var Renderer = require('./renderer.js');
var mkdirp = require('mkdirp');
var sanitize = require('sanitize-filename');
var multer = require('multer');
var upload = multer();
var request = require('request');
var fs = require('fs');
var Q = require('q');
var Log = require('./log.js');
class StreamingCanvas {
    constructor(
        parent,
        width = 960,
        height = 540,
        path = process.env.VIDEO_DIR,
        quality = RenderQuality.FAST
    ) {
        new Log(this, 'Streaming Canvas');
        this.parent = parent;
        this.filename = 'video';
        this.quality = 'fast';
        this._height = height;
        this._width = width;
        this.path = path;
        this._renderer = new Renderer(this);
        this._context = this._renderer.canvas.getContext('2d');
        this._antialias = 'none';
        var promise = this.parent.qumu.create().then((res)=>{
            this.log.debug('Successfully created kulu', 'About to start one');
            return this.parent.qumu.start();
        }, (reject)=>{
                global.logger.error('OMG...', reject);
        }).catch((err)=>{
            global.logger.error('What the fuck??!');
            this.log.error('Failed to start video stream', err);
        }).then((res)=>{
            this._videoStream = new VideoStream(this, this.path);
            this._videoStream.start();
        });
    }
    get stdin(){
        return this.parent.stdin;
    }
    get qumu(){
        return this.parent.qumu;
    }
    uploadVideoData() {
        var deferred = Q.defer();
        var req = request.post(`${domain}${path}/media${auth}`, (err, resp, body) => {
            if(err) {
                this.log.error(err);
                deferred.reject();
            } else {
                this.log.debug('Successfully uploaded file to qumucloud', body);
                deferred.resolve();
            }
        });
        let form = req.form();
        form.append('file', fs.createReadStream(this.videoStream.filename('mp4')));
        return deferred.promise;
    }
    get filename() {
        return this._filename;
    }
    createFilename(ext){
        return `${this.path}${this.filename}.${ext}`
    }
    set filename(filename) {
        this._filename = filename;
    }
    get socket(){
        return this.parent.socket;
    }
    notify(message){
        this.socket.emit('recorder_status', message);
    }
    finish() {
        this.notify('Stream finished');
        process.send({message:'finished', guid: this.qumu.params.guid});
        try {
            this.renderer.disconnect();
            this.renderer.project.remove();
            this.qumu.stop().then((success)=>{
                return 0;
            }, (failed)=>{
                return 1;
            }).catch((err)=>{
                return 1;
            }).then((exitCode)=>{
                this.log.debug('Stopping video stream and exiting');
                this.videoStream.kill();
                process.exit(exitCode);
            });
        } catch(err) {
            this.log.error(err);
        }
    }
    get canvas() {
        return this._renderer.canvas;
    }
    set canvas(canvas) {
        throw new Error('Cannot set canvas');
    }
    get height() {
        return this.canvas.height;
    }
    set height(height) {
        this._renderer.height = width;
        this._height = height;
    }
    get width() {
        return this.canvas.width;
    }
    set width(width) {
        this._renderer.width = width;
    }
    set path(path) {
        // var date = new Date();
        path = `${path}${this.qumu.params.guid}/`;
        mkdirp(path, (err) => {
            if(err) {
                this.log.error('Cannot make directory', err);
            }
        });
        this._path = path;
    }
    get path() {
        return this._path;
    }
    get parent() {
        return this._parent;
    }
    set parent(parent) {
        this._parent = parent;
    }
    set antialias(antialias) {
        this._antialias = antialias;
        this._context.antialias = this._antialias;
    }
    get antialias() {
        return this._context.antialias;
    }
    toBuffer() {
        if(!defined(this._frameBuffer)) {
            this._frameBuffer = new FrameBuffer(this.canvas);
        }
        return this._frameBuffer;
    }
    get frameBuffer() {
        return this._frameBuffer;
    }
    set frameBuffer(frameBuffer) {
        throw new Error('Cannot set buffer');
    }
    toPngStream() {
        if(!defined(this._pngStream)) {
            this._pngStream = new PngStream(this);
        }
    }
    get pngStream() {
        return this._pngStream;
    }
    set pngStream(pngStream) {
        throw new Error('Cannot set png stream');
    }
    get videoStream() {
        return this._videoStream;
    }
    set videoStream(videoStream) {
        throw new Error('Cannot set video stream');
    }
    get renderer() {
        return this._renderer;
    }
    set renderer(renderer) {
        throw new Error('Cannot set renderer');
    }
}
module.exports = StreamingCanvas;
