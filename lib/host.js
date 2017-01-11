class Host {
    constructor(session, host) {
        this.session = session;
        this.host = host;
    }
    set host(host) {
        this._host = host;
        this.setListeners();
        this.session.clearEndSessionTimeout();
        redisPub.hset(this.session.getHash(), 'masterSocket', this._host.id);
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
        redisPub.hset(this.session.getRoomHash(), 'token', token);

    }
    get token() {
        return this._token;
    }
    set authentication(auth) {
        this._authentication = auth;
        this.session.setSession(auth.session);
        this.token = auth.token;
        this.owner = auth.owner;
        this.sendAll = auth.owner.send_all_to_host;
        redisPub.hmset(this.session.getHash(), {
            'token': auth.token,
            'owner': auth.owner.email,
            'send_all_to_host': auth.owner.send_all_to_host,
            'usid': auth.session.usid
        });
        this.session.emit('poll_active');
        this.session.active = true;
        this.session.update();
    }
    get authentication() {
        return this._authentication;
    }
    setListeners() {
        this.host.emit('get_participant_data');
        this.host.on('get_active_users', () => {
            this.broadcast('poll_active', '', this.host);
        });
    }
    unsetListeners() {
        this.host.off('get_active_users');
    }
    send(evt, message) {
        io.to(this.host.id).emit(evt, message);
    }
    is(socket) {
        return this.host.id === socket.id;
    }
    broadcast(evt, message) {
        this.host.broadcast.to(this.session.roomname).emit(evt, message);
    }


}
module.exports = Host;
