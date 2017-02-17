var request = require('request');
var crypto = require('crypto');
var _ = require('underscore');
var Users = require('./users.js');
var User = require('./user.js');
var Host = require('./host.js');
var redis = require('./redis.js');
var Presentation = require('./presentation.js');
var Participants = require('./participants.js');
var slack = require('./slackwebhook.js');
var Q = require('q');
var FocalcastApi = require('./rest/api.js');
var defined = require('defined');
var GaugeTime = require('./gauge-time.js');

var setScopedInterval = function(func, delay, scope) {
    return setInterval(function() {
        func.apply(scope);
    }, delay);
};

var setScopedTimeout = function(func, delay, scope) {
    return setTimeout(function() {
        func.apply(scope);
    }, delay);
};
class Session {
    constructor(roomname, io) {
        this.io = io;
        if(!defined(this.io)) {
            throw new Error('Cannot create session! io is undefined');
        }
        this.roomname = roomname;
        this.api = new FocalcastApi(undefined, undefined, roomname);
        // this.api = new FocalcastApi();
        this.FocalcastToggleState = false;
        this._presentation = new Presentation(this);
        this.roomhash = this.getRoomHash();
        this.participants = new Participants(this);
        this.screenShareEnabled = false;
        // this.metrics = new Metrics('session');
        // this.metricsError = new Metrics('session.error');
        // this.metrics.increment('session_created');
        this.active = false;
        var self = this;
        redis.redisPub.hset(this.getHash(), 'roomname', roomname, function(err, res) {
            // if(err) {
            //     global.logger.error(err);
            // }
            // else {
            //     global.logger.debug(res[self.roomhash]);
            // }
        });
        // global.logger.debug('Session created');
        this.pollActiveParticipants();
    }
    set presentation(session) {
        this._presentation.data = session;
    }
    get presentation() {
        return this._presentation;
    }
    set session(session) {
        this._session = session;
        this.emit('session_info', session);
        this.presentation = session;
    }
    get session() {
        return this._session;
    }
}


Session.prototype.pollActiveParticipants = function() {
    this.participants.setAllInactive();
    var inactiveParticipants = this.participants.getInactive();
    for(var i = 0; i < inactiveParticipants.length; i++) {
        this.io.to(inactiveParticipants[i].socket_id).emit('poll_active');
    }
    // this.emit('poll_active');
    if(defined(this.removeInactiveTimeout)) {
        clearTimeout(this.removeInactiveTimeout);
    }
    var deferred = Q.defer();
    var self = this;
    self.removeInactiveTimeout = setTimeout(()=> {
        self.removeInactive(deferred);
        self.pollActiveParticipants();
    }, 20000);
    self.pollCount++;

};

Session.prototype.removeInactive = function() {
    if(!defined(this.session) || !this.session.hasOwnProperty('participants')) {
        return;
    }

    var node_participants = this.participants.get();

    // global.logger.debug('participants django:', this.session.participants.length, 'participants node:', node_participants.length);
    var self = this;
    var cb = function(roomname, uuid) {
        return function(err, response, body) {
            global.logger.debug(`Session: ${roomname} --`, 'Removed', uuid, 'Reason: Inactivity');
            self.update(true);

        };
    };
    var cbError = function(roomname, uuid){
        return function(err, response, body){
            if(defined(response) && response.hasOwnProperty('statusCode') && (response.statusCode === 503 || response.statusCode === 500 || response.statusCode === 401)){
                self.participants.removeByUuid(uuid);
            }else{
                global.logger.warn(`Session: ${roomname} -- Error removing participant ${uuid}`, err, response.statusCode );
            }
        }
    };

    for(let i = 0; i < this.session.participants.length; i++) {
        let _participant = JSON.parse(JSON.stringify(this.session.participants[i]));
        // global.logger.debug('is active', _participant.uuid);
        var isActive = _.findWhere(node_participants, {
            uuid: _participant.uuid
        });
        if(!defined(isActive)) {
            // global.logger.debug('1');
            this.api.participants(_.clone(_participant.uuid), cb(this.roomname, _participant.uuid), cbError(this.roomname, _participant.uuid)).remove();
        }
    }
    for(let i = 0; i < node_participants.length; i++) {
        let _participant = _.clone(node_participants[i]);
        var inactive = _.findWhere(this.session.participants, {
            uuid: _participant.uuid
        });
        if(!defined(inactive)) {
            if(!_participant.active) {
                // global.logger.debug('2');
                this.io.to(_participant.socket_id).emit('remote_disconnect', 'Inactivity');
                this.participants.disconnect(_participant.socket_id, 'Inactivity');
                this.participants.remove(_participant.socket_id);
            }
            else {
                logger.warn(`Session: ${this.roomname} --`, 'Participant is active, but is not in session model. Signaling to reactivate participant.');
                this.io.to(_participant.socket_id).emit('deactivate_participant');
                self.update(true);
            }
        }
    }
    this.update();
};


