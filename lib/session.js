var request = require('request');
var Slide = require('./slide.js');
var _ = require( 'underscore' );
var Users = require( './user.js' );
var slack = require( './slackwebhook.js' );
var FocalcastApi = require('./api.js');

function Session(roomname){
    this.roomname = roomname;
    this.api = new FocalcastApi();
    this.annotationsDirty = true;
    this.sendAllToMaster = false;
}


Session.prototype.setAuthentication = function(message){
    //logger.debug('Setting Authentication:', JSON.stringify(message));
    var node_auth = message;
    this.setPrimaryUser(node_auth.owner);
    logger.debug(JSON.stringify(node_auth.owner));
    this.setSendAllToMaster(node_auth.owner.send_all_to_host);
    this.setSession(node_auth.session);
    this.api.setAuthentication(node_auth.token);
    this.updateSessionInfo();
};

Session.prototype.getCurrentPresentation = function(){
    return this.session.current_presentation;
};


Session.prototype.getSessionUsid = function(){
    return this.session.usid;
};

Session.prototype.setSession = function(_session){
    if(typeof _session == 'undefined'){
        logger.error('SetSession: Session was undefined') ;
    }
    this.session = _session;
    //logger.debug('Session set: ', this.session);

};

Session.prototype.getPresentation = function(){
    return this.session.presentation;
};

Session.prototype.getSlides = function(){
    return this.session.presentation.slides;
};

Session.prototype.getPresentationLength = function(){
    return this.getSlides().length;
};

Session.prototype.setPrimaryUser = function(user){
    this.owner = user;
    this.api.setSessionOwner(user);
};

Session.prototype.setMasterSocket = function(socket){
    this.masterSocket = socket;
};

Session.prototype.sendToMaster = function(event, message){
    try{
        if(this.masterSocket){
            io.to(this.masterSocket.id).emit(event, message);
        }
    }catch(err){
    }
};



Session.prototype.getSlideUrl = function(slide_number){
    var slide  =  _.findWhere( this.slides, { 'slide_number' : slide_number } );
    if(typeof slide === 'undefined'){
        return "https://i.imgur.com/OqQiSXv.jpg";
    }else{
        return slide.slide_url;
    }
};

Session.prototype.self = function() {
    return this;
};

Session.prototype.updateSessionInfo = function(){
    var self = this;
    var successCallback = function(body){
        self.session = JSON.parse(body);
        self.emit('session_info', self.session); 
        try{
            if(self.annotationsDirty && isDefined(self.session.presentation) && isDefined(self.session.current_slide)){
                self.getAnnotations(self.session.presentation.uuid, self.session.current_slide.number);
                self.annotationsDirty=false;
            }
        }catch(e){
        }
    };
    var errorCallback = function(error, response){
        logger.error('UpdateSessionInfo', error);
    };
    if(typeof self.updateSessionTimeout === 'undefined'){
        //We don't want to spam the server with session update requests
        self.updateSessionTimeout = setTimeout(function(){
            console.log('update session info');
            self.api.getSession(successCallback, errorCallback);
            self.updateSessionTimeout = undefined;
        }, 2000);
    }

};

Session.prototype.removeParticipant = function(socket){
    var self = this;
    var participant_uuid = socket.participant_uuid;
    var success = function(body){
        logger.debug('Successfully removed participant', participant_uuid);
        self.updateSessionInfo();
        try{
            var message = this.roomname + " : participant id" + participant_uuid;
            new slack( slack.type.logout, message );
        }catch(err){
            logger.error('Error sending slack webhook', err);
        }
    };
    var error = function(error, response){
        logger.error('Error removing participant ' + error);

    };
    if(socket.participant_uuid){
        this.api.removeSessionParticipant(
            this.roomname, 
            socket.participant_uuid, 
            success, 
            error);
    }else{
        logger.error('Remove participant: Socket participant was null');
    }
};

Session.prototype.addParticipant = function(socket, data){
    var self = this;
    var success = function(body){
        participant = JSON.parse(body);
        socket.participant_uuid = participant.uuid;
        socket.emit('user_info', participant);

        self.updateSessionInfo();
        try{
            new slack( slack.type.login, "User login : "  + JSON.stringify(participant));
        }catch(err){
            logger.error(err);
        }

    };
    var error = function(error, response){
        if(typeof response !== 'undefined'){
            var body = response.body;
            logger.error('Error adding participant: ' ,error, response);
        }else{
            logger.error('Error adding participant: ' ,error);
        }
    };
    this.api.addSessionParticipant(this.roomname, data, success, error);
};

/**
 * Retrieve list of session participants.
 */
