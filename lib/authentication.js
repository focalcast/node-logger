function Authentication(_token){
    this.auth = _token;
}

Authentication.prototype.getToken = function(){
    return this.auth;
};

module.exports = Authentication;
