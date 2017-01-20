var fs = require('fs');
var Q = require('q');
var Frame = require('./frame.js');
class PngStream {
    constructor(parent) {
        this.parent = parent;
        this.canvas = parent.renderer.canvas;
        this.renderer = parent.renderer;
        this.rate = 0;
        this.frames = [];
    }
    update() {
        this.renderer.update();
    }
    realtime() {
        this.update();
        this.stream = this.canvas.createPNGStream();
        this.deferred = Q.defer();
        this.deferred.promise.then((resolve) => {
            // global.logger.debug('Wrote png');
            if(this.running) {
                setTimeout(() => {
                    this.renderFrame();
                }, 100);
            }
        }, (reject) => {
            global.logger.debug('Rejected');
        });
        if(!this.running) {
            global.logger.debug('Sending end signal to ffmpeg');
        }
        this.stream.pipe(this.encoder.stdin, {
            end: !this.running
        });
        this.deferred.resolve('wrote png');
    }
    cleanup() {
        for(let f in this.frames) {
            let frame = this.frames[f];
            fs.unlink(frame.path);
        }
    }
    renderFrame() {
        this.update();
        this.stream = this.canvas.createPNGStream();
        this.deferred = Q.defer();
        this.deferred.promise.then((resolve) => {
            // global.logger.debug('Wrote png');
            if(this.running) {
                setTimeout(() => {
                    this.renderFrame();
                }, 60);
            }
            else {
                this.finish();
            }
        }, (reject) => {
            global.logger.debug('Rejected');
        });
        if(!this.running) {
            global.logger.debug('Sending end signal to ffmpeg');
        }
        this.rate++;
        var path = `${this.parent.path}${this.parent.filename}_image_${this.rate}.png`;
        var out = fs.createWriteStream(path);
        this.stream.pipe(out);
        Frame.add(this.frames, path, this.startTime);
        this.deferred.resolve('wrote png');
    }
    startRealtime(encoder) {
        if(this.started) {
            throw new Error('Already started. Cannot start');
        }
        this.encoder = encoder;
        this.startTime = new Date();
        this.started = true;
        this.running = true;
        this.rate = 0;
        return this.renderFrame();
    }
    start(callback) {
        if(this.started) {
            throw new Error('Already started. Cannot start');
        }
        this.callback = callback;
        this.startTime = new Date();
        this.started = true;
        this.running = true;
        return this.renderFrame();
    }
    finish() {
        try {
            Frame.end(this.frames);
            var stream = fs.createWriteStream(this.parent.path + this.parent.filename + '.txt');
            for(let f in this.frames) {
                let frame = this.frames[f];
                stream.write(frame.toString());
            }
            stream.end();
            global.logger.debug('Finish', typeof(this.callback));
            this.callback();
        }
        catch(err) {
            global.logger.error(err);
        }
    }
    stop() {
        global.logger.debug('Stopping png stream', this.running);
        this.started = false;
        this.running = false;
    }
}
module.exports = PngStream;
