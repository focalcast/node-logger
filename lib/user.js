var defined = require('defined');
var slack = require('./slackwebhook.js');

class User {
    constructor(session, socket) {
        this.session = session;
        this.socket = socket;
        this.setListeners();
        this.session.userJoined();
        this.socket.join(this.session.roomname);
    }
    setListeners() {
        this.socket.once('active', () => {
            this.session.participants.setActive(this.id);
        });
        this.on('pexip::set_screenshare', (enabled) => {
            if(typeof enabled === 'boolean') {
                this.screenShareEnabled = enabled;
            }
            this.emit('pexip::is_screenshare_enabled', this.session.screenShareEnabled);
        });
        this.on('send_message', (message) => {
            // global.logger.debug('Got message: ' + message);
            this.broadcast('incomming', message);
        });
        this.on('auth', (message) => {
            //global.logger.info('Got auth');
            //global.logger.info(message);
            this.session.setHost(this.socket, message);
            //Slack notification, auth sent
            try {
                var m = JSON.parse(JSON.stringify(message));
                //delete presentations from message
                delete m.owner.presentations;
                new slack(slack.type.session_started, JSON.stringify(m));
            }
            catch(err) {
                global.logger.error('Error sending slack webhook for session started', err);
                new slack(slack.type.error, 'Error sending slack webhook for session\n' + JSON.stringify(err));
                global.opbeat.captureError(err, {
                    extra: {
                        message: 'Error sending slack webhook for session',
                        socketid: this.id
                    }
                });
            }
        });
        this.on('token_renew', (token) => {
            this.session.host.token = token;
        });
        this.on('focalcast_pexip', (message) => {
            if(message === 'focalcast_open' || message === 'focalcast_close') {
                this.session.FocalcastToggleState = message;
            }
            this.session.emit('focalcast_pexip', message);
        });

        this.on('get_focalcast_pexip_status', () => {
            this.session.retrieveFocalcastToggleState(this.socket);
        });

        this.on('session_updated', () => {
            this.session.update();
        });
        this.on('error', (err) => {
            this.log(`Socket error - ${err.stack}`);
            global.opbeat.captureError(err, {
                extra: {
                    message: 'Socket error'
                }
            });
        });

        this.on('identity', (message) => {
            var jsonObj = JSON.parse(message);
            if(jsonObj.identity === 'android') {
                this.socket.join(jsonObj.identity);
            }

        });

        this.on('disconnect', (reason) => {
            this.log('Disconnect called');
            this.session.removeParticipant(this.socket);
            return;
        });
        this.on('reverb', (message) => {
            this.emit('incomming', message);
        });

        this.on('end_presentation', (message) => {});

        this.on('add_user', (data) => {
            this.session.addParticipant(this.socket, data);
            if(defined(this.session.siteFeatures) && defined(this.session.host)){
                this.session.host.sendHideAnnotations(this.socket);
            }
        });

        this.on('user_info', (message) => {});

        this.on('update_user_info', (message) => {
            this.session.update();
        });


        this.on('make_host', (message) => {
            //socket.session().users.makeHost(message);
            this.session.io.sockets.in(this.roomname).emit('user_array', this.session.users.getParticipantList());

        });

        this.on('host_ended_session', (message) => {
            this.log(`Host Ended Session - ${message}`);
            this.session.endSession(this.socket);
        });

        this.on('connected_event', (message) => {});

        this.on('get_userarray', (message) => {
            //socket.emit('user_array', socket.session().users.getParticipantList());
        });

        this.on('get_presentation', (message) => {
            //socket.emit('load_presentation', socket.session().toJSONString());
        });

        this.on('set_presentation', (message) => {
            this.session.setPresentation(this.socket, message);
            new slack(slack.type.presentation, JSON.stringify(message));
        });

        this.on('retrieve_annotations', (message) => {
            this.session.retrieveSlideAnnotations(this.socket);
            return;
        });

        this.on('send_all_to_host', (message) => {
            // this.session.setSendAllToMaster();
        });

        this.on('force_slide', (slide) => {

            // session.annotationsDirty = true;
            this.session.update();

            if(this.session.shouldUpdateSlide(slide)) {
                this.session.updateSlide(slide);
            }

        });

        this.on('get_slide', () => {
            global.logger.debug('Got slide call');
            if(defined(this.session.session.current_slide)) {
                this.emit('set_slide', this.session.session.current_slide.url);
            }
        });

        this.on('participant_disconnect', (participant) => {
            this.log(`Participant disconnect - ${participant}`);
            this.session.removeParticipant(this.socket, participant);
        });


        this.on('set_verbosity', (bool) => {
            global.VERBOSE = bool;
        });

        this.on('debug_please', () => {
            var fs = require('fs');
            fs.readFile('./logs/focalnode-debug.log', 'utf8', (err, data) => {
                if(err) {
                    this.emit('debug_info', err);
                }
                else {
                    this.emit('debug_info', data);
                }
            });
        });

        this.on('text', (message) => {
            this.session.broadcastAnnotations('text', message, this.socket);
            this.session.addAnnotation(message);
        });

        this.on('path_part', (message) => {
            this.session.broadcastAnnotations('path_part', message, this.socket);
            //socket.broadcast.to(socket.roomname).emit('path_part', message);
        });

        this.on('path', (message) => {
            this.session.addAnnotation(message);
        });

        this.on('undo', () => {
            this.session.undoAnnotation();
        });

        this.on('clear', () => {
            this.session.clearAnnotations();
        });
    }
    get roomname() {
        return this.session.roomname;
    }
    set roomname(roomname) {
        throw new Error('Cannot set roomname');
    }
    set id(id) {
        throw new Error('Cannot set id');
    }
    get id() {
        return this.socket.id;
    }
    on(evt, fn) {
        this.socket.on(evt, fn);
    }
    emit(evt, message) {
        this.socket.emit(evt, message);
    }
    broadcast(evt, message) {
        this.socket.broadcast.to(this.roomname).emit(evt, message);
    }
    log(message) {
        global.logger.debug(`Session: ${this.roomname} -- Socket: ${this.id} -- ${message}`);
    }

}

module.exports = User;