Session.prototype.listParticipants = function(){
    var self = this;
    var success = function(body){
        self.participants = JSON.parse(body);
            /**
        * Emit participant list to users
        */
        self.emit('participants', self.participants);
    };
    var error = function(error){
        logger.error('Error retrieving participants', error);

    };
    this.api.getSessionParticipants(this.roomname, success, error);
};

Session.prototype.setSendAllToMaster = function(send_to_all){
    this.sendAllToMaster = send_to_all;
};


/**
 * Emits a message to all users currently connected to the socket.
 */
Session.prototype.emit = function(event, message){
    io.sockets.in( this.roomname ).emit(event, message); 
};

Session.prototype.broadcast = function(event, message, socket){
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
Session.prototype.createAnnotationObject = function(_presentation, _slide){
    try{
        var annotation = {
            session : this.getSessionUsid(),
            presentation : _presentation || this.session.presentation.uuid,
            slide : _slide || this.session.current_slide.number
        };
        return annotation;
    }catch(err){
        logger.error('Error creating annotation object', err);
        throw 'Error creating annotation object';
    }
};


Session.prototype.addAnnotation = function(path){
    var self = this;
    var success = function(body){
        logger.info('Successfully submitted annotation');
        this.annotationsDirty=true;
    };
    var error = function(error, response){
        logger.error('Error submitting annotation');
    };

    try{
        var annotation = this.createAnnotationObject();
        this.api.addAnnotation(annotation, path, success, error);
    }catch(err){
        logger.error('Error adding annotation', err);
    }
};

/**
 * Get annotations for the current slide.
 */
Session.prototype.getAnnotations = function(presentation_uuid, slide_number){
    var self = this;
    var success = function(body){
        self.annotations = JSON.parse(body);
        logger.debug('Emmiting annotations');
        self.emitAnnotations('clear');
        self.emitAnnotations('annotations', self.annotations);
    };
    var error = function(error, response){
        logger.error(error);
    };
    if(this.annotationsDirty){
        this.annotationsDirty=false;
        try{
            var annotation = this.createAnnotationObject(presentation_uuid, slide_number);
            this.api.getAnnotations(annotation, success, error);
        }catch(err){
            logger.error('Error getting annotations', err);
        }
    }else{
        self.emitAnnotations('clear', JSON.stringify(this.annotations));
        self.emitAnnotations('annotations', JSON.stringify(this.annotations));
    }

};

Session.prototype.emitAnnotations = function(event, message){
    logger.debug('sendAllToMaster', this.sendAllToMaster);
    try{
        if(this.sendAllToMaster){
            this.sendToMaster(event, message);
        }else{
            this.emit(event, message);
        }
    }catch(error){
        logger.error('Errror emitting annotation', error);
    }
};


Session.prototype.broadcastAnnotations = function(event, message, socket){
    try{
        if(this.sendAllToMaster){
            if(socket.id !== this.masterSocket.id){
                this.sendToMaster(event, message);
            }
        }else{
            this.broadcast(event, message, socket);
        }
    }catch(error){
        logger.error('Error broadcasting annotations', error);
    }
};



/**
 * Performs api call to undo an annotation
 *
 * @returns {undefined}
 */

Session.prototype.undoAnnotation = function(){
    var self = this;
    var success = function(body){
        self.emit('undo');
        logger.debug('Undo annotation');
    };
    var error = function(error, response, options){
        logger.debug('Error on undo');
    };
    try{
        var annotationObject = this.createAnnotationObject();
        this.api.undoAnnotation(annotationObject, success, error);
    }catch(err){
        logger.error(err);
    }

};

Session.prototype.reverbGetAuth = function(response, callback){
    var self = this;
    if(isDefined(response) && isDefined(response.statusCode) && isDefined(this.masterSocket)){
        if(response.statusCode === 401){
            io.to(this.masterSocket.id).emit('need_auth');
            var gotAuth = function(message){
                self.setAuthentication(message);
                callback();
                self.masterSocket.removeListener('auth_renew', gotAuth);
            };
            this.masterSocket.on('auth_renew', gotAuth);
        }
    }
};


Session.prototype.clearAnnotations = function(){
    var self = this;
    var success = function(body){
        self.emit('clear');
        logger.debug('clear success');
    };
    var error = function(error){
        logger.error('error on clear');
    };
    try{
        var annotationObject = this.createAnnotationObject();
        this.api.clearAnnotations(annotationObject, success, error);
    }catch(err){
        logger.error(err);
    }
};



Session.prototype.setSlide = function( message ) {
    jsonObj = JSON.parse(message);
    if ( _.has( jsonObj, 'slide_number' ) ) {
        this.current_slide = jsonObj.slide_number;
        return this.getSlideUrl(this.current_slide);
    }
    //get the slide url
};


module.exports = Session;
