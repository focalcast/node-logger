var base = require('./base-api.js');
var util = require('util');
var request = require('request');
var defined = require('defined');


class Participants extends base.ApiCall{
    constructor(api, success, error) {
        var path = util.format(
            '/session/%s/participants/',
            api.sessionUuid
        );
        super(api, this._path, success, error);
        
        this._api = api;
        this._participantUuid = '';
        if(defined(this._participantUuid) && this._participantUuid !== ''){
            this._participantUuid = this._participantUuid + '/';
        }

    }
    set path(path){
        this._path = util.format(
            '/session/%s/participants/%s',
            this.api.sessionUuid,
            this.participantUuid
        );
    }
    createPath(){
        this.appendUrl(util.format('%s/', this._participantUuid));
    }
    get path(){
        return this.path;
    }
    set participantUuid(participantUuid){
        this._participantUuid = participantUuid;
        if(defined(this._participantUuid) && this._participantUuid !== ''){
            this._participantUuid = this._participantUuid + '/';
        }
        this.createPath();
    }
    get participantUuid(){
        return this._participantUuid;
    }
    set api(api){this._api = api;}
    get api(){return this._api;}

    setup(data, success, error){
        this.success = success;
        this.error = error;
        this.successCode = 201;
        this.data = data;
    }
    addParticipant(data, success, error){
        request.post(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
    get(success, error){
        this.setup('', success, error);
        request.get(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
    addSessionParticipant(data, success, error){
        this.setup(data, success, error);
        this.successCode = 201;
        request.post(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
    inviteSessionParticipant(data){
        this.appendUrl('/invite/');
        this.setup(data, undefined, undefined);
        request.post(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
    hasParticipantData(){
        var k = (defined(this.participantUuid) && this.participantUuid !== null);
        return k;
    }
    remove(){
        if( this.hasParticipantData() ){
            logger.debug('Participant could not be removed. Participant UUID was ', this.participantUuid);
            return;
        }
        request.del(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }

}

module.exports = Participants;
