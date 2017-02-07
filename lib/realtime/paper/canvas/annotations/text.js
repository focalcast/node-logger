var Annotation = require('./annotation.js');
var defined = require('defined');
var Paper = require('paper');

class TextObj extends Annotation {
    constructor(parent, owner, annotation){
        super(parent, owner, annotation);
        this.text = new Paper.PointText();
        this.layer.addChild(this.text);
        this.text.owner = owner;
        this.text.fillColor = 'black';
        this.text.fontFamily = 'Arial, monospace';
        this.text.fontSize = this.parent.scaleX * 25;
        this.actions = annotation.actions;
        while(this.actions.length > 0){
            let action = this.actions.shift();

            if(typeof action !== 'string'){
                action = action.toString();
            }
            if(action === '-7'){
                let x = parseInt(this.actions.shift(), 10);
                let y = parseInt(this.actions.shift(), 10);
                let content = this.actions.shift();
                let style = JSON.parse(this.actions.shift());
                this.start(x, y, content, style);
            }else if(action === '-8'){
                let x = parseInt(this.actions.shift(), 10);
                let y = parseInt(this.actions.shift(), 10);
                let content = this.actions.shift();
                let style = JSON.parse(this.actions.shift());
                this.move(x, y, content, style);
            }else if(action === '-9'){
                let x = parseInt(this.actions.shift(), 10);
                let y = parseInt(this.actions.shift(), 10);
                let content = this.actions.shift();
                let style = JSON.parse(this.actions.shift());
                this.edit(x, y, content, style);
            }
            let time = this.actions.shift();
            if(time < 0){
                this.actions.unshift(time);
            }

        }
    }
    start(x, y, content, style){
        x = this.parent.scaleX * x + this.parent.bounds.left;
        y = this.parent.scaleY * y + this.parent.bounds.top;
        this.position = new Paper.Point(x, y);
        this.text.content = content;
        this.text.point = this.position;
        this.owner.active = undefined;
    }
    move(x,y, content, style){
        x = this.parent.scaleX * x + this.parent.bounds.left;
        y = this.parent.scaleY * y + this.parent.bounds.top;
        this.position = new Paper.Point(x, y);
        this.text.content = content;
        this.text.position = this.position;
    }
    edit(x, y, content, style){
        x = this.parent.scaleX * x + this.parent.bounds.left;
        y = this.parent.scaleY * y + this.parent.bounds.top;
        this.text.setContent(content);

    }
    end(){

    }
}

module.exports = TextObj;
