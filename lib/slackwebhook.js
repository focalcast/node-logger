var http = require('http');

var debug = process.env.DEBUG;

var WEBHOOK_URL = 'https://hooks.slack.com/services/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';

var createJSONMessage = function(type, message){
    return {
        channel : type.channel,
        username : type.username,
        text : message,
        icon_emoji : type.emoji
    };
};

var Slack = function(type, message){
    return;
    if(debug){
        return;
    }
    var jsonObj = createJSONMessage(type, message);
    var options = {
        url: WEBHOOK_URL,
       method: 'POST',
      json: jsonObj
    };
    require('request')(options, function(error, response, body){
        if ( !error && response.statusCode === 200 ) {
            //global.logger.debug(JSON.stringify(body));
        } else {
            global.logger.error('Slack webhook error ' + error);
        }
    });
};


Slack.type = {
    connection : {
        channel : '#focalcast-connections',
        username : 'Connection',
        emoji : ':satellite:',
    },
    presentation : {
        channel : '#focalcast-connections',
        username : 'Presentation',
        emoji : ':bar_chart:',
    },
    error : {
        channel : '#focalcast-connections',
        username : 'Errors',
        emoji : ':feelsgood:',
    },
    login : {
        channel : '#focalcast-connections',
        username : 'Login',
        emoji : ':heavy_plus_sign:'
    },
    logout : {
        channel : '#focalcast-connections',
        username : 'Logout',
        emoji : ':heavy_minus_sign:'
    },
    session_started : {
        channel : '#focalcast-connections',
        username : 'Session started',
        emoji : ':up:'
    }


};

module.exports = Slack;
