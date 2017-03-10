var fs = require('fs');
var defined = require('defined');
var Q = require('q');
var lightnpng = require('node-lightnpng');
var Frame = require('./frame.js');
var Log = require('./log.js');
var _ = require('underscore');
/**
 * Stream Type
 * @description Whether the stream is being written to the file system or directly piped to ffmpeg.
 * @type {Object}
 */
var STREAM_TYPE = {
    FILE: 'FILE',
    RTMP: 'RTMP'
};
/**
 * @class PngStream
 */
class PngStream {
    constructor(parent) {
        new Log(this, 'PNGStream');
        this.parent = parent;
        this.canvas = parent.renderer.canvas;
        this.renderer = parent.renderer;
        this.rate = 0;
        this.frames = [];
        this.times = [];

    }
    /**
     * @function update
     * @description Updates the paper canvas
     */
    update() {
        this.renderer.update();
    }
    onFrame() {
        if(defined(this.renderFn) && typeof this.renderFn === 'function') {
            //this.renderFn();
        }
    }
    /**
     * @function getLightnPng
     * @description generates a png frame using lightnpng for compression
     */
    getLightnPng() {
        return lightnpng.native_argb32_to_png(this.canvas.toBuffer('raw'), this.canvas.width, this.canvas.height, this.canvas.stride);
    }
    /**
     * @function pipePngToStream
     * @description generates a png from the paper.js canvas and pipes it into the ffmpeg encoder process
     *
     */
    pipePngToStream() {
        if(!this.running) {
            //this.parent.videoStream.interrupt();
            global.logger.debug('Calling end to stdio 3');
            this.encoder.stdin.end();
            this.parent.videoStream.interrupt();
        }
        this.update();
        // var stream = this.canvas.jpegStream({
        //     bufsize: 4096,
        //     quality: 100,
        //     progressive: false
        // });
        // var stream = this.canvas.pngStream();
        try {
            let t1 = new Date().getTime();
            var stream = this.getLightnPng();
            this.encoder.stdin.write(stream);
            this.times.push((new Date().getTime() - t1)/1000);
            if(this.times.length === 100){
                var total=0;
                _.forEach(this.times, (time)=>{
                    total+=time;
                });

                global.logger.debug('Avg time', total/10);
                this.times = [];
            }
            // if(!this.running) {
            //     this.log.debug('Sending end signal to ffmpeg');
            //     stream.pipe(this.encoder.stdin, {
            //         end: true
            //     });
            // } else {
            //     stream.pipe(this.encoder.stdin, {
            //         end: !this.running
            //     });
            // }
        } catch(err) {
            global.logger.warn('Error on png generation/stream pipe', this.running, err);
            this.log.error(err);
        }
        if(this.running) {
            this.timedOut = setTimeout(() => {
                this.processing = false;
                this.pipePngToStream();
            }, 32);
        }
    }
    /**
     * @name cleanup
     * @function
     * @description deletes the image files created when piping pngs to the file system
     */
    cleanup() {
        this.log.debug('Cleaning up pngs. Number of images in video', this.frames.length);
        for(let f in this.frames) {
            let frame = this.frames[f];
            fs.unlink(frame.path);
        }
    }
    pipePngToFile() {
        this.update();
        this.stream = this.canvas.createPNGStream();
        this.deferred = Q.defer();
        this.deferred.promise.then((resolve) => {
            // this.log.debug('Wrote png');
            if(this.running) {
                setTimeout(() => {
                    this.renderFrame();
                }, 60);
            } else {
                this.finish();
            }
        }, (reject) => {
            this.log.debug('Rejected');
        });
        if(!this.running) {
            this.log.debug('Sending end signal to ffmpeg');
        }
        this.rate++;
        var path = this.parent.createFilename('_image_' + this.rate + '.png');
        var out = fs.createWriteStream(path);
        this.stream.pipe(out);
        Frame.add(this.frames, path, this.startTime);
        this.deferred.resolve('wrote png');
    }
    startRTMP(encoder) {
        if(this.started) {
            throw new Error('Already started. Cannot start');
        }
        this.encoder = encoder;
        this.startTime = new Date();
        this.started = true;
        this.running = true;
        this.rate = 0;
        this.renderFn = this.pipePngToStream;
        this.type = STREAM_TYPE.RTMP;
        return this.pipePngToStream();
    }
    startPngStream(callback) {
        if(this.started) {
            throw new Error('Already started. Cannot start');
        }
        this.callback = callback;
        this.startTime = new Date();
        this.started = true;
        this.running = true;
        this.renderFn = this.pipePngToStream;
        this.processing = false;
        this.type = STREAM_TYPE.FILE;
        return this.pipePngToFile();
    }
    writeFramesToFile() {
        Frame.end(this.frames);
        var stream = fs.createWriteStream(this.parent.createFilename('.txt'));
        for(let f in this.frames) {
            let frame = this.frames[f];
            stream.write(frame.toString());
        }
        this.log.debug('Finish', typeof(this.callback));
        this.callback();
        stream.end();
    }
    finish() {
        if(this.type === STREAM_TYPE.FILE) {
            this.writeFramesToFile();
        }
    }
    stop() {
        global.logger.debug('Clearing timeout');
        clearTimeout(this.timedOut);
        this.log.debug('Stopping png stream', this.running);
        this.encoder.stdin.end();
        this.parent.videoStream.interrupt();
        this.started = false;
        this.running = false;
    }
}
module.exports = PngStream;
