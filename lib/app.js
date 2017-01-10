global.opbeat = require('opbeat').start({
    appId: '34931ab13a',
    organizationId: 'bf4b84724eef4f7185984a57659ab1c5',
    secretToken: '4a336b5093621f5444e131db855a8669a5ab3da7'
});

HOST = process.env.FOCALCAST_HOST;
PORT = process.env.FOCALCAST_PORT_SERVER;
SITE_URL = process.env.SITE_URL;
SOCKET_PORT = process.env.FOCALCAST_PORT_SOCKET;
GET_PRESENTATION_ADDRESS = 'api/presentation/get';
ADDRESS = 'present';
var ROOMNAME = 'focalcast';
var cluster = require('cluster');
var os = require('os');
var express = require('express');
var Session = require('./session.js');
var EventEmitter = require('events').EventEmitter;
var Users = require('./user.js');
var users = new Users();
var VERBOSE = false;
var adapter = require('socket.io-redis');
var redis = require('redis').createClient;
var sio = require('socket.io');
var net = require('net');
var slack = require('./slackwebhook.js');
var request = require('request');
var safeStringify = require('json-stringify-safe');
var _ = require('underscore');
var path = require('path');
global.logger = require('./logger.js');

var _m = require('./metrics.js');
var initMetrics = _m.init;
Metrics = _m.Metrics;
if(SITE_URL === '') {
    SITE_URL = 'undefined.host';
}

initMetrics({
    host: SITE_URL,
    prefix: 'node.',
    flushIntervalSeconds: 10,
    apiKey: '16d2db3031ea44d9a6eca7b2502f858d',
    appKey: '16d2db3031ea44d9a6eca7b2502f858d'
});

var metrics = new Metrics('service');


isDefined = function(query) {
    if(typeof query !== 'undefined' && query !== null) {
        return true;
    }
    else {
        return false;
    }
};

isUndefined = function(query) {
    return !isDefined(query);
};


//logger = require('./mglobal.logger.js')();

sprintf = require('sprintf').sprintf;

var sessions = [];
var participantLogger;

function logParticipantCount() {
    if(typeof participantLogger === 'undefined') {
        var getTotalParticipants = function() {
            var totalParticipants = 0;
            for(var session in sessions) {
                totalParticipants += sessions[session].participants.get().length;
            }
            return totalParticipants;
        };
        participantLogger = setInterval(function() {
            var totalParticipants = getTotalParticipants();
            metrics.gauge('users_total', totalParticipants);
        }, 5000);
    }
}



function addSession(roomname) {
    var session = _.findWhere(sessions, {
        'roomname': roomname
    });
    if(typeof session === 'undefined') {
        session = new Session(roomname, io);
        redisPub.hset('sessions', session.getHash(), roomname);
        session.retrieveSession();
        sessions.push(session);
    }
    return session;
}


function getSession(roomname) {
    return _.findWhere(sessions, {
        'roomname': roomname
    });
}


function mainFunction() {
    /**
     * Create regular redis pub subs.
     */
    redisPub = redis(6379, process.env.REDIS_ADDR, {
        detect_buffers: true,
        return_buffers: false
    });
    redisPub.on('error', function(err) {
        global.logger.error('Redis Error', 'Redis Pub', err);
        global.opbeat.captureError(err, {extra: {module: 'redisPub'}});
    });

    redisSub = redis(6379, process.env.REDIS_ADDR, {
        detect_buffers: true,
        return_buffers: false
    });
    redisSub.on('error', function(err) {
        global.logger.error('Redis Error', 'Redis Sub', err);
        global.opbeat.captureError(err, {extra: {module: 'redisSub'}});

    });

    /**
     * Create redis pub subs for socket.io.
     */
    var ioPub = redis(6379, process.env.REDIS_ADDR, {
        detect_buffers: true,
        return_buffers: false
    });
    ioPub.on('error', function(err) {
        global.logger.error('Redis Error', 'Pub Client', err);
        metrics.increment('error.io.redis.pub');
    });

    var ioSub = redis(6379, process.env.REDIS_ADDR, {
        return_buffers: true
    });
    ioSub.on('error', function(err) {
        global.logger.error('Redis Error', 'Sub Client', err);
        metrics.increment('error.io.redis.sub');

    });
    var redis_adapter = adapter({
        pubClient: ioPub,
        subClient: ioSub
    });

    ioPub.on('ready', function() {
        redisPub.hgetall('sessions', function(err, obj) {
            if(err) {
                global.logger.error('Error retrieving sessions');
                global.opbeat.captureError(err, {extra: {message: 'Redis failed to retrieve sesion'}});
                metrics.increment('error.io.redis.pub.get-sessions');
            }
            else {
                for(var res in obj) {
                    sessions.push(new Session(obj[res]));
                }
            }
            socketFunction(redis_adapter);
        });
    });
}

