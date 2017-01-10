var request = require('request');
var crypto = require('crypto');
var Slide = require('./slide.js');
var _ = require('underscore');
var Users = require('./user.js');
var Participants = require('./participants.js');
var slack = require('./slackwebhook.js');
var Q = require('q');
var FocalcastApi = require('./rest/api.js');
var defined = require('defined');

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
var Session = function(roomname) {
    this.session = {};
    this.roomname = roomname;
    this.api = new FocalcastApi(undefined, undefined, roomname);
    // this.api = new FocalcastApi();
    this.annotationsDirty = true;
    this.slideDirty = false;
    this.sendAllToMaster = false;
    this.FocalcastToggleState = false;
    this.roomhash = this.getRoomHash();
    this.participants = new Participants(this);
    this.screenShareEnabled = false;
    this.metrics = new Metrics('session');
    this.metricsError = new Metrics('session.error');
    this.metrics.increment('session_created');
    var self = this;
    redisPub.hset(this.getHash(), 'roomname', roomname, function(err, res) {
        if(err) {
            global.logger.error(err);
        }
        else {
            global.logger.debug(res[self.roomhash]);
        }
    });
    global.logger.debug('Session created');
    this.pollActiveParticipants();
};

Session.prototype.pollActiveParticipants = function() {
    this.participants.setAllInactive();
    var inactiveParticipants = this.participants.getInactive();
    for(var i = 0; i < inactiveParticipants.length; i++) {
        io.to(inactiveParticipants[i].socket_id).emit('poll_active');
    }
    // this.emit('poll_active');
    if(defined(this.removeInactiveTimeout)) {
        clearTimeout(this.removeInactiveTimeout);
    }
    var deferred = Q.defer();
    this.removeInactiveTimeout = setTimeout((function() {
        this.removeInactive(deferred);
    }).bind(this), 10000);
    var self = this;
    deferred.promise.then((function(resolve) {
        self.pollActiveParticipants();
    }).bind(this));
};

Session.prototype.removeInactive = function(defer) {
    if(!this.session.hasOwnProperty('participants')) {
        return;
    }
    var node_participants = this.participants.get();

    // global.logger.debug('participants django:', this.session.participants.length, 'participants node:', node_participants.length);

    var cb = function(roomname, uuid) {
        return function() {
            global.logger.debug('Session:', roomname, 'Removed', uuid, 'Reason: Inactivity');
        };
    };
    for(let i = 0; i < this.session.participants.length; i++) {
        let _participant = JSON.parse(JSON.stringify(this.session.participants[i]));
        // global.logger.debug('is active', _participant.uuid);
        var isActive = _.findWhere(node_participants, {
            uuid: _participant.uuid
        });
        if(!defined(isActive)) {
            this.api.participants(_.clone(_participant.uuid), cb(this.roomname, _participant.uuid)).remove();
        }
    }
    for(let i = 0; i < node_participants.length; i++) {
        let _participant = _.clone(node_participants[i]);
        var inactive = _.findWhere(this.session.participants, {
            uuid: _participant.uuid
        });
        if(!defined(inactive)) {
            if(!_participant.active) {
                io.to(_participant.socket_id).emit('remote_disconnect', 'Inactivity');
                this.participants.disconnect(_participant.socket_id, 'Inactivity');
                this.participants.remove(_participant.socket_id);
            }
            else {
                logger.warn('Participant is active, but is not in session model');
            }
        }
    }
    this.updateSessionInfo();
    defer.resolve('resolve');
};


Session.prototype.onSocketConnected = function(socket) {
    var self = this;
    this.initPexipListeners(socket);
    socket.once('active', function() {
        self.participants.setActive(socket.id);
    });
    this.userJoined();
};

Session.prototype.userJoined = function() {
    if(defined(this.masterSocket)) {
        this.sendToMaster('user_joined');
    }
};

Session.prototype.setMasterSocketListeners = function() {
    var self = this;
    this.masterSocket.emit('get_participant_data');
    this.masterSocket.on('get_active_users', function() {
        self.broadcast('poll_active', '', self.masterSocket);
    });
};

