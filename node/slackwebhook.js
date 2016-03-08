var http = require('http');


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
    var jsonObj = createJSONMessage(type, message);
    var options = {
        url: WEBHOOK_URL,
       method: 'POST',
      json: jsonObj 
    };
    require('request')(options, function(error, response, body){
        if ( !error && response.statusCode === 200 ) {
            logger.debug(JSON.stringify(body));
        } else {
            logger.error('Slack webhook error ' + error);
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
    }
};

module.exports = Slack;
