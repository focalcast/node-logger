

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
}
module.exports = Annotation;
