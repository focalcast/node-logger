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

class StreamingCanvas{
    constructor(
        parent,
        width=1280,
        height=720,
        path=process.env.VIDEO_DIR,
        quality=RenderQuality.FAST
    ){
        this._parent = parent;
        this.filename = 'video';
        this.quality = 'fast';
        this._height = height;
        this._width = width;
        this.path = path;
        this._renderer = new Renderer(this);
        this._context = this._renderer.canvas.getContext('2d');
        this._antialias = 'none';
        this._videoStream = new VideoStream(this, this._path);
    }
    get filename(){
        return this._filename;
    }
    set filename(filename){
        this._filename = filename;
    }
    finish(){
        this.renderer.disconnect();
        this.renderer.project.remove();
        global.logger.debug('Finished ');
        let domain = `https://${this.parent.subdomain}.qumucloud.com`;
        let path = `/api/2.1/rest/kulus/${this.parent.guid}/media`;
        let auth = `?username=${this.parent.username}&password=${this.parent.password}`;
        var req = request.post(`${domain}${path}${auth}`, (err, resp, body)=>{
            if(err){
                global.logger.error(err);
            }else{
                global.logger.debug('Successfully uploaded file to qumucloud', body);
            }
        });
        let form = req.form();
        form.append('file', fs.createReadStream(this.videoStream.filename('mp4')));
    }
    get canvas(){
        return this._renderer.canvas;
    }
    set canvas(canvas){
        throw new Error('Cannot set canvas');
    }
    get height(){
        return this.canvas.height;
    }
    set height(height){
        this._renderer.height = width;
        this._height = height;
    }
    get width(){
        return this.canvas.width;
    }
    set width(width){
        this._renderer.width = width;
    }
    set path(path){
        // var date = new Date();
        date = `${date}`.replace(/ /g, '_');
        path = `${path}${this.parent.guid}/`;
        mkdirp(path, (err)=>{
            global.logger.error('Cannot make directory', err);
        });
        this._path = path;
    }
    get path(){
        return this._path;
    }
    get parent(){
        return this._parent;
    }
    set parent(parent){
        this._parent = parent;
    }
    set antialias(antialias){
        this._antialias = antialias;
        this._context.antialias = this._antialias;
    }
    get antialias(){
        return this._context.antialias;
    }
    toBuffer(){
        if(!defined(this._frameBuffer)){
            this._frameBuffer = new FrameBuffer(this.canvas);
        }
        return this._frameBuffer;
    }
    get frameBuffer(){
        return this._frameBuffer;
    }
    set frameBuffer(frameBuffer){
        throw new Error('Cannot set buffer');
    }
    toPngStream(){
        if(!defined(this._pngStream)){
            this._pngStream = new PngStream(this);
        }
    }
    get pngStream(){
        return this._pngStream;
    }
    set pngStream(pngStream){
        throw new Error('Cannot set png stream');
    }
    get videoStream(){
        return this._videoStream;
    }
    set videoStream(videoStream){
        throw new Error('Cannot set video stream');
    }
    get renderer(){
        return this._renderer;
    }
    set renderer(renderer){
        throw new Error('Cannot set renderer');
    }
}

module.exports = StreamingCanvas;