Session.prototype.addUser = function(socket) {
    new User(this, socket);
};

Session.prototype.userJoined = function() {
    if(defined(this.host)) {
        this.host.send('user_joined');
    }
};

Session.prototype.getHash = function() {
    var hash = this.roomhash;
    for(var arg in arguments) {
        var hashArg = arguments[arg];
        if(typeof hashArg === 'string') {
            hash = hash + '#' + arguments[arg];
        }
    }
    return hash;
};

Session.prototype.retrieveSession = function() {
    redis.redisPub.hgetall(this.getHash(), function(err, obj) {
        if(err) {
            global.logger.error('Redis pub error', err);
        }
        else {
            for(var res in obj) {
                //global.logger.info(res, obj[res]);
            }
        }
    });
    redis.redisPub.hgetall(this.getHash('participant'), function(err, obj) {
        if(err) {
            global.logger.error('Redis pub error', err);
        }
        else {
            for(var res in obj) {
                //global.logger.info(res, obj[res]);
            }
        }
    });
};
Session.prototype.publish = function() {

    redis.redisSub.subscribe(this.roomhash, function(channel, message) {
        global.logger.debug('Subscribe', channel, message);
    });
    redis.redisSub.on('message', function(channel, msg) {
        global.logger.debug('Message', msg);
    });
    //redis.redisPub.publish(this.roomhash, 'hello');
};
Session.prototype.setHost = function(socket, auth) {
    if(defined(this.host)) {
        this.host.unsetListeners();
        delete this.host;
    }
    this.host = new Host(this, socket);
    this.host.authentication = auth;
};
Session.prototype.getRoomHash = function() {
    return crypto.createHash('md5').update(this.roomname).digest('hex');
};


Session.prototype.getCurrentPresentation = function() {
    return this.session.current_presentation;
};


Session.prototype.getSessionUsid = function() {
    return this.session.usid;
};

Session.prototype.self = function() {
    return this;
};

Session.prototype.update = function(force) {
    if(this.active) {
        var self = this;
        var deferred = Q.defer();
        var success = function(body) {
            var session = JSON.parse(body);
            self.session = session;
            return;
        };
        var error = function(error, response) {
            if(defined(response) && response.hasOwnProperty('statusCode')) {
                if(response.statusCode === 401) {
                    self.reverbGetAuth(response, self.update);
                    //Unauthorized access, set end session timeout
                    self.active = false;
                    self.setEndSessionTimeout(self.host.socket);
                }
                if(response.statusCode === 404) {
                    self.active = false;
                    self.endSession(self.host.socket);
                }
                global.logger.error(error);
                global.logger.error(`Session: ${self.roomname} --`, 'Error updating session info:', response.statusCode, response.statusMessage);
            }
            else {
                global.logger.error(error);
                self.active = false;
                global.logger.error(`Session: ${self.roomname} --`, 'Error updating session info');
            }
            return;
        };
        if(force) {
            //We don't want to spam the server with session update requests
            // global.logger.debug('Forcing update');
            // global.logger.info('update session info:', 'session uuid', self.roomname);
            self.api.session(success, error).get();
        }
        else if(!defined(self.updateSessionTimeout) && self.active) {
            //We don't want to spam the server with session update requests
            self.updateSessionTimeout = setTimeout(function() {
                // global.logger.info('update session info:', 'session uuid', self.roomname);
                self.api.session(success, error).get();
                self.updateSessionTimeout = undefined;
            }, 3000);
        }
    }
};

Session.prototype.retrieveFocalcastToggleState = function(socket) {
    var message = this.FocalcastToggleState ? 'focalcast_open' : 'focalcast_close';
    socket.emit('focalcast_pexip', message);
    socket.emit('pexip::is_screenshare_enabled', this.screenShareEnabled);

};

