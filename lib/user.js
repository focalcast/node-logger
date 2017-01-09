function Users(){
    this.userArray = [];
}
// Give this a function of the form func(user) and it will run it with
// all Users as inputs.
Users.prototype.allUsers = function(func) {
    for (var y = 0; y < this.userArray.length; y++) {
        func(this.userArray[y]);
    }
};

Users.prototype.addUserAsParticipant = function(senderId) {
    if (this.getIndexOfUserInArray(senderId) !== undefined) {
        global.logger.info('Something weird is going on; we\'re trying to add the same user twice!');
    } else {
        this.userArray.push(new User(senderId));
        // Setting the index. There might be a better way to do this, but I can't think of it right now.
        this.userArray[this.userArray.length - 1].index = this.userArray.length - 1;
        if (this.userArray.length === 1) {
            global.logger.debug('user array == 1');
            this.userArray[0].isPrimary = true;
        } else {
            //If user is not primary.
        }
    }
};
Users.prototype.getUserFromArray = function(senderId) {
    for (var i = 0; i < this.userArray.length; i++) {
        var user = this.userArray[i];
        if (user.id === senderId) {
            return user;
        }
    }
    return undefined;
};
Users.prototype.getIndexOfUserInArray = function(senderId) {
    for (var i = 0; i < this.userArray.length; i++) {
        var user = this.userArray[i];
        if (user.id === senderId) {
            return i;
        }
    }
    return undefined;
};

Users.prototype.removeUserFromParticipants = function(senderId) {
    var index = this.getIndexOfUserInArray(senderId);
    if(index !== undefined){
        var user = this.userArray.splice(index, 1);
        if(user.isPrimary){
            if(this.userArray.length > 0){
                this.userArray[0].isPrimary = true;
            }
        }
    }
};

Users.prototype.handleDimensionInfo = function(jsonObj){
    var user = this.getUserFromArray(jsonObj.senderId);
    user.dimen = new dimen(jsonObj.width, jsonObj.height);
};

function dimen(width, height) {
    this.width = width;
    this.height = height;
}


Users.prototype.getParticipantList = function() {
    var participantList = {
        'type': 'participant_list',
        participants: []
    };
    this.allUsers(function(u) {
        //console.log(JSON.stringify(u.toJSONString()));
        participantList.participants.push(u.toJSONString());
    });
    global.logger.debug('\nParticipant List Changed \n' + JSON.stringify(participantList)+'\n');
    return JSON.stringify(participantList);
};

function findPrimary(array) {
    for (var i = 0; i < array.length; i++) {
        var user = array[i];
        if (user.isPrimary) {
            return user;
        }
    }
}

Users.prototype.updateParticipantInfo = function(jsonObj) {

    var user = this.getUserFromArray(jsonObj.senderId);
    if(jsonObj.hasOwnProperty('name')){
        user.name = jsonObj.name;
    }
    if(jsonObj.hasOwnProperty('email')){
        user.email = jsonObj.email;
    }
    if(jsonObj.hasOwnProperty('is_host')){
        user.isPrimary = jsonObj.isHost;
    }
    if(jsonObj.hasOwnProperty('is_observer')){
        user.isObserver = jsonObj.isObserver;
    }
    if(jsonObj.hasOwnProperty('userColor')){
        user.color = jsonObj.userColor;
    }

};

Users.prototype.makeHost = function(senderId){
    this.allUsers( function(u){
        u.isPrimary = false;
    });
    global.logger.info('Making user with id ' + senderId + ' host');
    this.getUserFromArray(senderId).isPrimary = true;

};

// Represents a connected User of the application
function User(id) {
    this.id = id;
    this.drawCoords = [];
    this.oldCoords = [];
    this.drawPaths = [];
    this.dimen = {};
    this.isPrimary = false;
    this.SocketConnection = {};
    // This counter is used when sending paths to a redraw() function.
    this.counter = 0;
    this.sendingAll = false;
    // Whether this user is drawing or not.
    this.drawing = false;
    this.penColor = null;
    this.labels = [];
    this.isObserver = false;
    // Everyone gets a random color.
    this.color = 'hsl(' + Math.floor(Math.random() * 360) + ', 100%, ' + (40 + Math.floor(Math.random())) + '%)';
    // This will be an object with two properties, x and y, each with their respective scale factors.
}

// Should this be named like this, seeing as it doesn't actually return a string?
User.prototype.toJSONString = function() {
    var participant = {
        'senderId': this.id,
        'is_host': this.isPrimary,
        'is_observer': this.isObserver,
        'name': this.name,
        'email': this.email,
        'color': this.color,
        'dimen': {
            height : this.dimen.height,
            width : this.dimen.width
        }
    };
    return participant;
};

module.exports = Users;
