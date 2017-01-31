var Annotation = require('./annotation.js');
var defined = require('defined');
var AnnotationType = require('./annotation-type.js');
var Paper = require('paper');

const smoothOptions = {
    type: 'catmull-rom',
    factor: 15
};
const simplifyFactor = 5;

class Line extends Annotation {
    static isType(type) {
        if(type === AnnotationType.LINE.value || type === AnnotationType.LASER.value || type === AnnotationType.ERASER.value) {
            return true;
        }
        return false;
    }
    constructor(parent, owner, annotation, callback) {
        super(parent, owner, annotation);
        this.setBlendMode();
        this.callback = callback

        this.isLaser = this.type === AnnotationType.LASER.value;
        this.isEraser = this.type === AnnotationType.ERASER.value;
        this.path = new Paper.Path();
        this.layer.addChild(this.path);
        this.path.owner = this.owner;
        this.path.strokeCap = 'round';

    }
    actions(action) {
        var ACTIONS = {
            '-1': this.lineTo,
            '-2': this.moveTo,
            '-3': this.start,
            '-4': this.end,
            '-6': this.clear
        };
        return ACTIONS[action.toString()];
    }
    erase() {
        if(!this.isEraser) {
            return;
        }
        if(!defined(this.path) || !defined(this.path.lastSegment)) {
            return;
        }
        var options = {
            tolerance: 3,
            fill: true,
            guides: false,
            segments: true,
            stroke: true
        };
        try {
            for(var i = 0; i < this.layer.children.length; i++) {
                var child = this.layer.children[i];
                var hits = child.hitTestAll(this.path.lastSegment.point, options);

                for(var k = 0; k < hits.length; k++) {
                    var hit = hits[k];
                    if(!hit.item.hasOwnProperty('owner') && hit.item.owner === this.path.owner) {
                        return;
                    }
                    if(hit.item.name === 'eraser' || hit.item.name === 'cursor') {
                        return;
                    }
                    if(hit.type === 'stroke') {
                        global.logger.debug('Removing', hit.type);
                        hit.item.remove();
                    }
                    else if(hit.type === 'fill' && hit.item.className === 'PointText') {
                        global.logger.debug('Removing', hit.type);
                        hit.item.remove();
                    }
                    else if(hit.type === 'segment') {
                        global.logger.debug('Removing', hit.type);
                        hit.item.remove();
                    }
                }
            }
        }
        catch(err) {
            global.logger.error(err);
        }
    }
    clear() {
        global.logger.debug('Action shift clear');
    }
    isLaser() {
        return this.type === AnnotationType.LASER.value;
    }
    set blendMode(blendMode) {
        this._blendMode = blendMode;
    }
    get blendMode() {
        return this._blendMode;
    }
    setBlendMode() {
        switch(this.type) {
            case AnnotationType.LINE.value:
                this._blendMode = 'normal';
                break;
            case AnnotationType.ERASER.value:
                this._blendMode = 'destination-out';
                break;
            case AnnotationType.LASER.value:
                this._blendMode = 'normal';
                break;
        }
    }
    render(annotation) {
        var shouldSmooth = false;
        let actions = annotation.actions;
        while(actions.length > 0) {
            let action = actions.shift();
            switch(action) {
                case -1:
                    this.lineTo(actions.shift(), actions.shift());
                    shouldSmooth = true;
                    break;
                case -2:
                    this.moveTo(actions.shift(), actions.shift());
                    break;
                case -3:
                    this.start(annotation);
                    break;
                case -4:
                    this.end();
                    break;
                case -6:
                    this.clear();
                    break;
            }
            let time = actions.shift();
            if(time < 0) {
                actions.unshift(time);
            }
        }
        if(this.shouldSmooth) {
            this.smooth();
        }
    }
    smooth() {
        if(!this.isEraser) {
            this.path.smooth(smoothOptions);
        }
    }
    simplify() {
        if(!this.isEraser) {
            this.path.simplify(simplifyFactor);
        }
    }
    start(annotation) {
        this.path.strokeColor = annotation.color;
        this.path.strokeWidth = this.parent.scaleX * annotation.stroke;
        this.path.opacity = annotation.alpha;
        // global.logger.debug('Info:', JSON.stringify(annotation));
    }
    lineTo(x, y) {
        x = this.parent.scaleX * x + this.parent.bounds.left;
        y = this.parent.scaleY * y + this.parent.bounds.top;
        let point = new Paper.Point(x, y);
        this.path.add(point);
        this.erase();
    }
    moveTo(x, y) {
        x = this.parent.scaleX * x + this.parent.bounds.left;
        y = this.parent.scaleY * y + this.parent.bounds.top;
        let point = new Paper.Point(x, y);
        this.path.add(point);
        this.erase();
    }
    end() {
        this.simplify();
        if(this.isLaser || this.isEraser) {
            this.path.remove();
        }
        this.parent.update();

        // global.logger.info('Stop:', this.path.exportJSON());
        this.owner.active = undefined;
    }
}

module.exports = Line;
