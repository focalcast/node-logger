var Paper = require('paper');
var defined = require('defined');

class BackgroundImage {
    constructor(parent) {
        this.parent = parent;
        this.imageLayer = new Paper.Layer();
        this.imageLayer.fitBounds(this.parent.project.bounds);
        this.imageLayer.name = 'image layer';
        this.parent.addLayer(this.imageLayer);
        this.imageLayer.sendToBack();
        this.image = new Paper.Raster();
        this.image.crossOrigin = 'anonymous';
        this.imageLayer.addChild(this.image);
        this.image.onLoad = () => {
            this.resize();
            try {
                this.parent.letterBox();
                if(defined(this.callback)) {
                    this.callback();
                    this.callback = undefined;
                }
            }
            catch(err) {
                global.logger.error(err);
            }
        }
    }
    resize() {
        if(this.image.width > 1920) {
            global.logger.debug('Setting orig width', this.image.width);
            this.origWidth = this.image.width;
        }
        else {
            this.origWidth = 1920;
        }
        if(this.image.height > 1080) {
            global.logger.debug('Setting orig height', this.image.height);
            this.origHeight = this.image.height;
        }
        else {
            this.origHeight = 1080;
        }
        this.heightFactor = (720 / this.image.height);
        this.widthFactor = (1280 / this.image.width);
        if(this.heightFactor < this.widthFactor) {
            global.logger.debug('Maximizing height');
            this.image.width = (this.parent.height / this.image.height) * this.image.width;
            this.image.height = this.parent.height;
        }
        else {
            global.logger.debug('Maximizing width');
            this.image.height = (1280 / this.image.width) * this.image.height;
            this.image.width = 1280;
        }
        if(this.image.width < 1280){
            this.absWidth = this.image.width;
        }else{
            this.absWidth = 1280;
        }
        if(this.image.height < 720){
            this.absHeight = this.image.height;
        }else{
            this.absHeight = 720;
        }
        this.image.position = this.parent.view.center;
    }
    set url(url) {
        if(this._url !== url) {
            this.parent.log(`Setting background image -- ${url}`);
            this._url = url;
            this.image.source = url;
        }else{
            if(defined(this.callback)){
                this.callback();
                this.callback = undefined;
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
