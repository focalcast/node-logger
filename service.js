HOST = process.env.FOCALCAST_HOST;
PORT = process.env.FOCALCAST_PORT_SERVER;
SOCKET_PORT = process.env.FOCALCAST_PORT_SOCKET;
GET_PRESENTATION_ADDRESS = 'api/presentation/get';
ADDRESS = 'present';
var ROOMNAME = 'focalcast';
var cluster = require('cluster');
var os = require('os');
var express = require('express');
var Session = require('./lib/session.js');
var EventEmitter = require('events').EventEmitter;
var Users = require('./lib/user.js');
var users = new Users();
var VERBOSE = false;
var sio_redis = require("socket.io-redis");
var sio = require('socket.io');
var net = require('net');
var paths = require('./lib/paths.js');
var slack = require('./lib/slackwebhook.js');
var request = require('request');
var safeStringify = require( 'json-stringify-safe' );
var _ = require( 'underscore' );
var path = require('path');
var winston = require('winston');
//winston.remove(winston.transports.Console);
winston.emitErrs = true;
isDefined = function(query){
    if(typeof query !== 'undefined' && query !== null){
        return true;
    }else{
        return false;
    }
};

isUndefined = function(query){
    return !isDefined(query);
};


var timestampFunction = function(){
    return new Date().toUTCString();
};
logger = new (winston.Logger)({
    transports : [
        new (winston.transports.Console)({ 
            level: 'debug',
            colorize : true,
            json: false,
            handleExceptions: true,
            timestamp: timestampFunction
        }),
        new (winston.transports.File)({
            name : 'focalnode-info',
            filename: path.join(__dirname, './logs/focalnode-info.log'),
            level : 'info',
            handleExceptions : true,
            json : true,
            maxsize: 5242880,
            maxFiles: 5,
            colorize: false,
            timestamp : timestampFunction
        }),
        new (winston.transports.File)({
            name : 'focalnode-error',
            filename: path.join(__dirname, './logs/focalnode-error.log'),
            level: 'error',
            timestamp : timestampFunction,
            handleExceptions: true
        }),
        new (winston.transports.File)({
            name : 'focalnode-debug',
            filename : path.join(__dirname, './logs/focalnode-debug.log'),
            level : 'debug',
            colorize : true,
            json: true,
            handleExceptions : true,
            timestamp : timestampFunction
        }),
        new (winston.transports.File)({
            name : 'focalnode-warn',
            filename : path.join(__dirname, './logs/focalnode-warn.log'),
            level : 'warn',
            timestamp : timestampFunction
        })
    ],
    exitOnError: false
});
//logger = require('./mLogger.js')();
sprintf = require('sprintf').sprintf;

new slack( slack.type.connection, ' Node.js started successfully !' );

logger.verbose("Host domain: " + HOST + ", Node server port: " + PORT + " , Socket server port: " + SOCKET_PORT);
var sessions = [];

function addSession( roomname ) {
    var session = _.findWhere( sessions, { room : roomname } );
    if(typeof session === 'undefined' ) {
        var s = new Session();
        s.roomname = roomname;
        sessions.push( s );
    }
}

function getSession ( roomname ) {
    return  _.findWhere( sessions, { 'roomname' : roomname } );
}


