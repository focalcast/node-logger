var base = require('./base-api.js');
var util = require('util');
var request = require('request');

var setOwner = function(_owner){
    base.auth.owner = _owner;
};

var setAuthentication = function(_token){
    base.auth.token = _token;
};

var Session = function(success, error){
    if(!base.auth.token){
        logger.error('Authentication not set');
    }
    var path = util.format('/user/%s', base.auth.owner.email);
    base.ApiCall.call(this, path, success, error);
    var successCode = 200;
    this.setSuccessCode(successCode);
};

Session.prototype = Object.create(base.ApiCall.prototype);
Session.constructor = Session;


var getSession = function(success, error){
    var session = new Session(success, error);
    session.appendUrl('/get_session/');
    request.post(
        session.options.value,
        session.callback
    );
};

module.exports = {
    setOwner : setOwner,
    setAuthentication : setAuthentication,
    get : getSession
};



