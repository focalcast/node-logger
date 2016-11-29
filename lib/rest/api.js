var Paricipants = require('./participant-api.js');
var Session = require('./session-api.js');
var Annotations = require('./annotation-api.js');

var FocalcastApi = {
    participant : Paricipants,
    session : Session,
    annotations : Annotations
};





module.exports = FocalcastApi;
