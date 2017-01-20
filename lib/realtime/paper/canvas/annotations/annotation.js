var AnnotationType = require('./annotation-type.js');

class Annotation{
    constructor(parent, owner, annotation){
        this.parent = parent;
        this.owner = owner;
        this.type = annotation.type;
        this.annotation = annotation;
        this.owner.active = this;
    }
    get layer(){
        return this.parent.annotationLayer;
    }
    set layer(l){}

}
module.exports = Annotation;
