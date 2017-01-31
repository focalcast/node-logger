var defined = require('defined');
var GaugeTime = require('./gauge-time.js');

class Annotations{
    constructor(presentation){
        this.presentation = presentation;
        this.dirty = true;
    }
    get session(){
        return this.presentation.session;
    }
    set session(s){}
    get api(){
        return this.session.api;
    }
    set api(api){}
    get roomname(){
        return this.session.roomname;
    }
    set roomname(roomname){}
    get(){
        var timer = new GaugeTime();
        var self = this;
        var success = function(body) {
            self.annotations = JSON.parse(body);
            self.emit('clear');
            self.emit('annotations', self.annotations);
            // self.session.metrics.histogram('annotations_retrieval_time', timer.end(), self.annotations.length);
        };
        var error = function(error, response) {
            if(typeof response !== 'undefined') {
                // self.session.metricsError.increment('retrieving_annotations');
                global.logger.error(`Session: ${self.roomname} --`, 'Error retrieving annotations:', response.statusCode, response.statusMessage);
            }
        };
        if(this.dirty) {
            this.dirty = false;
            try {
                var annotation = this.create();
                this.api.annotations(success, error).get(annotation);
            }
            catch(err) {
                global.logger.error(`Session: ${this.roomname} --`, 'Error getting annotations', err);
                global.opbeat.captureError(err, {
                    extra: {
                        message: 'Error retrieving annotations',
                        session: this.roomname
                    }
                });
            }
        }
        else {
            if(defined(this.annotations)) {
                self.eit('clear');
                self.emit('annotations', this.annotations);
            }
        }
    }
    undo(){
        var self = this;
        var success = function(body) {
            self.session.emit('undo');
            // self.session.metrics.increment('undo_annotation');
        };
        var error = function(error, response, options) {
            global.logger.error(`Session: ${self.roomname} -- Error on undo ${response.statusCode} ${response.statusMessage}`);
        };
        try {
            var annotation = this.create();
            this.api.annotations(success, error).undo(annotation);
        }
        catch(err) {
            global.logger.error(`Session: ${self.roomname} -- Cannot perform undo --  ${err}`);
        }
    }
    clear(){
        var self = this;
        var success = function(body) {
            self.session.emit('clear');
            global.logger.debug('clear success');
            // self.session.metrics.increment('clear_annotations');
        };
        var error = function(error, response) {
            global.logger.error(`Error on clear annotations: ${response.statusCode} ${response.statusMessage}`);

        };
        try {
            var annotation = this.create();
            this.api.annotations(success, error).clear(annotation);
        }
        catch(err) {
            global.logger.error('Cannot clear annotations.', err);
        }
    }
    add(path){
        var self = this;
        var success = function(body) {
            self.dirty = true;
            // self.session.metrics.increment('added_annotation');
        };
        var error = function(error, response) {
            global.logger.error(`Session: ${self.roomname} --`, 'Error submitting annotation:', response.statusCode, response.statusMessage);
        };

        try {
            var annotation = this.create();
            this.api.annotations(success, error).add(annotation, path);
        }
        catch(err) {
            global.opbeat.captureError(err, {
                extra: {
                    message: 'Error adding annotation',
                    session: this.roomname
                }
            });
            if(err instanceof Error) {
                global.logger.error(`Session: ${this.roomname} --`, 'Error adding annotation', err.message);
            }
            else {
                global.logger.error(`Session: ${this.roomname} --`, 'Error adding annotation');
            }
        }
    }
    retrieve(socket){
        var timer = new GaugeTime();
        var self = this;
        var success = function(body) {
            self.annotations = JSON.parse(body);
            // global.logger.debug('Got annotations', self.annotations.annotations.length);

            socket.emit('clear');
            socket.emit('annotations', self.annotations);
            // self.session.metrics.histogram('annotations_retrieval_time', timer.end(), self.annotations.length);
        };
        var error = function(error, response) {
            if(typeof response !== 'undefined') {
                // self.metricsError.increment('retrieving_annotations');
                global.logger.error('Error retrieving annotations:', response.statusCode, response.statusMessage);
            }
        };
        if(this.dirty) {
            this.dirty = false;
            try {
                var annotation = this.create();
                this.api.annotations(success, error).get(annotation);
            }
            catch(err) {
                global.logger.error('Error getting annotations', err);
            }
        }
        else {
            if(defined(this.annotations)) {
                // global.logger.info('Annotations not dirty', this.annotations.length);
                socket.emit('clear');
                socket.emit('annotations', this.annotations);
            }
        }
    }
    emit(event, message){
        try {
            if(defined(this.session.host) && this.session.host.sendAll) {
                this.session.host.send(event, message);
            }
            else {
                this.session.emit(event, message);
            }
        }
        catch(error) {
            global.logger.error(`Session: ${self.session.roomname} -- Errror emitting annotation`, error);
        }
    }
    broadcast(event, message, socket){
        try {
            if(defined(this.session.host) && this.session.host.sendAll) {
                if(!this.session.host.is(socket)) {
                    this.session.host.send(event, message);
                }
            }
            else {
                this.session.broadcast(event, message, socket);
            }
        }
        catch(error) {
            global.logger.error(`Session: ${self.roomname} -- Error broadcasting annotations -- ${error}`);
        }
    }
    create(){
        try {
            var annotation = {
                session: this.session.roomname,
                presentation: this.presentation.uuid,
                slide: this.presentation.slide.index
            };
            return annotation;
        }
        catch(err) {
            global.logger.error(err);
            // this.session.metricsError.increment('creating_annotation');
        }
    }
}
module.exports = Annotations;
