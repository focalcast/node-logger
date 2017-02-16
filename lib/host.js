var redis = require('./redis.js');
var defined = require('defined');
class Host {
    constructor(session, host) {
        this.session = session;
        this.host = host;
        global.logger.debug('Creating host', session.roomname, host.id);
        session.active = true;
    }
    set host(host) {
        this._host = host;
        this.setListeners();
        this.session.clearEndSessionTimeout();
        redis.redisPub.hset(this.session.getHash(), 'masterSocket', this._host.id);
    }
    get socket() {
        return this.host;
    }
    set socket(socket) {
        throw new Error('Cannot set socket');
    }
    get id() {
        return this.host.id;
    }
    set id(id) {
        throw new Error('Cannot set id');
    }
    get host() {
        return this._host;
    }
    set owner(owner) {
        this._owner = owner;
        this.session.api.auth.owner = owner;
    }
    get owner() {
        return this._owner;
    }
    set token(token) {
        this._token = token;
        this.session.api.auth.token = token;
        redis.redisPub.hset(this.session.getRoomHash(), 'token', token);

    }
    get token() {
        return this._token;
    }
    set authentication(auth) {
        global.logger.debug('setting auth');
        this._authentication = auth;
        this.token = auth.token;
        this.owner = auth.owner;
        this.sendAll = auth.owner.send_all_to_host;
        redis.redisPub.hmset(this.session.getHash(), {
            'token': auth.token,
            'owner': auth.owner.email,
            'send_all_to_host': auth.owner.send_all_to_host,
            'usid': auth.session.usid
        });
        // this.session.session = auth.session;
        this.session.update(true);
        this.session.emit('poll_active');
        this.session.active = true;
    }
    get authentication() {
        return this._authentication;
    }
    setListeners() {
        var self = this;
        this.host.emit('get_participant_data');
        this.getActiveUsers = () => {
            this.broadcast('poll_active', '', this.host);
        };
        this.host.on('get_active_users', () => {
            this.getActiveUsers();
        });
        this.host.on('site_features', (features) => {
            this.setSiteFeatures(features);
            if(!this.sentHideAnnotations){
                this.sendHideAnnotations();
            }
        });
        this.host.on('set_uuid', (uuid) => {
            this.uuid = uuid;
        });
        this.host.on('poll', (poll)=>{
            this.broadcast('poll', poll);
        });
    }
    unsetListeners() {
        this.host.removeListener('get_active_users', this.getActiveUsers);
    }
    setSiteFeatures(features) {
        this.session.siteFeatures = features;
    }
    send(evt, message) {
        this.session.io.to(this.host.id).emit(evt, message);
    }
    is(socket) {
        if(!defined(socket) || !defined(this.host)){
            return false;
        }
        return this.host.id === socket.id;
    }
    broadcast(evt, message) {
        this.host.broadcast.to(this.session.roomname).emit(evt, message);
    }
    sendHideAnnotations(socket){
        if(defined(socket) && this.session.hasOwnProperty('siteFeatures') && this.session.siteFeatures.hideAnnotations){
            this.session.io.to(socket.id).emit('hide_annotations', this.uuid);
        }else if(this.session.hasOwnProperty('siteFeatures') && this.session.siteFeatures.hideAnnotations) {
            this.session.emit('hide_annotations', this.uuid);
            this.sentHideAnnotations = true;
        }
    }
}
module.exports = Host;
