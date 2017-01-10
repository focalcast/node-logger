var base = require('./base-api.js');
var util = require('util');
var request = require('request');

class Session extends base.ApiCall{
    constructor(api, success, error){
        if(!api.auth.hasToken()){
            global.logger.error('Authentication not set');
        }
        if(!api.auth.hasOwner()){
            global.logger.error('Owner not set');
        }
        var path = util.format('/user/%s', api.auth.owner.email);
        super(api, path, success, error);
    }
    get(){
        this.appendUrl('/get_session/');
        // global.logger.debug('Session call', this.callback.options.url);
        request.post(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
    stop(){
        this.appendUrl('/stop_session/');
        this.path = util.format('/session/%s/stop/', this.api.sessionUuid);
        // global.logger.debug('Session call', this.callback.options.url);
        request.post(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
}

module.exports = Session;
