var base = require('./base-api.js');
var util = require('util');
var request = require('request');

class Annotation extends base.ApiCall{
    constructor(api, success, error){
        var path = util.format('/session/%s/', api.sessionUuid);
        super(api, path, success, error);
    }
    createUrl(annotation){
        var path = util.format('presentation/%s/slide/%s/annotation/',
        annotation.presentation,
        annotation.slide);
        this.appendUrl(path);
    }
    get(annotation){
        this.createUrl(annotation);
        request.get(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
    add(annotation, path){
        this.createUrl(annotation);
        this.data = path;
        request.post(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
    undo(annotation){
        this.createUrl(annotation);
        this.appendUrl('undo/');
        request.post(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
    clear(annotation){
        this.createUrl(annotation);
        this.appendUrl('clear/');
        request.post(
            this.callback.options.url,
            this.callback.options.value,
            this.callback.options.response
        );
    }
}


module.exports = Annotation;
