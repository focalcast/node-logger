var Paper = require('paper');
var defined = require('defined');
var Layer = require('../layer.js').Layer;
class BackgroundImage extends Layer{
    constructor(parent) {
        super(parent, 'image layer');
        this.layer.fitBounds(this.parent.project.bounds);
        this.layer.fitBounds(this.parent.project.bounds);
        this.layer.sendToBack();
        this.image = new Paper.Raster();
        this.image.crossOrigin = 'anonymous';
        this.imageLayer.addChild(this.image);
        this.image.onLoad = () => {
            // this.resize(this.image);
            try {
                let temp = this.imageLayer.children['temp'];
                if(defined(temp)) {
                    this.image.width = temp.width;
                    this.image.height = temp.height;
                    this.image.position = temp.position;
                    temp.remove();
                }
                this.parent.letterBox.update();
                if(defined(this.callback)) {
                    global.logger.info('Calling render annotation array from image.onLoad');
                    this.callback();
                    delete this.callback;
                }
            } catch(err) {
                global.logger.error(err);
            }
        }
    }
    get imageLayer(){
        return this.layer;
    }
    resize(image){
        var aspectRatio = (image.width/image.height);
        var width = image.width;
        var height = image.height;
        if( aspectRatio >= 16/9){
            this.widescreen = true;
            //Maximize width
            image.width = this.parent._width;
            image.height = (1/aspectRatio)*this.parent._width;
        }else{
            this.widescreen = false;
            //Maximize height
            image.height = this.parent._height;
            image.width = aspectRatio*this.parent._height;
        }
        this.scaleX = image.width/width;
        this.scaleY = image.height/height;
        image.position = this.parent.view.center;
    }
    resizeOld(image) {
        if(image.width > 1920) {
            global.logger.debug('Setting orig width', image.width);
            this.origWidth = image.width;
        } else {
            this.origWidth = 1920;
        }
        if(image.height > 1080) {
            global.logger.debug('Setting orig height', image.height);
            this.origHeight = image.height;
        } else {
            this.origHeight = 1080;
        }
        this.heightFactor = (this.parent._width / image.height);
        this.widthFactor = (this.parent._width / image.width);
        if(this.heightFactor < this.widthFactor) {
            global.logger.debug('Maximizing height');
            image.width = (this.parent._height / image.height) * image.width;
            image.height = this.parent._height;
        } else {
            global.logger.debug('Maximizing width');
            image.height = (this.parent._width / image.width) * image.height;
            image.width = this.parent._width;
        }
        if(this.image.width < this.parent._width) {
            this.absWidth = image.width;
        } else {
            this.absWidth = this.parent._width;
        }
        if(this.image.height < this.parent._width) {
            this.absHeight = image.height;
        } else {
            this.absHeight = this.parent._width;
        }
        image.position = this.parent.view.center;
        // this.parent.annotationLayer.position = this.parent.view.center;
    }
    set url(url) {
        this.log.debug('got url lol', url);
        if(this._url !== url) {
            this.parent.log(`Setting background image -- ${url}`);
            var temp = new Paper.Raster({ source: url, visible: false, name: 'temp' });
            this.currentSlide = url;
            this.changingSlides = true;
            temp.onLoad = () => {
                if(this.currentSlide === url) {
                    this.imageLayer.addChild(temp);
                   this.resize(temp);
                    // temp.position = this.parent.view.center;
                    temp.visible = true;
                    this.changinglides = false;
                    this._url = url;
                    this.image.source = url;
                } else {
                    temp.remove();
                }
            };
        } else {
            if(defined(this.callback)) {
                global.logger.info('Calling render annotation array from set url');
                this.callback();
                delete this.callback;
            }
        }
    }
    get url() {
        return this._url;
    }
    set callback(callback) {
        this._callback = callback;
    }
    get callback() {
        return this._callback;
    }
}
module.exports = BackgroundImage;
