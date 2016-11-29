var request = require('request');
var crypto = require('crypto');
var Slide = require('./slide.js');
var _ = require('underscore');
var Users = require('./user.js');
var Participants = require('./participants.js');
var slack = require('./slackwebhook.js');
var Q = require('q');
var FocalcastApi = require('./rest/api.js');



var Session = function(roomname) {
    this.roomname = roomname;
    this.api = FocalcastApi;
    this.annotationsDirty = true;
    this.slideDirty = false;
    this.sendAllToMaster = false;
    this.focalcastToggleState = false;
    this.roomhash = this.getRoomHash();
    this.participants = new Participants();
    this.screenShareEnabled = false;
    this.metrics = new Metrics('session');
    this.metricsError = new Metrics('session.error');
    this.metrics.increment('session_created');
    var self = this;
    redisPub.hset(this.getHash(), 'roomname', roomname, function(err, res) {
        if(err) {
            logger.error(err);
        }
        else {
            logger.debug(res[self.roomhash]);
        }
    });
    // this.retrieveSession();

};

Session.prototype.onSocketConnected = function(socket){
    this.initPexipListeners(socket);
};

Session.prototype.initPexipListeners = function(socket){
    socket.on('pexip::set_screenshare', function(enabled) {
        if(typeof enabled === 'boolean') {
            this.screenShareEnabled = enabled;
        }
        this.emit('pexip::is_screenshare_enabled', this.screenShareEnabled);
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
            logger.error('Redis pub error', err);
        }
        else {
            for(var res in obj) {
                //logger.info(res, obj[res]);
            }
        }
    });
    redisPub.hgetall(this.getHash('participant'), function(err, obj) {
        if(err) {
            logger.error('Redis pub error', err);
        }
        else {
            logger.debug('Retrieving session');
            for(var res in obj) {
                //logger.info(res, obj[res]);
            }
        }
    });
};
Session.prototype.publish = function() {

    redisSub.subscribe(this.roomhash, function(channel, message) {
        logger.debug('Subscribe', channel, message);
    });
    redisSub.on('message', function(channel, msg) {
        logger.debug('Message', msg);
    });
    redisPub.publish(this.roomhash, 'hello');
};

Session.prototype.getRoomHash = function() {
    return crypto.createHash('md5').update(this.roomname).digest('hex');
};

Session.prototype.setAuthentication = function(message) {
    //logger.debug('Setting Authentication:', JSON.stringify(message));
    var node_auth = message;
    this.setPrimaryUser(node_auth.owner);
    this.setSendAllToMaster(node_auth.owner.send_all_to_host);
    this.setSession(node_auth.session);
    this.api.session.setAuthentication(node_auth.token);
    redisPub.hmset(this.getHash(), {
        'token': node_auth.token,
        'owner': node_auth.owner.email,
        'send_all_to_host': node_auth.owner.send_all_to_host,
        'usid': node_auth.session.usid
    });
    this.updateSessionInfo();

};

Session.prototype.setToken = function(token) {
    if(typeof this.session !== 'undefined') {
        this.session.token = token;
        this.api.session.setAuthentication(token);
        redisPub.hset(this.getRoomHash(), 'token', this.session.token);
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
    if(typeof _session == 'undefined') {
        logger.error('SetSession: Session was undefined');
    }
    this.session = _session;
    //logger.debug('Session set: ', this.session);

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
    this.api.session.setOwner(user);
};

Session.prototype.setMasterSocket = function(socket) {
    this.masterSocket = socket;
    redisPub.hset(this.getHash(), 'masterSocket', socket.id);
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
        return "https://i.imgur.com/OqQiSXv.jpg";
    }
    else {
        return slide.slide_url;
    }
};

Session.prototype.self = function() {
    return this;
};

Session.prototype.shouldUpdateSlide = function(slide){
    if(typeof(slide) === 'undefined' && slide.hasOwnProperty('url') && slide.hasOwnProperty('number')){
        logger.warn('Invalid slide object:', slide);
        return false;
    }
    if(slide.url !== this.session.current_slide.url){
        this.annotationsDirty = true;
        this.slideDirty = true;
        this.session.current_slide = slide;
        return true;
    }
    return false;
};

Session.prototype.updateSlide = function(slide){
    this.emit('clear');
    this.emit('set_slide', this.session.current_slide.url);
    //this.slideDirty = false;
    //logger.debug('Setting slide: ' + slide, 'Session:', this.roomname);
};

Session.prototype.updateSessionInfo = function() {
    var self = this;
    var deferred = Q.defer();
    var successCallback = function(body) {
        var session = JSON.parse(body);
        self.shouldUpdateSlide(session.current_slide);
        self.session = session;
        self.slideDirty = false;
        self.emit('Updated session info:', self.session);
        try {
            if(self.annotationsDirty && isDefined(self.session.presentation) && isDefined(self.session.current_slide)) {
               self.getAnnotations();
               self.annotationsDirty = false;
            }
        }
        catch(e) {}
        return;
    };
    var errorCallback = function(error, response) {
        logger.error('Error updating session info:', response.statusCode, response.statusMessage);
        return;
    };
    if(typeof self.updateSessionTimeout === 'undefined') {
        //We don't want to spam the server with session update requests
        self.updateSessionTimeout = setTimeout(function() {
            console.log('update session info');
                self.api.session.get(successCallback, errorCallback);
            self.updateSessionTimeout = undefined;
        }, 2000);
    }
};

Session.prototype.retrieveFocalcastToggleState = function(socket) {
    var message = this.FocalcastToggleState ? 'focalcast_open' : 'focalcast_close';
    socket.emit('focalcast_pexip', message);
};

