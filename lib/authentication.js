class Authentication{
    constructor(token){
        this._token = token;
    }
    get token(){return this._token;}
    set token(token){this._token = token;}
}

module.exports = Authentication;