Session.prototype.setEndSessionTimeout = function(socket) {
    var self = this;
    if(this.endSessionTimeout) {
        clearTimeout(this.endSessionTimeout);
    }
    this.endSessionTimeout = setTimeout(function() {
        self.endSession(socket, true);
    }, 600000);
    global.logger.debug(`Session: ${this.roomname} --`, 'End session timeout set');
};
Session.prototype.clearEndSessionTimeout = function() {
    if(defined(this.endSessionTimeout)) {
        clearTimeout(this.endSessionTimeout);
        global.logger.debug(`Session: ${this.roomname} --`, 'End session timeout reset');
    }
};
Session.prototype.removeParticipant = function(socket, participant) {
    var self = this;
    var participant_uuid;
    var removeParticipant = function(socket) {
        self.participants.remove(socket.id);
        if(self.host.is(socket)) {
            self.setEndSessionTimeout(socket);
        }
    };
    try {

        participant = this.participants.retrieve(socket.id);
        if(participant && participant.socket_id !== socket.id) {
            participant_uuid = participant.uuid;
        }
        else if(participant) {
            if(this.participants.duplicates(participant.uuid)) {
                self.participants.remove(socket.id);
                return;
            }
            else {
                participant_uuid = participant.uuid;
                self.participants.remove(socket.id);
            }
        }

    }
    catch(err) {
        let error = function() {
            global.logger.error(`Session: ${self.roomname} --`, 'Could not remove participant');
        };
        redis.redisPub.hget(self.getHash('participant'), socket.id, function(err, res) {
            if(err) {
                global.logger.error(`Session: ${self.roomname} --`, 'Could not retrieve participant from cache');
            }
            else {
                self.api.participants(res, success, error).remove();
            }
        });
    }
    var success = function(body) {
        global.logger.debug(`Session: ${self.roomname} --`, 'Successfully removed participant', participant_uuid, socket.id, `-- Total Participants ${self.participants.get().length}`);
        try {
            removeParticipant(socket);
            redis.redisPub.hdel(self.getHash('participant'), socket.id, participant_uuid);
        }
        catch(err) {
            global.logger.error(err);
        }
        // self.metrics.increment('participant_removed');
        try {
            self.update();
        }
        catch(err) {

        }
        try {
            var message = this.roomname + ' : participant id' + participant_uuid;
            new slack(slack.type.logout, message);
        }
        catch(err) {
            global.logger.error('Error sending slack webhook', err);
        }
    };
    let error = function(error, response) {
        let statusCode = defined(response) ? response.statusCode : '';
        let statusMessage = defined(response) ? response.statusMessage: '';
        global.logger.error(`Session: ${self.roomname} --`, 'Error removing participant ', statusCode, statusMessage);


    };

    if(participant_uuid) {
        this.api.participants(participant_uuid, success, error).remove();
    }
    else {
        var socketid = 'undefined';
        var uuid = 'undefined';
        if(defined(participant)){
            uuid = participant.uuid;
        }
        if(defined(socket)){
            socketid = socket.id;
        }
        try {
            global.logger.error(`Session: ${this.roomname} --`, 'Remove participant: Socket participant was undefined', `-- Uuid: ${uuid} -- Socket Id: ${socketid}`);
        }catch(err){
            global.logger.error('Error loggin error', err);
        }
    }
};

/**
 * Retrieve list of session participants.
 */
Session.prototype.listParticipants = function() {
    var self = this;
    var success = function(body) {
        var participants = JSON.parse(body);
        self.participants.filter(participants);
        /**
         * Emit participant list to users
         */
        self.emit('participants', self.participants);
    };
    var error = function(error, response) {
        global.logger.error('Error retrieving participants', response.statusCode, response.statusMessage, response);

    };
    this.api.participants(success, error).get();
};

/**
 * Emits a message to all users currently connected to the socket.
 */
Session.prototype.emit = function(event, message) {
    this.io.sockets.in(this.roomname).emit(event, message);
};

Session.prototype.broadcast = function(event, message, socket) {
    socket.broadcast.to(this.roomname).emit(event, message);
};


Session.prototype.reverbGetAuth = function(response, callback) {
    var self = this;
    try {
        if(defined(response, response.statusCode, this.host)) {
            if(response.statusCode === 401) {
                self.io.to(self.host.id).emit('need_auth');
                var gotAuth = function(message) {
                    self.host.authentication = message;
                    callback();
                    self.host.socket.removeListener('auth_renew', gotAuth);
                };
                this.host.socket.on('auth_renew', gotAuth);
            }
        }
    }
    catch(err) {
        global.logger.error(`Session: ${self.roomname} -- Error setting auth -- ${err}`);
    }
};

Session.prototype.endSession = function(socket, call) {
    if(this.host.is(socket)) {
        this.active = false;
        if(defined(this.recorder) && this.recorder.connected) {
            global.logger.debug(`Session: ${this.roomname} -- Disconnecting video recorder.`);
            this.recorder.disconnect();
            this.recorder = undefined;
        }
        clearTimeout(this.updateSessionTimeout);
        this.participants.disconnectAllParticipants();
        if(call) {
            var self = this;
            var success = function(body) {
                global.logger.info(`Session: ${self.roomname} -- Stopped session`);
            };
            var error = function(error, response) {
                global.logger.error(`Session: ${self.roomname} -- Failed to stop session -- Reason: ${response.statusMessage}`);
            };
            this.api.session(success, error).stop();
        }
    }

};


module.exports = Session;
