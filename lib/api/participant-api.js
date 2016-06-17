var base = require('./base-api.js');
var util = require('util');

var Participants = function(
    session_usid, 
    participant_uuid, 
    success, 
    error
){
    this.participant_uuid = participant_uuid;
    this.session_usid = session_usid;
    var path = util.format(
        '/session/%s/participants/%s',
        session_usid,
        participant_uuid
    );
    base.ApiCall.call(path, success, error);
    var successCode = 200;
    this.setSuccessCode(successCode);
};

var getSessionParticipants = function(
    session_usid, 
    success, 
    error
){
    Participants.call(session_usid, '', success, error);
    request.get(
        this.options.value,
        this.callback
    );
};

var addSessionParticipant = function(
    session_usid, 
    data, 
    success, 
    error
){
    Participants.call(session_usid, '', success, error);
    this.setSuccessCode(201);
    this.options.value.body = data;
    request.post(
        this.options.value,
        this.callback
    );
};

var inviteSessionParticipant = function(
    session_usid, 
    data
){
    Participants.call(session_usid, '', success, error);
    this.apiUrl.appendUrl('/invite/');
    this.options.value.body = data;
    request.post(
        this.options.value,
        this.callback
    );
};

var removeSessionParticipant = function(
    session_usid,
    participant_uuid,
    success,
    error
){
    Participants.call(
        session_usid, 
        participant_uuid, 
        success,
        error
    );
    request.del(
        this.options.value,
        this.callback
    );
};

module.exports = {
    get : getSessionParticipants,
    add : addSessionParticipant,
    invite : inviteSessionParticipant,
    remove : removeSessionParticipant
};


    
