global.opbeat = require('opbeat').start({
    appId: '34931ab13a',
    organizationId: 'bf4b84724eef4f7185984a57659ab1c5',
    secretToken: '4a336b5093621f5444e131db855a8669a5ab3da7'
});

var SITE_URL = process.env.SITE_URL;
var cluster = require('cluster');
var os = require('os');
var express = require('express');
var bodyParser = require('body-parser');
var Session = require('./session.js');
var EventEmitter = require('events').EventEmitter;
var VERBOSE = false;
var redis = require('./redis.js');
var sio = require('socket.io');
var net = require('net');
var slack = require('./slackwebhook.js');
var request = require('request');
var safeStringify = require('json-stringify-safe');
var _ = require('underscore');
var defined = require('defined');
var path = require('path');
var CanvasConnection = require('./realtime/canvas-connection.js');
global.logger = require('./logger.js');

// var _m = require('./metrics.js');
// var initMetrics = _m.init;
//global.metrics = _m.Metrics;
if(SITE_URL === '') {
    SITE_URL = 'undefined.host';
}

// initMetrics({
//     host: SITE_URL,
//     prefix: 'node.',
//     flushIntervalSeconds: 10,
//     apiKey: '16d2db3031ea44d9a6eca7b2502f858d',
//     appKey: '16d2db3031ea44d9a6eca7b2502f858d'
// });

//global.metrics = new Metrics('service');




function mainFunction() {

    socketFunction(redis.adapter);


}

function socketFunction(redis_adapter) {
    global.logger.warn('main function called');
    var sessions = [];
    global.sessions = sessions;
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
                //global.metrics.gauge('users_total', totalParticipants);
            }, 5000);
        }
    }



    function addSession(roomname, io) {
        var session = _.findWhere(sessions, {
            'roomname': roomname
        });
        if(!defined(session)) {
            session = new Session(roomname, io);
            redis.redisPub.hset('sessions', session.getHash(), roomname);
            session.retrieveSession();
            sessions.push(session);
        }
        else {
            session.io = io;
        }
        return session;
    }


    function getSession(roomname) {
        return _.findWhere(sessions, {
            'roomname': roomname
        });
    }

    global.logger.debug('What the fuck');
    var http = require('http');
    var app = new express();
    app.use(global.opbeat.middleware.express());
    var app_server = app.listen(0, 'localhost');
    var io = sio(app_server, {pingTimeout: 6000, pingInterval: 4000});
    //Uncomment to remove origin headers
    //io.set('origins', '*');

    io.adapter(redis_adapter);

    redis.on('ready', () => {
        redis.redisPub.hgetall('sessions', function(err, obj) {
            if(err) {
                global.logger.error('Error retrieving sessions');
                global.opbeat.captureError(err, {
                    extra: {
                        message: 'Redis failed to retrieve sesion'
                    }
                });
                //global.metrics.increment('error.io.redis.pub.get-sessions');
            }
            else {
                for(var res in obj) {
                    if(!defined(getSession(obj[res]))) {
                        sessions.push(new Session(obj[res], io));
                    }
                }
            }
        });
    });


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

    });
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));

    var canvasConnection;
    var canvasConnections = {};

    app.post('/qumu/:roomname/start/', (req, res, next) => {
        try {
            var canvasConnection = canvasConnections[req.params.roomname];
            if(!defined(canvasConnection)) {
                canvasConnection = new CanvasConnection(req.params.roomname);
                canvasConnection.connect(req.body);
                canvasConnections[req.params.roomname] = canvasConnection;
                res.send(`Starting conversion -- ${req.params.roomname}`);
            }
            else if(!canvasConnection.connected) {
                canvasConnection.connect(req.body);
                res.send(`Starting conversion -- ${req.params.roomname}`);
            }
            else {
                res.send('Cannot start recording. Already started');
            }
        }
        catch(err) {
            global.logger.error(err);
            res.status(500).send(err);

        }
    });
    app.post('/qumu/:roomname/stop/', (req, res, next) => {
        try {
            var canvasConnection = canvasConnections[req.params.roomname];
            if(!defined(canvasConnection)) {
                res.send(`Cannot stop canvas connection for room ${req.params.roomname}, not started`);
            }
            else {
                canvasConnection.disconnect(req.body);
                res.send(`Stopping -- ${req.params.roomname}`);
            }
        }
        catch(err) {
            global.logger.error(err);
            res.status(500).send(err);
        }
    });
    app.get('/qumu/:roomname/recording/', (req, res, next) => {
        let canvasConnection = canvasConnections[req.params.roomname];
        if(defined(canvasConnection) && canvasConnection.connected) {
            res.status(200).send({
                guid: canvasConnection.guid
            });
        }
        else {
            res.status(404).send('No recording for that room');
        }
    });




    io.on('error', function(err) {
        global.logger.error('Socket error: ' + err.stack);
    });
    io.on('connection', function(socket) {

        socket.roomname = socket.handshake.query.room;
        var session = addSession(socket.roomname, io);
        socket.on('disconnect', ()=>{
            global.logger.debug('Disconnect fired!');
        });
        session.addUser(socket);
        if(socket.handshake.query.recorder) {
            global.logger.debug('Hagan das vecoder');
            session.recorder = socket;
        }
    });

    process.on('message', function(message, connection) {
        if(message === 'socket_connection') {
            try {
                if(connection) {
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
                global.opbeat.captureError(err, {
                    extra: {
                        message: 'Connection error'
                    }
                });
                //global.metrics.increment('error.io.connection-error');
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
        global.logger.error('Fatal uncaught exception', err);

        //global.metrics.increment('error.fatal.uncaught-exception');

        process.exit(1);
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

        global.logger.info(`Worker ${worker.id} spawned - pid: ${process.pid}`);
        clusterTimeout = undefined;
    });

    cluster.on('online', function(worker) {
        global.logger.info(`Worker ${worker.id} online`);
    });

    cluster.on('listening', function(worker, addr) {
        try {
            global.logger.info(`Worker ${worker.id} listening on ${addr.address}:${addr.port}`);
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
        //global.metrics.increment('error.worker.disconnected');
        setTimeout(function() {
            spawn();
        }, 750);
    });
    var clusterTimeout;
    cluster.on('exit', function(worker, code, signal) {
        global.logger.error('worker ' + worker.id + ' died');
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
    //logParticipantCount();

    var collectMemoryStats = function() {
        var memUsage = process.memoryUsage();
        //global.metrics.gauge('memory.rss', memUsage.rss);
        //global.metrics.gauge('memory.heapTotal', memUsage.heapTotal);
        //global.metrics.gauge('memory.heapUsed', memUsage.heapUsed);
    };
    setInterval(collectMemoryStats, 5000);
    var domain = require('domain');
    var d = domain.create();
    d.run(mainFunction);
    d.on('error', function(err) {
        var memUsage = process.memoryUsage();

        global.opbeat.captureError(err, {
            extra: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed
            }
        });

        global.logger.error('There was an error: ' + err.stack);
        cluster.worker.disconnect();
    });
}
