var moment = require('moment');

function mLogger(args){
    logLevel = 0;
}

mLogger.prototype.debug = function(message){
    if(logLevel <= 0){ 
        a("DEBUG", message);
    }
};

mLogger.prototype.info = function(message){
    if(logLevel <= 1){
        a("INFO", message);
    }
};

mLogger.prototype.warning = function(message){
    if(logLevel <=2){
        a("WARNING", message);
    }
};

mLogger.prototype.error = function(message){
    if(logLevel <= 3){
    a("ERROR", message);
}
};

mLogger.prototype.error = function(message, err){
    if(logLevel <= 3){
        a("ERROR", sprintf("%s : %s" , message,  err));
    }
};

mLogger.prototype.critical = function(message){
    if(logLevel <=4){
        a("CRITICAL", message);
    }
};

function a(type, message){
    var formattedMessage = sprintf("%s %s : %s", type, moment(new Date()).format("YYYY-MM-DD HH:mm:ss,SSS").toString(), message);
    mLog(formattedMessage);

}

function mLog(message){
    console.log(message);
}


module.exports = function(args){
    return new mLogger(args);
};
