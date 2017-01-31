var Participants = require('./participant-api.js');
var Session = require('./session-api.js');
var Annotation = require('./annotation-api.js');
var API = require('./base-api.js').API;
var defined = require('defined');

class FocalcastApi{
    constructor(owner, token, usid){
        this._api = new API(owner, token, usid);
    }

    set api(api){
        this._api = api;
    }
    get api(){
        return this._api;
    }
    get auth(){
        return this.api.auth;
    }
    set auth(auth){
        this.api.auth = auth;
    }

    participants(participantId, success, error){
        var participants = new Participants(this.api, success, error);
        if(defined(participantId)){
            participants.participantUuid = participantId;
        }
        return participants;
    }
    session(success, error){
        return new Session(this.api, success, error);
    }
    annotations(success, error){
        return new Annotation(this.api, success, error);
    }
}

module.exports = FocalcastApi;