Session.prototype.initPexipListeners = function(socket) {
    var self = this;

    socket.on('pexip::set_screenshare', function(enabled) {
        if(typeof enabled === 'boolean') {
            self.screenShareEnabled = enabled;
        }
        self.emit('pexip::is_screenshare_enabled', self.screenShareEnabled);
    });
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
    redisPub.hgetall(this.getHash(), function(err, obj) {
        if(err) {
            global.logger.error('Redis pub error', err);
        }
        else {
            for(var res in obj) {
                //global.logger.info(res, obj[res]);
            }
        }
    });
    redisPub.hgetall(this.getHash('participant'), function(err, obj) {
        if(err) {
            global.logger.error('Redis pub error', err);
        }
        else {
            global.logger.debug('Retrieving session');
            for(var res in obj) {
                //global.logger.info(res, obj[res]);
            }
        }
    });
};
Session.prototype.publish = function() {

    redisSub.subscribe(this.roomhash, function(channel, message) {
        global.logger.debug('Subscribe', channel, message);
    });
    redisSub.on('message', function(channel, msg) {
        global.logger.debug('Message', msg);
    });
    redisPub.publish(this.roomhash, 'hello');
};

Session.prototype.getRoomHash = function() {
    return crypto.createHash('md5').update(this.roomname).digest('hex');
};

Session.prototype.setAuthentication = function(message) {
    //global.logger.debug('Setting Authentication:', JSON.stringify(message));
    var node_auth = message;
    this.setPrimaryUser(node_auth.owner);
    this.setSendAllToMaster(node_auth.owner.send_all_to_host);
    this.setSession(node_auth.session);
    this.api.auth.token = node_auth.token;
    redisPub.hmset(this.getHash(), {
        'token': node_auth.token,
        'owner': node_auth.owner.email,
        'send_all_to_host': node_auth.owner.send_all_to_host,
        'usid': node_auth.session.usid
    });
    this.updateSessionInfo();
    this.emit('poll_active');

};

Session.prototype.setToken = function(token) {
    if(typeof this.session !== 'undefined') {
        this.session.token = token;
        this.api.auth.token = token;
        redisPub.hset(this.getRoomHash(), 'token', this.api.auth.token);
        //this.retrieveSession();
    }
};

Session.prototype.getCurrentPresentation = function() {
    return this.session.current_presentation;
};


Session.prototype.getSessionUsid = function() {
    return this.session.usid;
};

Session.prototype.setSession = function(_session) {
    if(typeof _session === 'undefined') {
        global.logger.error('SetSession: Session was undefined');
    }
    this.session = _session;
    //global.logger.debug('Session set: ', this.session);

};

Session.prototype.getPresentation = function() {
    return this.session.presentation;
};

Session.prototype.getSlides = function() {
    return this.session.presentation.slides;
};

Session.prototype.getPresentationLength = function() {
    return this.getSlides().length;
};

Session.prototype.setPrimaryUser = function(user) {
    this.owner = user;
    this.api.auth.owner = user;
};
Session.prototype.isMaster = function(socket) {
    return this.masterSocket.id === socket.id;
};

Session.prototype.setMasterSocket = function(socket) {
    this.masterSocket = socket;
    this.setMasterSocketListeners();
    redisPub.hset(this.getHash(), 'masterSocket', socket.id);
    this.clearEndSessionTimeout();
};

Session.prototype.sendToMaster = function(event, message) {
    try {
        if(this.masterSocket) {
            io.to(this.masterSocket.id).emit(event, message);
        }
    }
    catch(err) {}
};



Session.prototype.getSlideUrl = function(slide_number) {
    var slide = _.findWhere(this.slides, {
        'slide_number': slide_number
    });
    if(typeof slide === 'undefined') {
        return 'https://i.imgur.com/OqQiSXv.jpg';
    }
    else {
        return slide.slide_url;
    }
};

Session.prototype.self = function() {
    return this;
};

