var base = require('./base-api.js');
var util = require('util');

var Annotation = function(_annotation, success, error){
    this.url = this.createUrl(_annotation);
    base.ApiCall.call(this.url, success, error);
    var successCode = 200;
    this.setSuccessCode(successCode);
};

Annotation.prototype.createUrl = function(_annotation){
    var url = util.format(
        '/session/%s/presentation/%s/slide/%s/annotation/', 
        _annotation.session, 
        _annotation.presentation, 
        _annotation.slide);
    return url;
};

var getAnnotations = function(_annotation, success, error){
    request.get(
        this.options.value,
        this.callback
    );
};

var addAnnotation = function(_annotation, path, success, error){
    Annotation.call(_annotation, success, error);
    this.options.value.body = path;
    request.post(
        this.options.value,
        this.callback
    );
};

var undoAnnotation = function(_annotation, success, error){
    Annotation.call(_annotation, success, error);
    this.apiUrl.appendUrl('undo/');
    request.post(
        this.options.value,
        this.callback
    );
};

var clearAnnotations = function(_annotation, success, error){
    Annotation.call(_annotation, success, error);
    this.apiUrl.appendUrl('clear/');
    request.post(
        this.options.value,
        this.callback
    );
};

module.exports = {
    get : getAnnotations,
    add : addAnnotation,
    undo : undoAnnotation,
    clear : clearAnnotations
};

