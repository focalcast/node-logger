var socketStream = require('socket.io-stream');
class Recorder {
    constructor(session, socket, proc) {
        this.session = session;
        this.socket = socket;
        this.proc = proc;
        this.init();
    }
    get host() {
        return this.session.host;
    }
    init() {
        var self = this;
        //Emits recorder status to host
        this.socket.on('recorder_status', (msg) => {
            this.host.send('recorder_status', msg);
        });
        socketStream(this.host.socket).on('audio_data', (stream, data) => {
            // global.logger.debug('Socket stream audio_data');
            try {
                // stream.pipe(self.proc.stdio[3]);
            } catch(err) {
                global.logger.debug('err', err);
            }
        });
        // this.host.socket.on('audio_data', this.receiveAudioData);
        //Remove listener on socket disconnect
        this.socket.on('disconnect', () => {
            this.host.socket.removeListener('audio_data', this.receiveAudioData);
        });
    }
    receiveAudioData(data) {
        //Retransmits audio data
        this.socket.emit('audio_data', data);
    }
}
module.exports = Recorder;
