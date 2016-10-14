var _ = require('underscore');

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
    logger.info(this.participants.length);
    if(participant) {
        return participant;
    }
    else {
        //throw new Error('Participant not found', socket_id, this.participants);
    }
};

Participants.prototype.duplicates = function(participant_uuid){
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

Participants.prototype.isUnique = function(socket_id, participant_uuid) {
    var self = this;
    for(var i = 0; i < this.participants.length; i++) {
        var participant = this.participants[i];
        if(participant.uuid === participant_uuid) {
            logger.info('Participant uuid was equivalent');
            if(participant.socket_id === socket_id) {
                logger.info('Participant socket id was equivalent');
                return false;
            }else{
                logger.debug('Found duplicate uuid with different socket id. Removing ', participant.socket_id, participant_uuid, '\n');
                logger.debug('Not removing ', socket_id, participant_uuid);
                this.remove(participant.socket_id);
            }
        }
    }
    return true;
};

Participants.prototype.add = function(socket_id, participant_uuid) {
    if(
        socket_id &&
        participant_uuid &&
        typeof socket_id === 'string' &&
        typeof participant_uuid === 'string'
    ) {
        logger.info('adding participant', participant_uuid);
        if(this.isUnique(socket_id, participant_uuid)) {
            this.participants.push(new Participant(socket_id, participant_uuid));
        }
        else {
            throw new Error('Participant already exists');
        }
    }
};

Participants.prototype.remove = function(socket_id) {
    if(socket_id && typeof socket_id === 'string') {
        var sock = io.sockets.connected[socket_id];
        if(typeof(sock) !== 'undefined'){
            sock.disconnect();
        }
        var removedParticipant = this.retrieve(socket_id);
        var reject = _.reject(
            this.participants, function(participant){
               return participant.socket_id === socket_id;
        });
        logger.info('reject', typeof(reject));
        if(Array.isArray(reject)){
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
            this.participants, function(participant){
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
