var Paricipants = require('./api/participant-api.js');
var Session = require('./api/session-api.js');
var Annotations = require('./api/annotation-api.js');

var FocalcastApi = {
    participant : Paricipants,
    session : Session,
    annotations : Annotations
};





module.exports = FocalcastApi;
