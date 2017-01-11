var _ = require('underscore');
var Q = require('q');

class Participant {
    constructor(socket_id, participant_uuid){
        this.socket_id = socket_id;
        this.uuid = participant_uuid;
        this.active = true;
    }
}

var Participants = function(session) {
    this.session = session;
    this.participants = [];
};

Participants.prototype.get = function() {
    return this.participants;
};

Participants.prototype.retrieve = function(socket_id) {
    var participant = _.findWhere(this.participants, {
        'socket_id': socket_id
    });
    if(participant) {
        return participant;
    }
    else {
        //throw new Error('Participant not found', socket_id, this.participants);
    }
};

Participants.prototype.duplicates = function(participant_uuid) {
    var duplicates = 0;
    for(var i = 0; i < this.participants.length; i++) {
        var participant = this.participants[i];
        if(participant.uuid === participant_uuid) {
            duplicates++;
        }
    }
    return duplicates > 1;
};

Participants.prototype.isUnique = function(socket_id, participant_uuid, deferred) {
    var self = this;
    for(var i = 0; i < this.participants.length; i++) {
        var participant = this.participants[i];
        if(participant.uuid === participant_uuid) {
            // global.logger.info('Participant uuid was equivalent');
            if(participant.socket_id === socket_id) {
                deferred.reject();
            }
            else {
                global.logger.debug(`Session ${this.session.roomname} -- Found duplicate participant uuid with differing socket id -- Removing participant socket_id: ${participant.socket_id} uuid: ${participant_uuid}`);
                deferred.resolve(participant.socket_id);
            }
        }
    }
    deferred.resolve();
};

Participants.prototype.add = function(socket_id, participant_uuid) {
    if(
        socket_id &&
        participant_uuid &&
        typeof socket_id === 'string' &&
        typeof participant_uuid === 'string'
    ) {
        var deferred = Q.defer();
        var self = this;
        deferred.promise.then(function(resolve) {
            self.participants.push(new Participant(socket_id, participant_uuid));
            global.logger.debug(`Session: ${self.session.roomname} -- Added participant. -- UUID: ${participant_uuid} -- Socket: ${socket_id} -- Total participants: ${self.participants.length}`);
            if(typeof(resolve) === 'string') {
                self.disconnect(resolve, 'removed_by_host');
            }
        }, function(reject) {});
        this.isUnique(socket_id, participant_uuid, deferred);
    }
};

Participants.prototype.disconnectAllParticipants = function() {
    global.logger.debug(`Session: ${this.session.roomname} -- Disconnecting all participants -- Total participants ${this.participants.length}`);
    for(var i = 0; i < this.participants.length; i++) {

        var self = this;
        var deferred = Q.defer();
        deferred.promise.then(function(socket_id) {
            try {
                self.disconnect(socket_id, 'session_ended');
            }
            catch(err) {
                global.logger.error('Error disconnecting participant.', err);
            }
        });
        deferred.resolve(this.participants[i].socket_id);
    }
};

/**
 * Disconnects user from socket server.
 * Emits `remote_disconnect` with reason `removed_by_host`.
 * @param  Socket    socket to be disconnected
 * @return Boolean   returns true if successful.
 */
Participants.prototype.disconnectSocket = function(socket, message) {
    if(typeof(socket) !== 'undefined') {
        //global.logger.debug('Disconnecting socket with id', socket.id);
        socket.emit('remote_disconnect', message);
        socket.disconnect();
        return true;
    }
    else {
        return false;
    }
};


Participants.prototype.disconnect = function(socket_id, message) {
    try {
        if(socket_id && typeof socket_id === 'string') {
            var sock = this.session.io.sockets.connected[socket_id];
            if(typeof(sock) !== 'undefined') {
                this.disconnectSocket(sock, message);
            }
            else {
                throw new Error('Could not disconnect socket. Undefined socket id');
            }
        }
        else {
            throw new TypeError('Could not disconnect socket. Socket id was of incorrect type.');
        }
    }
    catch(err) {
        global.logger.error(err.message);
    }
};

Participants.prototype.remove = function(socket_id) {
    if(socket_id && typeof socket_id === 'string') {
        var removedParticipant = this.retrieve(socket_id);
        var reject = _.reject(
            this.participants,
            function(participant) {
                return participant.socket_id === socket_id;
            });
        if(Array.isArray(reject)) {
            this.participants = reject;
        }
        // global.logger.info(`Session: ${this.session.roomname} -- Removed participant: ${socket_id} -- Total participants ${this.participants.length}`);
        return removedParticipant;
    }
};

Participants.prototype.setAllInactive = function(){
    for(var i = 0; i < this.participants.length; i++) {
        var participant = this.participants[i];
        participant.active = false;
    }
};

Participants.prototype.getInactive = function(){
    var inactiveParticipants = [];
    for(var i = 0; i < this.participants.length; i++) {
        var participant = this.participants[i];
        if(!participant.active){
            inactiveParticipants.push(participant);
        }
    }
    return inactiveParticipants;
};

Participants.prototype.setActive = function(socket_id){
    var participant = _.findWhere(this.participants, {
        'socket_id': socket_id
    });
    participant.active = true;
};

Participants.prototype.removeByUuid = function(uuid) {
    if(uuid && typeof uuid === 'string') {
        var removedParticipant = this.retrieve(uuid);
        this.participants = _.reject(
            this.participants,
            function(participant) {
                return participant.uuid === uuid;
            });
        return removedParticipant;
    }
};

Participants.prototype.filter = function(participants) {
    var self = this;

    _.each(participants, function(participant) {
        self.participants = self.participants.filter(function(obj) {
            return obj.uuid !== participant.uuid;
        });

    });
};

module.exports = Participants;