Session.prototype.shouldUpdateSlide = function(slide) {
    if(slide === null) {
        return false;
    }
    if(typeof(slide) === 'undefined' || !slide.hasOwnProperty('url') || !slide.hasOwnProperty('number')) {
        global.logger.warn('Invalid slide object:', slide);
        return false;
    }
    if((typeof(this.session.current_slide) === 'undefined' ||
            this.session.current_slide === null) &&
        (typeof(slide.url) !== 'undefined' &&
            slide.hasOwnProperty('url') &&
            slide.hasOwnProperty('number'))
    ) {
        this.annotationsDirty = true;
        this.slideDirty = true;
        this.session.current_slide = slide;
        return true;
    }
    else {
        try {
            if(slide.url !== this.session.current_slide.url) {
                this.annotationsDirty = true;
                this.slideDirty = true;
                this.session.current_slide = slide;
                return true;
            }
        }
        catch(err) {
            global.logger.warn('Error checking to update slide', err);
            return false;
        }
    }
    return false;
};

Session.prototype.updateSlide = function(slide) {
    if(typeof(this.session.current_slide) !== 'undefined' && typeof(this.session.current_slide) !== 'undefined') {
        this.emit('clear');
        this.emit('set_slide', this.session.current_slide.url);
    }
    else {
        global.logger.warn('Cannot update slide. Was undefined');
    }
};

