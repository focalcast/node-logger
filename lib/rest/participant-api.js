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
        super(api, path, success, error);

        this._api = api;


    }

    createPath(){
        this.appendUrl(util.format('%s/', this._participantUuid));
    }

    set participantUuid(participantUuid){
        this._participantUuid = participantUuid;

        this.createPath();
    }
    get participantUuid(){
        return this._participantUuid;
    }
    set api(api){this._api = api;}
    get api(){return this._api;}

    addParticipant(data, success, error){
        request.post(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
    get(success, error){
        request.get(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
    addSessionParticipant(data){
        this.successCode = 201;
        request.post(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
    inviteSessionParticipant(data){
        this.appendUrl('/invite/');
        this.data = data;
        request.post(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
    hasParticipantData(){
        var k = (defined(this._participantUuid) && this._participantUuid !== null);
        logger.info('has participant data', k, this._participantUuid);
        return k;
    }
    remove(){
        if(!this.hasParticipantData() ){
            logger.debug('Participant could not be removed. Participant UUID was ', this._participantUuid);
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
