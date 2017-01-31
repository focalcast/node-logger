var defined = require('defined');
var Line = require('./line.js');
var Owner = require('./owner.js');
var _ = require('underscore');
class UserLines{
    constructor(parent){
        this.parent = parent;
        this.lines = [];
    }
    find(annotation){
        if(!defined(annotation.owner)){
            throw new Error('Annotation has no property owner');
        }
        var owner = _.findWhere(this.lines, {'uuid': annotation.owner});
        if(!defined(owner)){
            owner = new Owner(this.parent, annotation.owner);
            this.lines.push(owner);
        }
        return owner;
    }
}
module.exports = UserLines;
