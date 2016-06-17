var base = require('./base-api.js');
var util = require('util');


var setOwner = function(_owner){
    base.auth.owner = _owner;
};

var setAuthentication = function(_token){
    base.auth.token = _token;
};

var Session = function(_user, success, error){
    if(!base.auth.token){
        logger.error('Authentication not set');
    }
    var path = util.format('/user/%s', _user.email);
    base.ApiCall.call(path, success, error);
    var successCode = 200;
    this.setSuccessCode(successCode);
};

    

var getSession = function(_user, success, error){
    Session.call(_user, success, error);
    this.apiUrl.appendUrl('/get_session/');
    request.post(
        this.options.value,
        this.callback
    );
};

module.exports = {
    setOwner : setOwner,
    setAuthentication : setAuthentication,
    get : getSession
};