function socketFunction(redis_adapter) {

    var http = require('http');
    var app = new express();
    app.use(global.opbeat.middleware.express());
    var app_server = app.listen(0, 'localhost');
    io = sio(app_server);
    //Uncomment to remove origin headers
    //io.set('origins', '*');

    io.adapter(redis_adapter);

    io.use(function(socket, next) {
        //Unreachable
        var handshakeData = socket.request;

        if(handshakeData.headers.cookie) {
            // global.logger.debug('cookie');
            //If we want to check for cookies we can do that here
            return next(null, true);
        }
        else {
            global.logger.debug('no cookie');
            //No cookie
            return next(null, true);
        }
        return next();

    });




    io.on('error', function(err) {
        global.logger.error('Socket error: ' + err.stack);
    });
    io.on('connection', function(socket) {
        socket.roomname = socket.handshake.query.room;
        var session = addSession(socket.roomname);
        socket.join(socket.roomname);

        global.logger.debug('Socket connected', socket.id, 'to room', socket.roomname, 'cluster', cluster.worker.id);
        //Received connection from socket
        socket.emit('data', 'connected to worker: ' + cluster.worker.id);

        socket.on('send_message', function(message) {
            // global.logger.debug('Got message: ' + message);
            socket.broadcast.to(socket.roomname).emit('incomming', message);
        });
        session.onSocketConnected(socket);



        socket.on('auth', function(message) {
            //global.logger.info('Got auth');
            //global.logger.info(message);
            getSession(socket.roomname).setMasterSocket(socket);
            getSession(socket.roomname).setAuthentication(message);
            //Slack notification, auth sent
            try {
                var m = JSON.parse(JSON.stringify(message));
                //delete presentations from message
                delete m.owner.presentations;
                new slack(slack.type.session_started, JSON.stringify(m));
            }
            catch(err) {
                global.logger.error('Error sending slack webhook for session started', err);
                new slack(slack.type.error, 'Error sending slack webhook for session\n' + JSON.stringify(err));
                global.opbeat.captureError(err, {extra: {message: 'Error sending slack webhook for session', socketid: socket.id}});
            }

        });

        socket.on('token_renew', function(token) {
            getSession(socket.roomname).setToken(token);
        });

        socket.on('focalcast_pexip', function(message) {
            if(message === 'focalcast_open' || message === 'focalcast_close') {
                getSession(socket.roomname).FocalcastToggleState = message;
            }
            getSession(socket.roomname).emit('focalcast_pexip', message);
        });

        socket.on('get_focalcast_pexip_status', function() {
            getSession(socket.roomname).retrieveFocalcastToggleState(socket);
        });

        socket.on('session_updated', function() {
            getSession(socket.roomname).updateSessionInfo();
        });

        var FC_ERROR = {
            ROOMNAME: {
                UNDEFINED: 'socket_roomname_undefined',
            }
        };

        socket.on('error', function(err) {
            global.logger.error('socket error:' + err.stack);
            global.opbeat.captureError(err, {extra: {message: 'Socket error'}});
        });

        socket.on('identity', function(message) {
            var jsonObj = JSON.parse(message);
            if(jsonObj.identity === 'android') {
                socket.join(jsonObj.identity);
            }

        });

        socket.on('disconnect', function(reason) {
            global.logger.info('disconnect called.');
            getSession(socket.roomname).removeParticipant(socket);
            return;
        });
        socket.on('reverb', function(message) {
            socket.emit('incomming', message);
        });

        socket.on('end_presentation', function(message) {
            //socket.session().users.userArray = [];
            //session = new Session();
        });

        socket.on('add_user', function(data) {
            getSession(socket.roomname).addParticipant(socket, data);
            return;
        });

        socket.on('user_info', function(message) {
            return;
        });

        socket.on('update_user_info', function(message) {
            try {
                var session = getSession(socket.roomname);
                session.updateSessionInfo();
            }
            catch(err) {
                global.logger.error('service', 'error on update_user_info', err);
            }
        });


        socket.on('make_host', function(message) {

            //socket.session().users.makeHost(message);
            io.sockets.in(socket.roomname).emit('user_array', socket.session().users.getParticipantList());

        });

        socket.on('host_ended_session', function(message) {
            global.logger.debug('host_ended_session', message);
            getSession(socket.roomname).endSession(socket);
        });

        socket.on('connected_event', function(message) {
            //io.sockets.in( socket.roomname ).emit( 'user_array', socket.session().users.getParticipantList());

            //if(socket.session().current_presentation){
            //   socket.emit('set_slide', socket.session().getSlideUrl(socket.session().current_slide));
            //}
        });

        socket.on('get_userarray', function(message) {
            //socket.emit('user_array', socket.session().users.getParticipantList());
        });

        socket.on('get_presentation', function(message) {
            //socket.emit('load_presentation', socket.session().toJSONString());
        });

        socket.on('set_presentation', function(message) {
            var session = getSession(socket.roomname);
            if(typeof session !== 'undefined') {
                session.setPresentation(socket, message);
                new slack(slack.type.presentation, JSON.stringify(message));

            }
            else {
                global.logger.error('Session was undefined!');
            }

        });

        socket.on('retrieve_annotations', function(message) {
            getSession(socket.roomname).retrieveSlideAnnotations(socket);
            return;
        });

        socket.on('send_all_to_host', function(message) {
            var session = getSession(socket.roomname);
            if(typeof session !== 'undefined') {
                session.setSendAllToMaster();
            }
        });

        socket.on('force_slide', function(slide) {
            var session = getSession(socket.roomname);
            if(typeof(session) !== 'undefined') {
                // session.annotationsDirty = true;
                session.updateSessionInfo();

                if(session.shouldUpdateSlide(slide)) {
                    session.updateSlide(slide);
                }

            }
            else {
                global.logger.debug('Session was undefined');
            }

        });

        socket.on('participant_disconnect', function(participant) {
            global.logger.info('Participant disconnect event', participant);
            getSession(socket.roomname).removeParticipant(socket, participant);
        });


        socket.on('set_verbosity', function(bool) {
            VERBOSE = bool;
        });

        socket.on('debug_please', function() {
            var fs = require('fs');
            fs.readFile('./logs/focalnode-debug.log', 'utf8', function(err, data) {
                if(err) {
                    socket.emit('debug_info', err);
                }
                else {
                    socket.emit('debug_info', data);
                }
            });
        });

        socket.on('path_part', function(message) {
            //socket.broadcast.to(socket.roomname).emit('path_part', message);
            if(isDefined(socket.roomname) && isDefined(getSession(socket.roomname))) {
                getSession(socket.roomname).broadcastAnnotations('path_part', message, this);
            }
        });

        socket.on('path', function(message) {
            getSession(socket.roomname).addAnnotation(message);
        });

        socket.on('undo', function() {
            getSession(socket.roomname).undoAnnotation();
        });

        socket.on('clear', function() {
            getSession(socket.roomname).clearAnnotations();
        });

    });

    process.on('message', function(message, connection) {
        if(message === 'socket_connection') {
            try {
                if(connection) {
                    //global.logger.debug(  safeStringify( connection )  );
                    app_server.emit('connection', connection);
                    connection.resume();

                }
                else {
                    global.logger.warn('Process received connection event but connection was not defined');
                }


            }
            catch(err) {
                new slack(slack.type.error, 'Connection error : ' + err);
                global.logger.error(err.stack);
                global.opbeat.captureError(err, {extra: {
                    message: 'Connection error'
                }});
                metrics.increment('error.io.connection-error');
            }
        }
    });

    process.on('uncaughtException', function(err) {
        try {
            new slack(slack.type.error, 'Uncaught exception' + JSON.stringify(err));
        }
        catch(error) {
            global.logger.error('Error sending slack webhook for uncaught exception');
        }
        global.logger.error('error', 'Fatal uncaught exception', err, function(err, level, msg, meta) {
            global.opbeat.captureError(err, {extra:{
                level: level,
                message: msg,
                meta: meta
            }});
            metrics.increment('error.fatal.uncaught-exception');

            process.exit(1);
        });
    });

}
if(cluster.isMaster) {
    var worker;
    var spawn = function() {
        global.logger.info('spawning new worker');
        worker = cluster.fork();
    };
    spawn();
    cluster.on('fork', function(worker) {
        if(worker.id === 1) {
            global.logger.error('NodeStarted');
        }
        global.logger.info(sprintf('worker %s spawned', worker.id));
        clusterTimeout = undefined;
    });

    cluster.on('online', function(worker) {
        global.logger.info(sprintf('worker %s online', worker.id));
        global.logger.info('Worker ', worker.id, ' is online');
    });

    cluster.on('listening', function(worker, addr) {
        global.logger.log('info', 'worker %s listening on %s:%d', worker.id, addr.address, addr.port);
        try {
            global.logger.info('Worker ', worker.id, ' listening on ', addr.address, addr.port);
        }
        catch(exception) {
            global.logger.error('Error logging thing', exception);
            global.opbeat.captureError(exception, {
                extra: {
                    reason: 'Cluster listening error',
                    worker: worker.id,
                    address: addr.address,
                    port: addr.port
                }
            });
        }
    });

    cluster.on('disconnect', function(worker) {
        global.logger.error('Worker ', worker.id, ' disconnected.', 'Forking new cluster');
        metrics.increment('error.worker.disconnected');
        setTimeout(function() {
            spawn();
        }, 750);
    });
    var clusterTimeout;
    cluster.on('exit', function(worker, code, signal) {
        global.logger.error('Worker is dead');
        global.logger.error('worker ' + worker.id + ' died');
        global.opbeat.captureError('Worker died', {
            extra: {
                worker: worker.id,
                code: code,
                signal: signal
            }
        });
        if(typeof clusterTimeout === 'undefined') {
            clusterTimeout = setTimeout(function() {
                if(worker.id < 10) {
                    //spawn();
                }
                else {
                    process.exit(1);
                }
            }, 750);
        }
    });

    var server = net.createServer({
        pauseOnConnect: true
    }, function(connection) {
        worker.send('socket_connection', connection);
    }).listen(8080);
}
else {
    logParticipantCount();

    var collectMemoryStats = function() {
        var memUsage = process.memoryUsage();
        metrics.gauge('memory.rss', memUsage.rss);
        metrics.gauge('memory.heapTotal', memUsage.heapTotal);
        metrics.gauge('memory.heapUsed', memUsage.heapUsed);
    };
    setInterval(collectMemoryStats, 5000);
    var domain = require('domain');
    var d = domain.create();
    d.run(mainFunction);
    d.on('error', function(err) {
        var memUsage = process.memoryUsage();

        opbeat.captureError(err, { extra : {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed
        }});

        global.logger.error('There was an error: ' + err.stack);
        cluster.worker.disconnect();
    });
}
