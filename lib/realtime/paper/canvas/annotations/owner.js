var Annotation = require('./annotation.js');
var AnnotationType = require('./annotation-type.js');
var Line = require('./line.js');
var TextObj = require('./text.js');
var defined = require('defined');

class Owner {
    constructor(parent, uuid) {
        this.annotations = [];
        this.parent = parent;
        this.uuid = uuid;
    }
    set active(active){
        this._active = active;
    }
    get active(){
        return this._active;
    }
    getLatest(Obj) {
        return this.active;
        if(this.active && Obj.isType(this.active.type)){
            return this.active;
        }else{
            return undefined;
        }
    }
    render(annotation) {
        var AnnotationObj = AnnotationType.get(annotation.type);
        var latest = this.getLatest(annotation.type);
        if(!defined(latest)){
            latest = new Line(this.parent, this, annotation);
            //latest = new AnnotationObj(this.parent, this, annotation);
        }
        latest.render(annotation);
        return latest;
    }
    renderText(data){
        new TextObj(this.parent, this, data);
    }
}
module.exports = Owner;
