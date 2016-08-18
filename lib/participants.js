var _ = require('underscore');

var Participant = function(socket_id, participant_uuid) {
    this.socket_id = socket_id;
    this.uuid = participant_uuid;
}
var Participants = function() {
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
        return participant.uuid;
    }
    else {
        throw new Error('Participant not found', socket_id, this.participants);
    }
};

Participants.prototype.removeDuplicates = function(socket_id, participant_uuid) {
    var self = this;
    _.each(this.participants, function(participant) {
        self.participants = _.reject(self.participants, participant_uuid);
        self.participants = _.reject(self.participants, socket_id);
    });
};

Participants.prototype.add = function(socket_id, participant_uuid) {
    if(
        socket_id &&
        participant_uuid &&
        typeof socket_id === 'string' &&
        typeof participant_uuid === 'string'
    ) {
        logger.info('adding participant');
        this.removeDuplicates(socket_id, participant_uuid);
        this.participants.push(new Participant(socket_id, participant_uuid));
    }
};

Participants.prototype.remove = function(socket_id) {
    if(socket_id && typeof socket_id === 'string') {
        var removedParticipant = this.retrieve(socket_id);
        this.participants = _.reject(
            this.participants, {
                'socket_id': socket_id
            }
        );
        logger.info('participants', this.participants);
        return removedParticipant;
    }
};

Participants.prototype.filter = function(participants) {
    var self = this;

    _.each(participants, function(participant) {
        self.participants = self.participants.filter(function(obj) {
            obj.uuid !== participant.uuid;
        });

    });
};

module.exports = Participants;
