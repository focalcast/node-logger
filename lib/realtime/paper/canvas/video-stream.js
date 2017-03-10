var spawn = require('child_process').spawn;
var Q = require('q');
var ffmpeg = require('fluent-ffmpeg');
var Log = require('./log.js');
var FFMPEG = require('./ffmpeg-options.js');
var net = require('net');
class VideoStream {
    constructor(parent, dir) {
        this.parent = parent;
        this.dir = dir;
        this.doubleBuffer = false;
        this.localStream = false;
        new Log(this, 'Video Stream');
    }
    init() {
        global.logger.info('Initializing streamer');
        this.parent.toPngStream();
    }
    get options() {
        return this._options;
    }
    set options(options) {
        this._options = options;
    }
    get pngStream() {
        return this.parent.pngStream;
    }
    get qumu() {
        return this.parent.qumu.params;
    }
    get remoteEndpoint() {
        if(this.localStream) {
            global.logger.debug('Streaming to localhost:1935')
            return `rtmp://localhost:1935/live/test`
        } else {
            return `rtmp://${this.qumu.streamEndpoint}/live/${this.qumu.streamName}`
        }
    }
    get txt2mp4() {
        return FFMPEG.TXT2MP4.concat(this.parent.createFilename('mp4'));
    }
    get png2flv() {
        let source = this.doubleBuffer ? 'pipe:1' : this.remoteEndpoint;
        return FFMPEG.PNG2FLV.concat(source);
    }
    get flv2rtmp() {
        return FFMPEG.FLV2RTMP.concat(this.remoteEndpoint);
    }
    receiveAudio(data) {}
    start() {
        if(this.cancelled) {
            global.logger.warn('Stream process cancelled');
            return;
        }
        this.init();
        var deferred = Q.defer();
        this.encoder = spawn('ffmpeg', this.png2flv);
        global.logger.debug('Ffmpeg encoder process started');

        if(this.doubleBuffer) {
            this.streamer = spawn('ffmpeg', this.flv2rtmp);
            this.streamer.on('close', (code) => {
                this.log.warn('flv2rtmp streamer has closed');
            });
            this.streamer.on('error', (err) => {
                this.log.warn('flv2rtmp error::', err);
            });
            this.streamer.on('warning', (warning) => {
                this.log.warn('flv2rtmp warning::', warning);
            });
            this.streamer.on('uncaughtException', (err) => {
                global.logger.error('flv2rtmp uncaughtException::', err);
            });
            this.streamer.stderr.pipe(process.stdout);

            this.encoder.stdout.pipe(this.streamer.stdin);
        }
        this.encoder.stderr.pipe(process.stdout);

        this.encoder.on('error', (err) => {
            //this.parent.finish();
            this.log.error('ffmpeg error', err);
        });
        this.encoder.on('close', (close) => {
            this.pngStream.stop();
            global.logger.warn('ffmpeg closed', close);
            this.parent.finish();
            // this.parent.pngStream.cleanup();
        });
        this.encoder.on('uncaughtException', (err) => {
            global.logger.error('FFMPEG uncaught exception', err);
        });
        this.encoder.on('warning', (warning) => {
            global.logger.warn('FFMPEG warning', warning);
        });
        this.pngStream.startRTMP(this.encoder);
        this.started = true;
        this.parent.notify('Stream started');
    }
    startPngEncode() {
        if(this.cancelled) {
            global.logger.warn('Stream process cancelled');
            return;
        }
        this.init();
        var callback = () => {
            global.logger.debug('video stream ending');
            this.encoder = spawn('ffmpeg', this.txt2mp4);
            global.logger.debug('Ffmpeg encoder process started');
            this.encoder.stderr.pipe(process.stdout);
            this.encoder.stderr.on('error', (err) => {
                global.logger.info('ffmpeg error', err);
            });
            this.encoder.on('error', (err) => {
                global.logger.info('ffmpeg error', err);
            });
            this.encoder.on('close', (close) => {
                //Finish
                this.parent.finish();
                global.logger.warn('Encoder - ffmpeg closed');
                this.parent.pngStream.cleanup();
            });
            this.encoder.on('uncaughtException', (err) => {
                global.logger.error('FFMPEG uncaught exception', err);
            });
            this.encoder.on('warning', (warning) => {
                global.logger.warn('FFMPEG warning', warning);
            });
        };
        this.parent.pngStream.start(callback);
        this.started = true;
    }
    stop() {
        if(this.started) {}
    }
    suspend() {
        if(this.started) {
            this.encoder.kill('SIGSTOP');
        }
    }
    resume() {
        if(this.started) {
            this.encoder.kill('SIGCONT');
        }
    }
    kill() {
        try {
            this.log.info('Stopping video stream -- kill');
            this.pngStream.stop();
            this.encoder.kill('SIGKILL');
            if(this.doubleBuffer){
                this.streamer.kill('SIGKILL');
            }
        } catch(err) {
            global.logger.error('Error on kill', err);
        }
    }
    interrupt() {
        try {
            this.log.info('Stopping video stream -- interrupt');
            this.cancelled = true;
            this.encoder.kill('SIGINT');
            if(this.doubleBuffer){
                this.streamer.kill('SIGINT');
                this.streamer.kill('SIGKILL');
            }
            this.encoder.kill('SIGKILL');

        } catch(err) {
            global.logger.error('Error on interrupt', err);
        }
    }
}
module.exports = VideoStream;
