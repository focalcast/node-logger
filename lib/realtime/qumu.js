var defined = require('defined');
var request = require('request');
var Q = require('q');
var Log = require('./paper/canvas/log.js');
var STATE = {
    LIVE: 'LIVE',
    PUBLISHED: 'PUBLISHED',
    POST_EVENT: 'POST_EVENT'
}
var basicAuth = (username, password) => {
    let base64Credentials = new Buffer(username + ":" + password).toString("base64");
    return `Basic ${base64Credentials}`;
}
class Qumu {
    static validateParams(params) {
        if(!defined(params.guid) || !defined(params.username) || !defined(params.password)) {
            throw new Error('Invalid Qumu credentials');
            process.exit(1);
        }
    }
    constructor(parent, params) {
        Qumu.validateParams(params);
        this.parent = parent;
        this.streamingCanvas = parent;
        this.params = params;
        new Log(this, 'Qumu');
        this.auth = basicAuth(params.username, params.password);
        this.log.debug(this.auth, this.params);
    }
    get guid(){
        return this.params.guid;
    }
    get roomname(){
        return this.params.roomname;
    }
    get domain() {
        return `https://${this.params.subdomain}.qumucloud.com`;
    }
    get kuluApiPath() {
        return `/api/2.1/rest/kulus/${this.params.guid}`;
    }
    queryParams(state) {
        return `?generateServerLinks=true&type=STATE_CHANGE&data=${state}&timestamp=${new Date().getTime()}`;
    }
    start() {
        this.log.debug('Starting live kulu');
        var deferred = Q.defer();
        let path = `${this.kuluApiPath}/live/events`;
        let queryParams = this.queryParams(STATE.LIVE);
        request.post({
            url: `${this.domain}${path}${queryParams}`,
            headers: {
                Authorization: this.auth
            },
            timeout: 10000
        }, (err, resp, body) => {
            if(err) {
                this.log.error('Error creating live event', err);
                deferred.reject();
            } else {
                this.log.debug('Kulu is now live');
                deferred.resolve();
            }
        });
        return deferred.promise;
    }
    create() {
        var deferred = Q.defer();
        let queryParams = `?generateServerLinks=true`;
        var req = request.post({
            url: `${this.domain}${this.kuluApiPath}${queryParams}`,
            headers: {
                Authorization: this.auth
            },
            timeout: 10000
        }, (err, resp, body) => {
            if(err) {
                this.log.error('Error creating live event', err);
                deferred.reject(false);
            } else {
                this.log.debug('Successfully created kulu');
                deferred.resolve(true);
            }
        });

        return deferred.promise;
    }
    stop() {
        this.log.debug('Stopping live kulu');
        var deferred = Q.defer();
        let domain = `https://${this.parent.subdomain}.qumucloud.com`;
        let path = `${this.kuluApiPath}/live/events`;
        let queryParams = this.queryParams(STATE.POST_EVENT);
        try {
            var req = request.post({
                url: `${this.domain}${path}${queryParams}`,
                headers: {
                    Authorization: this.auth
                },
                timeout: 10000
            }, (err, resp, body) => {
                if(err) {
                    this.log.error('Error changing kulu state', err);
                    deferred.reject();
                } else {
                    this.log.debug('Succesfully ended live kulu', JSON.parse(body).job);
                    if(JSON.parse(body).job.percentageProgress < 100){
                        return this.stop();
                    }else{
                        return this.publish();
                    }
                    // this.progressUrl = body.previewCreationProgressUrl;
                    // return this.republish();
                }
            });
        } catch(err) {
            this.log.error('Error stopping kulu', err);
        }
        return deferred.promise;
    }
    republish() {
        this.log.debug('Republishing kulu');
        return this.checkProgress().then((resolved) => {
            return this.publish();
        });
    }
    checkProgress() {
        let deferred = Q.defer();
        setTimeout(() => {
            this.getProgress().then((success) => {
                deferred.resolve();
            }, (err) => {
                return this.checkProgress();
            }).catch((err) => {
                this.log.error('Error checking progress');
            });
        })
        return deferred.promise;
    }
    getProgress() {
        if(!defined(this.progressUrl)) {
            throw new Error('Progress url undefined');
        }
        let deferred = Q.defer();
        var req = request.get({
            url: `${this.progressUrl}`,
            headers: {
                Authorization: this.auth
            },
            timeout: 10000
        }, (err, resp, body) => {
            if(err) {
                throw new Error('Error retrieving kulu progress', err, resp.statusCode);
            } else {
                if(body.hasOwnProperty('percentageProgress')) {
                    if(body.percentageProgress < 100) {
                        return deferred.reject();
                    } else {
                        return deferred.resolve();
                    }
                } else {
                    this.log.debug('Progress body', body);
                }
            }
        });
        return deferred.promise;
    }
    publish() {
        this.log.debug('Publishing kulu');
        let deferred = Q.defer();
        request.post({
            url: `${this.domain}${this.kuluApiPath}?generateServerLinks=true&includeSlides=true`,
            headers: {
                Authorization: this.auth
            },
            timeout: 10000,
            'content-type': 'application/json',
            body: JSON.stringify({
                kulu: {
                    state: STATE.PUBLISHED
                }
            })
        }, (err, resp, body) => {
            if(err) {
                this.log.error('Error publishing kulu', err);
                deferred.reject();
            } else {
                this.log.info('Kulu succesfully published');
                deferred.resolve();
            }
        });
        return deferred.promise;
    }
}
module.exports = Qumu;