function mainFunction(){
    var http = require( 'http' );
    var app = new express();
    //var server = http.Server(app);
    var session = new Session();

    var app_server = app.listen(0, 'localhost');
    io = sio(app_server);
    console.log('\n\n' + process.env.REDIS_ADDR + '\n\n');
    io.adapter(sio_redis({ host: process.env.REDIS_ADDR, port:6379 }));

    //io.adapter(sio_redis({host: HOST, port: PORT}));
    // io.on('error', function(err){
    //     console.log('io error: ' + err);
    // });

    io.use(function(socket, next){
        return next();
        //Unreachable
        var handshakeData = socket.request;

        if(handshakeData.headers.cookie){
            logger.debug('cookie');

            //If we want to check for cookies we can do that here
            return next(null, true);
        }else{
            logger.debug('no cookie');
            //No cookie
            return next(null, true);
        }
    });
    /*

       app.get(ADDRESS, (FUNCTION(REQ, RES){
       RES.WRITEhEAD(200, {
       'aCCESS-cONTROL-aLLOW-oRIGIN' : '*'
       });
       })).ON('ERROR', FUNCTION(ERR){
       CONSOLE.LOG('sWALLOWING ERROR ON "APP.GET":' + ERR);
       });

       app.use(function(req, res, next){
       res.writeHead(200, {
       'Access-Control-Allow-Origin' : '*'
       });
       });
       */
    io.on( 'error', function(err){
        logger.error("Socket error: " + err.stack);
    });
    io.on( 'connection', function (socket){
        socket.roomname = socket.handshake.query.room;
        addSession( socket.roomname );
        socket.join( socket.roomname );

        logger.debug( 'Joining room ' + socket.roomname );
        logger.debug('Socket connected', cluster.worker.id, socket.roomname);
        //Received connection from socket
        socket.emit( 'data', 'connected to worker: ' + cluster.worker.id);

        socket.on( 'send_message', function(message){
            // logger.debug('Got message: ' + message);
            socket.broadcast.to( socket.roomname ).emit( 'incomming', message );
        });

        socket.on('auth', function(message){
            //logger.info('Got auth');
            //logger.info(message);
            getSession( socket.roomname ).setMasterSocket(socket);
            getSession( socket.roomname ).setAuthentication(message);
        });

        socket.on('session_updated', function(){
            getSession( socket.roomname ).updateSessionInfo();
        });

        var FC_ERROR = {
            ROOMNAME : {
                UNDEFINED : 'socket_roomname_undefined',
            }
        };

        socket.on( 'dimen_info', function(message){
            return;
        });

        socket.on( 'error', function(err){
            logger.error('socket error:' + err.stack);
        });

        socket.on( 'identity', function(message){
            var jsonObj = JSON.parse(message);
            if(jsonObj.identity === "android"){
                socket.join(jsonObj.identity);
            }

        });               

        socket.on( 'disconnect', function(reason){
            getSession(socket.roomname).removeParticipant(socket);
            return;
        });
        socket.on( 'reverb', function( message ){
            socket.emit('incomming', message );
        });

        socket.on( 'end_presentation', function( message ){
            socket.session().users.userArray = [];
            session = new Session();
        });

        socket.on( 'add_user', function(data){
            getSession(socket.roomname).addParticipant(socket, data);
            return;
        });

        socket.on( 'user_info', function( message ){
            return;
        });


        socket.on('make_host', function(message){

            //socket.session().users.makeHost(message);
            io.sockets.in( socket.roomname ).emit( 'user_array', socket.session().users.getParticipantList());

        });

        socket.on('connected_event', function(message){
            //io.sockets.in( socket.roomname ).emit( 'user_array', socket.session().users.getParticipantList());

            //if(socket.session().current_presentation){
            //   socket.emit('set_slide', socket.session().getSlideUrl(socket.session().current_slide));
            //}
        });

        socket.on( 'get_userarray', function(message){
            //socket.emit('user_array', socket.session().users.getParticipantList());
        });

        socket.on( 'get_presentation', function(message){
            //socket.emit('load_presentation', socket.session().toJSONString());
        });

        socket.on( 'set_presentation', function(message){
            var _session = getSession(socket.roomname);
            if ( typeof _session !== 'undefined' ) {
                _session.setPresentation( socket, message );
            } else {
                logger.error( 'Session was undefined!' );
            }

        });
        socket.on('get_slide', function(message){
            socket.emit('annotations', getSession(socket.roomname).annotations);
            return;
        });

        socket.on('send_all_to_host', function(message){
            var _session = getSession(socket.roomname);
            if(typeof _session !== 'undefined'){
                _session.setSendAllToMaster();
            }
        });

        socket.on('force_slide', function(message){
            var _session = getSession(socket.roomname);
            if( typeof _session !== 'undefined' ){
                _session.annotationsDirty=true;
                _session.updateSessionInfo();
                _session.emit('set_slide', message );
                logger.debug('Setting slide :' + message, 'Session:', socket.roomname);
            }else{
                logger.debug('Session was undefined');
            }

        });


        socket.on('set_verbosity', function(bool){
            VERBOSE = bool; 
        });

        socket.on('debug_please', function(){
            var fs = require('fs');
            fs.readFile('/opt/python/node/log/watch.log', 'utf8', function(err, data){
                if(err)
                    {
                        socket.emit('debug_info', err);
                    }else{
                        socket.emit('debug_info', data);
                    }
            });
        });

        socket.on('path_part', function(message){
            //socket.broadcast.to(socket.roomname).emit('path_part', message);
            if(isDefined(socket.roomname) && isDefined(getSession(socket.roomname))){
                getSession(socket.roomname).broadcastAnnotations('path_part', message, this);
            }
        });

        socket.on('path', function(message){
            getSession(socket.roomname).addAnnotation(message);
            //request('/api/v1/session/' +session.id+'/presentation/');
            //io.sockets.in( socket.roomname ).emit('end_path', message);
        });
        socket.on('undo', function(){
            getSession(socket.roomname).undoAnnotation();
        });
        socket.on('clear', function(){
            getSession(socket.roomname).clearAnnotations();
        });

    });

    process.on( 'message', function(message, connection){
        if(message === 'socket_connection'){
            try{
                if ( connection ) {
                    //logger.debug(  safeStringify( connection )  );
                    app_server.emit( 'connection', connection );
                    connection.resume();

                } else {
                    logger.warn( 'Process received connection event but connection was not defined' );
                }


            }catch(err){
                new slack( slack.type.error, "Connection error : " + err );
                logger.error( err.stack );
            }
        }
    });

    process.on('uncaughtException', function(err){
        logger.error('error', 'Fatal uncaught exception', err, function(err, level, msg, meta){ process.exit(1);
        });
    });

}
if(cluster.isMaster){
    var worker;
    var spawn = function() {
        logger.info( "spawning new worker" );
        worker = cluster.fork();

    };
    spawn(); 
    cluster.on( 'fork', function( worker ) {
        if(worker.id === 1){
            logger.error('NodeStarted');
        }
        logger.info(sprintf('worker %s spawned', worker.id));
        clusterTimeout=undefined;
    });

    cluster.on( 'online', function( worker ) {
        logger.info(sprintf('worker %s online', worker.id));
        logger.info('Worker ', worker.id, ' is online');
    });

    cluster.on( 'listening', function(worker, addr) {
        logger.log('info', 'worker %s listening on %s:%d', worker.id, addr.address, addr.port);
        try{
            logger.info('Worker ', worker.id, ' listening on ', addr.address, addr.port);
        }catch(exception){
            logger.error('Error logging thing', exception);
        }
    });

    cluster.on( 'disconnect', function( worker ) {
        logger.error('Worker ', worker.id, ' disconnected.', 'Forking new cluster');
        setTimeout(function(){
            //spawn();
        }, 750);
    });
    var clusterTimeout;
    cluster.on( 'exit', function( worker, code, signal ) {
        logger.error('Worker is dead');
        logger.error('worker ' + worker.id + ' died');
        if(typeof clusterTimeout === 'undefined'){
            clusterTimeout=setTimeout(function(){
                if(worker.id < 10){
                    //spawn();
                }else{
                    process.exit(1);
                }
            }, 750);
        }
    });

    var server = net.createServer({ pauseOnConnect: true }, function( connection ) {
        worker.send('socket_connection', connection );
    }).listen(8080);
}else{

    var domain = require( 'domain' );
    var d = domain.create();
    d.run(mainFunction);
    d.on( 'error', function( err ){
        logger.error( 'There was an error: ' + err.stack );
        cluster.worker.disconnect();

    });
}
