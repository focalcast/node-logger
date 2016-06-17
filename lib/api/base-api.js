var Authentication = require('../authentication.js');

var LOCALHOST = 'http://'+process.env.FOCALCAST_ADDR+':'+process.env.FOCALCAST_PORT;

var BASE_URL = LOCALHOST+'/api/v1';
var auth = {
    owner : undefined,
    token : undefined,
};


var ApiCall = function(path, success, error, _token){
    this.path = path;
    this.rest = new REST(_token);
    };

ApiCall.prototype.setSuccessCode = function(successCode){
    this.successCode = successCode;
    this.createApiUrl();
    this.options = this.apiUrl.createOptions();
    this.callback = Callback(this.options, success, error);
};

ApiCall.prototype.createApiUrl = function(){
    var url = util.format('%s' + this.path, BASE_URL);
    this.apiUrl = new ApiUrl(url, this.rest.getAuthHeaders(), this.successCode);
};


var REST = function(){
    if(auth.token){ 
        this.auth = new Authentication(_token);
    }
    var Options = function(){
    };
    var self = this;
    this.getAuthHeaders = function(){
        if(self.auth){
            return {
                'Authorization' : self.auth.getToken(),
                'Content-Type' : 'application/json'
            };
        }else{
            return{
                'Content-Type' : 'application/json'
            };
        }
    };
};
var ApiUrl = function(url, headers, successCode){
    logger.debug('Url:', url);
    this.url = url;
    this.headers = headers;
    this.successCode = successCode;
};

ApiUrl.prototype.createOptions = function(){
    return{    
        value : {
            url: this.url,
            headers : this.headers,
        },
        successCode : this.successCode,
    };

};

ApiUrl.prototype.appendUrl = function(path){
    this.options.value.url = util.format('%s'+path, this.options.value.url);
};

REST.prototype.removeTimeout = function(reference){
    timeout = undefined;
};

REST.prototype.addTimeout = function(callback, reference, delay){
    if(isDefined(reference)){
        return;
    }
    if(isUndefeind(delay))
        delay = 500;
    reference = setTimeout(callback, delay);
};
REST.prototype.genericRest = function(
    destination_url
){
    var url = BASE_URL+destination_url;
    return new ApiUrl(url, this.getAuthHeaders(), 200);
};

function Callback(options, successCallback, errorCallback){
    var defaultCallback = function(error, response, body){
        //logger.info(response.statusCode);
        //logger.info(options.successCode);
        if(!error && response.statusCode == options.successCode){
            successCallback(response.body);
        }else{
            //logger.info('Callback: ' + JSON.stringify(error) + '\n\n' + JSON.stringify(response) + '\n\n' + JSON.stringify(body)); 
            errorCallback(error, response, options);
        }
    };
    return defaultCallback;
}

module.exports = {
    REST : REST,
    ApiUrl : ApiUrl,
    url : BASE_URL,
    Callback : Callback,
    ApiCall : ApiCall,
    auth : auth
};
