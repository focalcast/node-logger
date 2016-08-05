var base = require('./base-api.js');
var util = require('util');
var request = require('request');

var Participants = function(
    session_usid, 
    participant_uuid, 
    success, 
    error
){
    this.participant_uuid = participant_uuid;
    this.session_usid = session_usid;
    if(typeof participant_uuid !== 'undefined' && participant_uuid !== ''){
        participant_uuid = participant_uuid+'/';
    }
    var path = util.format(
        '/session/%s/participants/%s',
        session_usid,
        participant_uuid
    );
    base.ApiCall.call(this, path, success, error);
    var successCode = 200;
    this.setSuccessCode(successCode);
};

Participants.prototype = Object.create(base.ApiCall.prototype);
Participants.constructor = Participants;

var getSessionParticipants = function(
    session_usid, 
    success, 
    error
){
    var participants = new Participants(session_usid, '', success, error);
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
    var participants = new Participants(session_usid, '', success, error);
    participants.setSuccessCode(201);
    participants.options.value.body = data;
    request.post(
        participants.options.value,
        participants.callback
    );
};

var inviteSessionParticipant = function(
    session_usid, 
    data
){
    var participants = new Participants(session_usid, '', success, error);
    participants.appendUrl('/invite/');
    participants.options.value.body = data;
    request.post(
        participants.options.value,
        participants.callback
    );
};

var removeSessionParticipant = function(
    session_usid,
    participant_uuid,
    success,
    error
){
    var participants = new Participants(
        session_usid, 
        participant_uuid, 
        success,
        error
    );
    request.del(
        participants.options.value,
        participants.callback
    );
};

module.exports = {
    get : getSessionParticipants,
    add : addSessionParticipant,
    invite : inviteSessionParticipant,
    remove : removeSessionParticipant
};


    
