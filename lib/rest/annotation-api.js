var base = require('./base-api.js');
var util = require('util');
var request = require('request');

var Annotation = function(_annotation, success, error){
    this.url = this.createUrl(_annotation);
    base.ApiCall.call(this, this.url, success, error);
    var successCode = 200;
    this.setSuccessCode(successCode);
};

Annotation.prototype = Object.create(base.ApiCall.prototype);
Annotation.constructor = Annotation;

Annotation.prototype.createUrl = function(_annotation){
    var url = util.format(
        '/session/%s/presentation/%s/slide/%s/annotation/',
        _annotation.session,
        _annotation.presentation,
        _annotation.slide);
    return url;
};

var getAnnotations = function(_annotation, success, error){
    var annotation = new Annotation(_annotation, success, error);
    request.get(
        annotation.options.value,
        annotation.callback
    );
};

var addAnnotation = function(_annotation, path, success, error){
    var annotation = new Annotation(_annotation, success, error);
    annotation.options.value.body = path;
    request.post(
        annotation.options.value,
        annotation.callback
    );
};

var undoAnnotation = function(_annotation, success, error){
    var annotation = new Annotation(_annotation, success, error);
    annotation.appendUrl('undo/');
    request.post(
        annotation.options.value,
        annotation.callback
    );
};

var clearAnnotations = function(_annotation, success, error){
    var annotation = new Annotation(_annotation, success, error);
    annotation.appendUrl('clear/');
    request.post(
        annotation.options.value,
        annotation.callback
    );
};

module.exports = {
    get : getAnnotations,
    add : addAnnotation,
    undo : undoAnnotation,
    clear : clearAnnotations
};
