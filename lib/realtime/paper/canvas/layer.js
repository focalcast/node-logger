var Paper = require('paper');
var defined = require('defined');
var Log = require('./log.js');
class Layer{
    constructor(parent, name){
        new Log(this, name);
        this.parent = parent;
        this.renderer = parent;
        this.name = name;
        this.layer = new Paper.Layer();
        this.layer.name = name;
    }
    set layer(layer){
        this.log.debug(this.name);
        this._layer = layer;
        this.renderer.addLayer(this._layer);
    }
    get layer(){
        return this._layer;
    }
    getLayer(name){
        return this.renderer.project.layers[name];
    }
}
module.exports.Layer = Layer;

class AnnotationLayer extends Layer{
    constructor(parent){
        super(parent, 'annotations');
        this.layer.bringToFront();
    }
    set backgroundImage(backgroundImage){}
    get backgroundImage(){return this.parent.backgroundImage;}
    set layer(layer){
        this._layer = layer;
        this.renderer.addLayer(this._layer);
    }
    get layer(){
        this._layer.activate();
        return this._layer;
    }
    clear(){
        this.layer.clear();
    }
    undo(){
        this.layer.children.pop();
    }
}
module.exports.AnnotationLayer = AnnotationLayer;

class Background extends Layer {
    constructor(parent, name){
        super(parent, 'background');
        this.layer.sendToBack();
        this.background = new Paper.Path.Rectangle(new Paper.Point(0,0), new Paper.Size(this.parent._width, this.parent._height));
        this.background.fillColor = 'black';
        // this.layer.addChild(this.background);
    }
}
module.exports.Background = Background;

class LetterBox extends Layer{
    constructor(parent) {
        super(parent, 'letterbox');
        this.layer.bringToFront();
    }

    get backgroundImage() {
        return this.renderer.backgroundImage;
    }
    get image(){
        return this.backgroundImage.image;
    }
    get bounds() {
        if(defined(this.backgroundImage.image) && defined(this.backgroundImage.image.bounds)) {
            this.log.info('Background image has bounds!');
            return this.backgroundImage.image.bounds;
        } else {
            this.log.info('Backgournd image does not have bounds');
            return { left: 0, right: 0, top: 0, bottom: 0 };
        }
    }
    get height() {
        //Canvas height
        return this.renderer._height;
    }
    get width() {
        //Canvas width
        return this.renderer._width;
    }
    get widescreen() {
        //Returns true if the image's aspect ratio is > 16:9
        return this.backgroundImage.widescreen;
    }
    rectValues(x, y, width, height) {
        return {
            x: x,
            y: y,
            width: width,
            height: height
        };
    }
    createRect(letterbox) {
        var x, y, width, height;
        // var halfWidth = (this.width-this.image.width)/2;
        // var halfHeight = (this.height-this.image.height)/2;
        // this.log.error('half and half', halfWidth, halfHeight);
        switch(letterbox) {
            case 'A':
                x = 0;
                y = 0;
                width = this.widescreen ? 960 : this.bounds.left
                height = this.widescreen ? this.bounds.top : 540;
                // width = this.widescreen ? this.width : halfWidth;
                // height = this.widescreen ? halfHeight : this.height;
                break;
            case 'B':
                x = this.widescreen ? 0 : this.bounds.right;
                y = this.widescreen ? this.bounds.bottom : 0;
                width = this.widescreen ? 960 : 960-this.bounds.right;
                height = this.widescreen ? 540-this.bounds.bottom : 540;
                break;

        }
        this.log.warn('letter box', x, y, width, height);
        let point = new Paper.Point(x, y);
        let size = new Paper.Size(width, height);
        let rect = new Paper.Path.Rectangle(point, size);
        rect.fillColor = 'black';
        this.layer.addChild(rect);
        return rect;
    }

    update() {
        this.layer.bringToFront();
        this.layer.clear();
        this.log.info('Bounds', this.bounds.left, this.bounds.top, this.bounds.right, this.bounds.bottom);
        let rectA = this.createRect('A');
        let rectB = this.createRect('B');
        this.layer.bringToFront();
    }
}
module.exports.LetterBox = LetterBox;
