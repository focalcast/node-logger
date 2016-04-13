var request = require('request');
var Authentication = require('./authentication.js');

var LOCALHOST = 'http://'+process.env.FOCALCAST_ADDR+':'+process.env.FOCALCAST_PORT;

var BASE_URL = LOCALHOST+'/api/v1';

var REST = function(_token){
    if(_token){ 
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


REST.prototype.annotations = function(
    session_usid, 
    presentation_uuid, 
    slide_number
){
    var url = BASE_URL+
        '/session/'+session_usid+
            '/presentation/'+presentation_uuid+
                '/slide/'+slide_number+
                    '/annotation/';
                    return new ApiUrl(url,
                                      this.getAuthHeaders(),
                                      200
                                     );
};


REST.prototype.user = function(_user){
    if(isUndefined(_user)){
        return undefined;
    }
    var url = BASE_URL+
        '/user/' + _user.email;
        return new ApiUrl(
            url, 
            this.getAuthHeaders(),
            200
        );
};

REST.prototype.getSession = function(_user){
    if(isDefined(_user)){
        apiUrl = this.user(_user);
        apiUrl.url = apiUrl.url + '/get_session/';
        return apiUrl;
    }else{
        logger.error('GetSession: User was undefined');
        return undefined;
    }
};


REST.prototype.sessionParticipants = function(session_usid, participant_uuid){
    if(isDefined(session_usid)){
        if(isUndefined(participant_uuid)){
            participant_uuid = '';
        }else{
            participant_uuid = participant_uuid+'/';
        }

        var url = BASE_URL+'/session/'+session_usid+'/participants/'+participant_uuid;
        return new ApiUrl(url, this.getAuthHeaders(), 200);
    }else{
        logger.error('REST::SessionParticipants: Session USID was undefined');
        return undefined;
    }
};



function FocalcastApi(){
    this.rest = new REST();
}
/**
 * Default callback that checks the api response for errors.
 */
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
/**
 * Returns the session object currently associated with the user
 */
FocalcastApi.prototype.getSession = function(successCallback, errorCallback){
    try{
        options = this.rest.getSession(this.owner);
        if(isDefined(options)){
            options = options.createOptions();
            request.post(options.value,
                         Callback(options,
                                  successCallback, 
                                  errorCallback
                                 )
                        );
        }else{
            logger.error('GetSession: Error creating url');
        }
    }catch(err){
        logger.error(err);
        errorCallback('Something went wrong');
        return undefined;
    }
};

/**
 * API call to list all annotations on a slide.
 */
FocalcastApi.prototype.getAnnotations = function(
    session_usid, 
    presentation_uuid, 
    slide_number, 
    successCallback, 
    errorCallback
){
    options = this.rest.annotations(
        session_usid, 
        presentation_uuid, 
        slide_number
    );
    if(isDefined(options)){
        options = options.createOptions();
        request.get(
            options.value,
            Callback(options, successCallback, errorCallback)
        );
    }
};

/**
 * API call to add annotation data to the slide.
 */
FocalcastApi.prototype.addAnnotation = function(
    session, 
    presentation,
    slide,
    data,
    successCallback,
    errorCallback
){
    options = this.rest.annotations(session, presentation, slide)
    if(isDefined(options)){
        options = options.createOptions();
        options.value.body = data;
        request.post(
            options.value,
            Callback(options, successCallback, errorCallback)
        );
    }
};

FocalcastApi.prototype.undoAnnotation = function(session,presentation,slide,success, error){
    options=this.rest.annotations(session, presentation, slide);
    if(isDefined(options)){
        options=options.createOptions();
        options.value.url = options.value.url+'undo/';
        request.post(
            options.value,
            Callback(options, success, error)
        );
    }
};

FocalcastApi.prototype.clearAnnotations = function(session,presentation,slide,success, error){
    options=this.rest.annotations(session, presentation, slide);
    if(isDefined(options)){
        options=options.createOptions();

        options.value.url = options.value.url+'clear/';
        request.post(
            options.value,
            Callback(options, success, error)
        );
    }
};
/**
 * API Call to list participants in session.
 */
FocalcastApi.prototype.getSessionParticipants = function(
    session_usid, 
    successCallback, 
    errorCallback
){
    options = this.rest.sessionParticipants(session_usid);
    if(isDefined(options)){
        options = options.createOptions();
        request.get(options.value, Callback(options, successCallback, errorCallback));
    }
};

/**
 * API Call to add a participant to a session.
 */
FocalcastApi.prototype.addSessionParticipant = function(session_usid, data, success, error){
    options = this.rest.sessionParticipants(session_usid);
    if(isDefined(options)){
        options=options.createOptions();
        options.value.body = data;
        options.successCode = 201;
        request.post(options.value, Callback(options, success, error));
    }
};

FocalcastApi.prototype.inviteSessionParticipant = function(session_usid, data){
    var success = function(body){
        logger.debug('Success', JSON.parse(body) );
    };

    var error = function(err){
        logger.debug('Err', err);
    };

    var dest_url = '/session/'+session_usid+'/participants/invite/';
    options = this.rest.genericRest(dest_url);
    if(isDefined(options)){
        $log.debug('options is defined');
        options=options.createOptions();
        options.value.body = data;
        options.successCode = 200;
        request.post(options.value, Callback(success, error));
    }else{
        logger.error('Error inviting session participants!');
    }
};


/**
 * API call to remove a participant from the session.
 */
FocalcastApi.prototype.removeSessionParticipant = function(session_usid, participant_uuid, success, error){
    options = this.rest.sessionParticipants(session_usid, participant_uuid);
    if(isDefined(options)){
        options = options.createOptions();
        request.del(options.value, Callback(options, success, error));
    }
};


FocalcastApi.prototype.setAuthentication = function(_token){
    this.rest = new REST(_token);
};

FocalcastApi.prototype.setSessionOwner = function(_owner){
    this.owner = _owner;
};

module.exports = FocalcastApi;