Session.prototype.updateSessionInfo = function() {
    var self = this;
    var deferred = Q.defer();
    var success = function(body) {
        var session = JSON.parse(body);
        self.shouldUpdateSlide(session.current_slide);
        self.session = session;
        self.emit('session_info', self.session);
        try {
            if(self.slideDirty && defined(self.session.presentation, self.session.current_slide)) {
                self.getAnnotations();
                self.slideDirty = false;
                self.annotationsDirty = false;
            }
        }
        catch(e) {}
        return;
    };
    var error = function(error, response) {
        global.logger.error('Session:', self.roomname, 'Error updating session info:', response.statusCode, response.statusMessage);
        return;
    };
    if(typeof self.updateSessionTimeout === 'undefined') {
        //We don't want to spam the server with session update requests
        self.updateSessionTimeout = setTimeout(function() {
            // global.logger.info('update session info:', 'session uuid', self.roomname);
            self.api.session(success, error).get();
            self.updateSessionTimeout = undefined;
        }, 2000);
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
    }, 120000);
    global.logger.debug('Session:', this.roomname, 'End session timeout set');
};
Session.prototype.clearEndSessionTimeout = function() {
    if(defined(this.endSessionTimeout)) {
        clearTimeout(this.endSessionTimeout);
        global.logger.debug('Session:', this.roomname, 'End session timeout reset');
    }
};
Session.prototype.removeParticipant = function(socket, participant) {
    var self = this;
    var participant_uuid;
    var removeParticipant = function(socket) {
        self.participants.remove(socket.id);
        if(self.isMaster(socket)) {
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
        var error = function() {
            global.logger.error('Could not remove participant');
        };
        redisPub.hget(self.getHash('participant'), socket.id, function(err, res) {
            if(err) {
                global.logger.error('Could not retrieve participant from cache');
            }
            else {
                self.api.participants(res, success, error).remove();
            }
        });
    }
    var success = function(body) {
        global.logger.debug('Successfully removed participant', participant_uuid, socket.id);
        try {
            removeParticipant(socket);
            redisPub.hdel(self.getHash('participant'), socket.id, participant_uuid);
        }
        catch(err) {
            global.logger.error(err);
        }
        self.metrics.increment('participant_removed');
        try {
            self.updateSessionInfo();
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
    var error = function(error, response) {
        global.logger.error('Error removing participant ', response.statusCode, response.statusMessage);

    };

    if(participant_uuid) {
        this.api.participants(participant_uuid, success, error).remove();
    }
    else {
        global.logger.error('Remove participant: Socket participant was null');
    }
};

Session.prototype.addParticipant = function(socket, participant) {
    var self = this;

    self.participants.add(socket.id, participant.uuid);
    redisPub.hset(self.getHash('participant'), socket.id, participant.uuid);
    redisPub.hmset(self.getHash('participant', participant.uuid), {
        'email': participant.email,
    });
    self.metrics.increment('partcipant_added');
    self.updateSessionInfo();
    try {
        new slack(slack.type.login, 'User login :' + JSON.stringify(participant));
    }
    catch(err) {
        global.logger.error(err);
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

Session.prototype.setSendAllToMaster = function(send_to_all) {
    this.sendAllToMaster = send_to_all;
};


/**
 * Emits a message to all users currently connected to the socket.
 */
Session.prototype.emit = function(event, message) {
    io.sockets.in(this.roomname).emit(event, message);
};

Session.prototype.broadcast = function(event, message, socket) {
    socket.broadcast.to(this.roomname).emit(event, message);
};

/**
 * Creates an annotation object consisting of a sessions usid, presention uuid and slide number
 *
 * @returns annotation {
 *              session : uuid,
 *              presentation : uuid,
 *              slide : int
 *              }
 *@throws {exception}
 */
Session.prototype.createAnnotationObject = function(_presentation, _slide) {
    if(typeof this.session.presentation === 'undefined' ||
        this.session.presentation === null ||
        this.session.current_slide === null) {
        throw new Error('Cannot add annotation. No presentation set.');
    }
    try {
        var annotation = {
            session: this.getSessionUsid(),
            presentation: _presentation || this.session.presentation.uuid,
            slide: _slide || this.session.current_slide.number
        };
        return annotation;
    }
    catch(err) {
        if(err instanceof Error) {
            throw new Error('Error creating annotation object: ' + err.message);
        }
        this.metricsError.increment('creating_annotation');
    }
};

Session.prototype.addAnnotation = function(path) {
    var self = this;
    var success = function(body) {
        self.annotationsDirty = true;
        self.metrics.increment('added_annotation');
    };
    var error = function(error, response) {
        global.logger.error('Error submitting annotation:', response.statusCode, response.statusMessage);
    };

    try {
        var annotation = this.createAnnotationObject();
        this.api.annotations(success, error).add(annotation, path);
    }
    catch(err) {
        global.opbeat.captureError(err, {
            extra: {
                message: 'Error adding annotation',
                session: this.roomname
            }
        });
        if(err instanceof Error) {
            global.logger.error('Error adding annotation', err.message);
        }
        else {
            global.logger.error('Error adding annotation');
        }
    }
};

var GaugeTime = function() {
    this.startTime = new Date().getTime();
    var self = this;
    this.end = function() {
        var endTime = new Date().getTime();
        return endTime - this.startTime;
    };
};

/**
 * Get annotations for the current slide.
 */
Session.prototype.getAnnotations = function() {
    if(this.session.presentation === null ||
        typeof(this.session.presentation) === 'undefined') {
        global.logger.warn('Cannot get annotations', this.session.presentation);
        return;
    }
    var timer = new GaugeTime();
    var self = this;
    var success = function(body) {
        self.annotations = JSON.parse(body);
        self.emitAnnotations('clear');
        self.emitAnnotations('annotations', self.annotations);
        self.metrics.histogram('annotations_retrieval_time', timer.end(), self.annotations.length);
    };
    var error = function(error, response) {
        if(typeof response !== 'undefined') {
            self.metricsError.increment('retrieving_annotations');
            global.logger.error('Error retrieving annotations:', response.statusCode, response.statusMessage);
        }
    };
    if(this.annotationsDirty) {
        this.annotationsDirty = false;
        try {
            var annotation = this.createAnnotationObject(this.presentation_uuid, this.slide_number);
            this.api.annotations(success, error).get(annotation);
        }
        catch(err) {
            global.logger.error('Error getting annotations', err);
            global.opbeat.captureError(err, {
                extra: {
                    message: 'Error retrieving annotations',
                    session: this.roomname
                }
            });
        }
    }
    else {
        if(defined(this.annotations)) {
            self.emitAnnotations('clear');
            self.emitAnnotations('annotations', this.annotations);
        }
    }
};

Session.prototype.retrieveSlideAnnotations = function(socket) {
    if(this.session.presentation === null ||
        typeof(this.session.presentation) === 'undefined') {
        global.logger.warn('Cannot retrieve annotations', this.session.presentation);

        return;
    }
    var timer = new GaugeTime();
    var self = this;
    var success = function(body) {
        self.annotations = JSON.parse(body);
        global.logger.debug('Got annotations', self.annotations.annotations.length);

        global.logger.debug('Retrieve Annotations. Emmiting annotations');
        socket.emit('clear');
        socket.emit('annotations', self.annotations);
        self.metrics.histogram('annotations_retrieval_time', timer.end(), self.annotations.length);
    };
    var error = function(error, response) {
        if(typeof response !== 'undefined') {
            self.metricsError.increment('retrieving_annotations');
            global.logger.error('Error retrieving annotations:', response.statusCode, response.statusMessage);
        }
    };
    if(this.annotationsDirty) {
        global.logger.debug('Annotations dirty');
        this.annotationsDirty = false;
        try {
            var annotation = this.createAnnotationObject(this.presentation_uuid, this.slide_number);
            this.api.annotations(success, error).get(annotation);
        }
        catch(err) {
            global.logger.error('Error getting annotations', err);
        }
    }
    else {
        if(defined(this.annotations)) {
            global.logger.info('Annotations not dirty', this.annotations.length);
            socket.emit('clear');
            socket.emit('annotations', this.annotations);
        }
    }
};


Session.prototype.emitAnnotations = function(event, message) {
    try {
        if(this.sendAllToMaster) {
            this.sendToMaster(event, message);
        }
        else {
            this.emit(event, message);
        }
    }
    catch(error) {
        global.logger.error('Errror emitting annotation', error);
    }
};


Session.prototype.broadcastAnnotations = function(event, message, socket) {
    try {
        if(this.sendAllToMaster) {
            if(socket.id !== this.masterSocket.id) {
                this.sendToMaster(event, message);
            }
        }
        else {
            this.broadcast(event, message, socket);
        }
    }
    catch(error) {
        global.logger.error('Error broadcasting annotations', error);
    }
};



/**
 * Performs api call to undo an annotation
 *
 * @returns {undefined}
 */

Session.prototype.undoAnnotation = function() {
    var self = this;
    var success = function(body) {
        self.emit('undo');
        global.logger.debug('Undo annotation');
        self.metrics.increment('undo_annotation');
    };
    var error = function(error, response, options) {
        global.logger.debug('Error on undo', response.statusCode, response.statusMessage);
    };
    try {
        var annotation = this.createAnnotationObject();
        this.api.annotations(success, error).undo(annotation);
    }
    catch(err) {
        global.logger.error('Cannot perform undo', err);
    }

};

Session.prototype.reverbGetAuth = function(response, callback) {
    var self = this;
    if(defined(response, response.statusCode, this.masterSocket)) {
        if(response.statusCode === 401) {
            io.to(this.masterSocket.id).emit('need_auth');
            var gotAuth = function(message) {
                self.setAuthentication(message);
                callback();
                self.masterSocket.removeListener('auth_renew', gotAuth);
            };
            this.masterSocket.on('auth_renew', gotAuth);
        }
    }
};


Session.prototype.clearAnnotations = function() {
    var self = this;
    var success = function(body) {
        self.emit('clear');
        global.logger.debug('clear success');
        self.metrics.increment('clear_annotations');
    };
    var error = function(error, response) {
        global.logger.error('Error on clear annotations:', response.statusCode, response.statusMessage);

    };
    try {
        var annotation = this.createAnnotationObject();
        this.api.annotations(success, error).clear(annotation);
    }
    catch(err) {
        global.logger.error('Cannot clear annotations.', err);
    }
};



Session.prototype.setSlide = function(message) {

};

Session.prototype.endSession = function(socket, call) {
    if(socket.id === this.masterSocket.id) {
        this.participants.disconnectAllParticipants();
        if(call) {
            var self = this;
            var success = function(body) {
                global.logger.info('Session', self.roomname, 'stopped');
            };
            var error = function(error, response) {
                global.logger.error('Failed to stop session', self.roomname, 'reason:', response.statusMessage);
            };
            this.api.session(success, error).stop();
        }
    }

};


module.exports = Session;