Session.prototype.removeParticipant = function(socket, participant) {
    var self = this;
    var participant_uuid;
    try {

        participant = this.participants.retrieve(socket.id);
        if(participant && participant.socket_id !== socket.id) {
            participant_uuid = participant.uuid;
        }
        else if(participant) {
            if(this.participants.duplicates(participant.uuid)) {
                this.participants.remove(socket.id);
                return;
            }
            else {
                participant_uuid = participant.uuid;
                this.participants.remove(socket.id);
            }
        }

    }
    catch(err) {
        redisPub.hget(self.getHash('participant'), socket.id, function(err, res) {
            if(err) {
                logger.error('Could not retrieve participant from cache');
            }
            else {
                self.api.participant.remove(
                    self.roomname,
                    res,
                    success,
                    function() {
                        logger.error('Could not remove participant');
                    }
                );
            }
        });
    }
    var success = function(body) {
        logger.debug('Successfully removed participant', participant_uuid, socket.id);
        try {
            self.participants.remove(socket.id);
            redisPub.hdel(self.getHash('participant'), socket.id, participant_uuid);
        }
        catch(err) {
            logger.error(err);
        }
        self.metrics.increment('participant_removed');
        try {
            self.updateSessionInfo();
        }
        catch(err) {

        }
        try {
            var message = this.roomname + " : participant id" + participant_uuid;
            new slack(slack.type.logout, message);
        }
        catch(err) {
            logger.error('Error sending slack webhook', err);
        }
    };
    var error = function(error, response) {
        logger.error('Error removing participant ', response.statusCode, response.statusMessage);

    };

    if(participant_uuid) {
        this.api.participant.remove(
            this.roomname,
            participant_uuid,
            success,
            error);
    }
    else {
        logger.error('Remove participant: Socket participant was null');
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
        new slack(slack.type.login, "User login : " + JSON.stringify(participant));
    }
    catch(err) {
        logger.error(err);
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
        logger.error('Error retrieving participants', response.statusCode, response.statusMessage);

    };
    this.api.participant.get(this.roomname, success, error);
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
    if(typeof this.session.presentation === 'undefined') {
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
        self.metricsError.increment('creating_annotation');
    }
};


Session.prototype.addAnnotation = function(path) {
    var self = this;
    var success = function(body) {
        self.annotationsDirty = true;
        self.metrics.increment('added_annotation');
    };
    var error = function(error, response) {
        logger.error('Error submitting annotation:', response.statusCode, response.statusMessage);
    };

    try {
        var annotation = this.createAnnotationObject();
        this.api.annotations.add(annotation, path, success, error);
    }
    catch(err) {
        if(err instanceof Error) {
            logger.error('Error adding annotation', err.message);
        }
        else {
            logger.error('Error adding annotation');
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
            logger.error('Error retrieving annotations:', response.statusCode, response.statusMessage);
        }
    };
    if(this.annotationsDirty) {
        this.annotationsDirty = false;
        try {
            var annotation = this.createAnnotationObject(this.presentation_uuid, this.slide_number);
            this.api.annotations.get(annotation, success, error);
        }
        catch(err) {
            logger.error('Error getting annotations', err);
        }
    }
    else {
        if(isDefined(this.annotations)) {
            self.emitAnnotations('clear');
            self.emitAnnotations('annotations', this.annotations);
        }
    }
};

Session.prototype.retrieveSlideAnnotations = function(socket) {
    var timer = new GaugeTime();
    var self = this;
    var success = function(body) {
        self.annotations = JSON.parse(body);
        logger.debug('Got annotations', self.annotations.annotations.length);

        logger.debug('Retrieve Annotations. Emmiting annotations');
        socket.emit('clear');
        socket.emit('annotations', self.annotations);
        self.metrics.histogram('annotations_retrieval_time', timer.end(), self.annotations.length);
    };
    var error = function(error, response) {
        if(typeof response !== 'undefined') {
            self.metricsError.increment('retrieving_annotations');
            logger.error('Error retrieving annotations:', response.statusCode, response.statusMessage);
        }
    };
    if(this.annotationsDirty) {
        logger.debug('Annotations dirty');
        this.annotationsDirty = false;
        try {
            var annotation = this.createAnnotationObject(this.presentation_uuid, this.slide_number);
            this.api.annotations.get(annotation, success, error);
        }
        catch(err) {
            logger.error('Error getting annotations', err);
        }
    }
    else {
        if(isDefined(this.annotations)) {
            logger.info('Annotations not dirty', this.annotations.length);
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
        logger.error('Errror emitting annotation', error);
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
        logger.error('Error broadcasting annotations', error);
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
        logger.debug('Undo annotation');
        self.metrics.increment('undo_annotation');
    };
    var error = function(error, response, options) {
        logger.debug('Error on undo', response.statusCode, response.statusMessage);
    };
    try {
        var annotationObject = this.createAnnotationObject();
        this.api.annotations.undo(annotationObject, success, error);
    }
    catch(err) {
        logger.error(err);
    }

};

Session.prototype.reverbGetAuth = function(response, callback) {
    var self = this;
    if(isDefined(response) && isDefined(response.statusCode) && isDefined(this.masterSocket)) {
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
        logger.debug('clear success');
        self.metrics.increment('clear_annotations');
    };
    var error = function(error, response) {
        logger.error('Error on clear annotations:', response.statusCode, response.statusMessage);

    };
    try {
        var annotationObject = this.createAnnotationObject();
        this.api.annotations.clear(annotationObject, success, error);
    }
    catch(err) {
        logger.error('Cannot clear annotations.', err);
    }
};



Session.prototype.setSlide = function(message) {

};

Session.prototype.endSession = function(socket) {
    if(socket.id === this.masterSocket.id) {
        this.participants.disconnectAllParticipants();
    }
};


module.exports = Session;
