var _ = require('underscore');
var Q = require('q');

var Participant = function(socket_id, participant_uuid) {
    this.socket_id = socket_id;
    this.uuid = participant_uuid;
};

var Participants = function() {
    this.participants = [];
};

Participants.prototype.get = function() {
    return this.participants;
};

Participants.prototype.retrieve = function(socket_id) {
    logger.info(this.participants.length);
    var participant = _.findWhere(this.participants, {
        'socket_id': socket_id
    });
    logger.info('participants length', this.participants.length);
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
    logger.info('duplicates', duplicates);
    return duplicates > 1;
};

Participants.prototype.isUnique = function(socket_id, participant_uuid, deferred) {
    var self = this;
    for(var i = 0; i < this.participants.length; i++) {
        var participant = this.participants[i];
        if(participant.uuid === participant_uuid) {
            logger.info('Participant uuid was equivalent');
            if(participant.socket_id === socket_id) {
                logger.info('Participant socket id was equivalent');
                deferred.reject();
            }
            else {
                logger.debug('Found duplicate uuid with different socket id. Removing ', participant.socket_id, participant_uuid);
                logger.debug('Not removing ', socket_id, participant_uuid);
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
        logger.info('adding participant', participant_uuid);
        var deferred = Q.defer();
        var self = this;
        deferred.promise.then(function(resolve) {
            self.participants.push(new Participant(socket_id, participant_uuid));
            logger.info('Added participant. uuid', participant_uuid, 'socket id', socket_id);
            if(typeof(resolve) === 'string') {
                self.disconnect(resolve);
            }
        }, function(reject) {
            logger.info('Participant socket was equivalent');
        });
        this.isUnique(socket_id, participant_uuid, deferred);
    }
};

/**
 * Disconnects user from socket server.
 * Emits `remote_disconnect` with reason `removed_by_host`.
 * @param  Socket    socket to be disconnected
 * @return Boolean   returns true if successful.
 */
Participants.prototype.disconnectSocket = function(socket) {
    if(typeof(socket) !== 'undefined') {
        logger.debug('Disconnecting socket with id', socket.id);
        socket.emit('remote_disconnect', 'removed_by_host');
        socket.disconnect();
        return true;
    }
    else {
        return false;
    }
};


Participants.prototype.disconnect = function(socket_id) {
    logger.info('Disconnecting socket with id', socket_id);
    try {
        if(socket_id && typeof socket_id === 'string') {
            var sock = io.sockets.connected[socket_id];
            if(typeof(sock) !== 'undefined') {
                this.disconnectSocket(sock);
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
        logger.error(err.message);
    }
};

Participants.prototype.remove = function(socket_id) {
    logger.info('Remove participant called. Removing participant with socket id', socket_id);
    if(socket_id && typeof socket_id === 'string') {
        var removedParticipant = this.retrieve(socket_id);
        var reject = _.reject(
            this.participants,
            function(participant) {
                return participant.socket_id === socket_id;
            });
        logger.info('reject', typeof(reject));
        if(Array.isArray(reject)) {
            logger.debug('reject is array', reject);
            this.participants = reject;
            logger.debug(this.participants.length);
        }
        return removedParticipant;
    }
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
