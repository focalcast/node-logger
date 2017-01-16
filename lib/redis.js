var redis = require('redis').createClient;
var adapter = require('socket.io-redis');

class RedisPubSub {
    constructor() {
        /**
         * Create regular redis pub subs.
         */
        this.redisPub = redis(6379, 'localhost', {
            detect_buffers: true,
            return_buffers: false
        });
        this.redisPub.on('error', (err) => {
            global.logger.error('Redis Error', 'Redis Pub', err);
            global.opbeat.captureError(err, {
                extra: {
                    module: 'redisPub'
                }
            });
        });

        this.redisSub = redis(6379, 'localhost', {
            detect_buffers: true,
            return_buffers: false
        });
        this.redisSub.on('error', (err) => {
            global.logger.error('Redis Error', 'Redis Sub', err);
            global.opbeat.captureError(err, {
                extra: {
                    module: 'redisSub'
                }
            });

        });

        /**
         * Create redis pub subs for socket.io.
         */
        this.ioPub = redis(6379, 'localhost', {
            detect_buffers: true,
            return_buffers: false
        });
        this.ioPub.on('error', function(err) {
            global.logger.error('Redis Error', 'Pub Client', err);
            global.metrics.increment('error.io.redis.pub');
        });

        this.ioSub = redis(6379, 'localhost', {
            return_buffers: true
        });
        this.ioSub.on('error', function(err) {
            global.logger.error('Redis Error', 'Sub Client', err);
            global.metrics.increment('error.io.redis.sub');

        });
    }
    get adapter() {
        return adapter({
            pubClient: this.ioPub,
            subClient: this.ioSub
        });
    }
    set adapter(a) {
        throw new Error('Cannot set redis adapter');
    }
    on(evt, fn) {
        this.ioSub.on(evt, fn);
    }
}
var redis = new RedisPubSub();

module.exports = redis;
