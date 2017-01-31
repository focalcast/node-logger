var Authentication = require('../authentication.js');
var util = require('util');
var defined = require('defined');

var LOCALHOST = 'http://' + process.env.FOCALCAST_ADDR + ':' + process.env.FOCALCAST_PORT;

var BASE_URL = LOCALHOST + '/api/v1';


class Auth {
    constructor(owner, token) {
        this._owner = owner;
        this._token = token;
    }
    get owner() {
        return this._owner;
    }
    set owner(owner) {
        this._owner = owner;
    }
    get token() {
        return this._token;
    }
    set token(token) {
        this._token = token;
    }
    hasToken() {
        return defined(this.token);
    }
    hasOwner() {
        return defined(this.owner);
    }
}
class API {

    constructor(owner, token, usid) {
        this._auth = new Auth(owner, token);
        this._sessionUuid = usid;
    }
    set sessionUuid(usid) {
        this._sessionUuid = usid;
    }
    get sessionUuid() {
        return this._sessionUuid;
    }
    set auth(auth) {
        this._auth = auth;
    }
    get auth() {
        return this._auth;
    }
    getAuthHeaders() {
        if(this.auth.hasToken()) {
            return {
                'Authorization': 'Token ' + this.auth.token,
                'Content-Type': 'application/json'
            };
        }
        else {
            return {
                'Content-Type': 'application/json'
            };
        }
    }
}


class ApiCall {
    constructor(api, path, success, error) {
        this._api = api;
        this._path = path;
        this._success = success;
        this._error = error;
        this.setSuccessCode(200);
    }
    get api() {
        return this._api;
    }
    set api(api) {
        this._api = api;
    }
    set path(path) {
        this._path = path;
        this.createOptions();
    }
    get path() {
        return this._path;
    }
    set success(success) {
        this.callback.successCallback = this.success;
        this._success = success;
    }
    get success() {
        return this._success;
    }
    get error() {
        return this._error;
    }
    set error(error) {
        this.callback.errorCallback = this.error;
        this._error = error;
    }
    get successCode() {
        return this._successCode;
    }
    setSuccessCode(successCode) {
        this._successCode = successCode;
        this.createOptions();
    }
    set successCode(successCode) {
        this._successCode = successCode;
    }
    appendUrl(path) {
        this._path = util.format('%s' + path, this.callback.options.url);
        this.createOptions();
    }
    createOptions() {
        var options = {
            url: this._path,
            value: {
                baseUrl: BASE_URL,
                headers: this.api.getAuthHeaders(),
            },
            successCode: this.successCode,
        };
        this.callback = new Callback(options, this.success, this.error);
    }
    addTimeout(callback, reference, delay) {
        if(defined(reference)) {
            return;
        }
        if(!defined(delay)) {
            delay = 500;
        }
        reference = setTimeout(callback, delay);
    }
    genericRest(path) {
        this.path = BASE_URL + path;
    }
    set data(data) {
        this.callback.options.value.body = data;
    }
    get data() {
        return this.callback.options.value.body;
    }
}


class Callback {
    constructor(options, successCallback, errorCallback) {
        this._options = options;
        this._successCallback = successCallback;
        this._errorCallback = errorCallback;
        this._options.response = this.default();
    }
    get options() {
        return this._options;
    }
    set options(options) {
        this._options = options;
    }
    get successCallback() {
        return this._successCallback;
    }
    set successCallback(successCallback) {
        this._successCallback = successCallback;
    }
    get errorCallback() {
        return this._errorCallback;
    }
    set errorCallback(errorCallback) {
        this._errorCallback = errorCallback;
    }
    default() {
        var self = this;
        return function(error, response, body) {
            if(!error && response.statusCode === self.options.successCode) {
                self.successCallback(response.body);
            }
            else {
                if(self.errorCallback) {
                    self.errorCallback(error, response, self.options);
                }
            }
        };
    }

}

module.exports = {
    url: BASE_URL,
    Callback: Callback,
    ApiCall: ApiCall,
    Auth: Auth,
    API: API
};
