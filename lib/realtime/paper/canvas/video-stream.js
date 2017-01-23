var spawn = require('child_process').spawn;
var Q = require('q');
var ffmpeg = require('fluent-ffmpeg');
class VideoStream {
    constructor(parent, dir) {
        this.parent = parent;
        this.dir = dir;
        this._realtimeOptions = [
            '-f', 'image2pipe',
            '-r', '10',
            '-vcodec', 'png',
            '-s', '1280x720',
            '-i', '-',
            '-b:v', '384k',
            '-f', 'mp4',
            '-r', '20',
            this.filename('mp4')
        ];
        this._options = [
            '-f', 'concat',
            '-safe', 0,
            '-i', this.filename('txt'),
            '-pix_fmt', 'yuv420p',
            '-f', 'mp4',
            this.filename('mp4')
        ];
    }
    filename(ext) {
        return this.dir + this.parent.filename + '.' + ext;
    }
    init() {
        this.parent.toPngStream();
    }
    get options() {
        return this._options;
    }
    set options(options) {
        this._options = options;
    }
    startRealtime() {
        this.init();
        var deferred = Q.defer();
        this.encoder = spawn('ffmpeg', this._realtimeOptions);
        this.encoder.stderr.pipe(process.stdout);
        this.encoder.stderr.on('error', (err) => {
            global.logger.info('ffmpeg error', err);
        });
        this.encoder.on('error', (err) => {
            global.logger.info('ffmpeg error', err);
        });
        this.encoder.on('close', (close) => {
            global.logger.debug('ffmpeg closed');
        });
        this.parent.pngStream.start(this.encoder);
        this.started = true;
    }
    start() {
        this.init();
        var callback = () => {
            global.logger.debug('video stream ending');
            this.encoder = spawn('ffmpeg', this._options);
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
                global.logger.debug('ffmpeg closed');
                this.parent.pngStream.cleanup();
            });
        };
        this.parent.pngStream.start(callback);
        this.started = true;
    }
    stop() {
        if(this.started) {
        }
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
}
module.exports = VideoStream;
