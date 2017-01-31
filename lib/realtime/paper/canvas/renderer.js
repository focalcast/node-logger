var BackgroundImage = require('./annotations/image.js');
var Paper = require('paper');
var UserLines = require('./annotations/user-lines.js');
var defined = require('defined');

class Renderer {
    constructor(parent) {
        this.parent = parent;
        var canvas = Paper.createCanvas(1280, 720);
        Paper.setup(canvas);
        this._project = Paper.project;
        this.view = this._project.view;
        this.userLines = new UserLines(this);
        this._annotationLayer = new Paper.Layer();
        this._annotationLayer.name = 'annotations';
        this.addLayer(this._annotationLayer);
        this._project.addLayer(this.annotationParent);
        this.backgroundImage = new BackgroundImage(this);
        this.setBackground();
        this.letterBoxLayer = new Paper.Layer();
        this.addLayer(this.letterBoxLayer);
    }
    set bounds(x) {}
    get bounds() {
        if(defined(this.backgroundImage.image)) {
            return this.backgroundImage.image.bounds;
        }
        else {
            return 0;
        }
    }
    set scaleX(x) {}
    get scaleX() {
        return(this.backgroundImage.absWidth / this.backgroundImage.origWidth);
    }
    set scaleY(y) {}
    get scaleY() {
        return(this.backgroundImage.absHeight / this.backgroundImage.origHeight);
    }
    update() {
        this.view.update();
    }
    letterBox() {
        this.letterBoxLayer.clear();
        if(this.backgroundImage.widthFactor < this.backgroundImage.heightFactor) {
            var rectA = new Paper.Rectangle(new Paper.Point(0, 0), new Paper.Size(1280, this.bounds.top));
            var rectB = new Paper.Rectangle(new Paper.Point(0, this.bounds.bottom), new Paper.Size(1280, 720));
        }
        else {
            var rectA = new Paper.Rectangle(new Paper.Point(0, 0), new Paper.Size(this.bounds.left, 720));
            var rectB = new Paper.Rectangle(new Paper.Point(this.bounds.right, 0), new Paper.Size(1280, 720));
        }
        var letterBoxA = new Paper.Path.Rectangle(rectA);
        var letterBoxB = new Paper.Path.Rectangle(rectB);
        letterBoxA.fillColor = 'black';
        letterBoxB.fillColor = 'black';
        this.letterBoxLayer.addChild(letterBoxA);
        this.letterBoxLayer.addChild(letterBoxB);
        this.letterBoxLayer.bringToFront();
    }
    testAddPath() {
        global.logger.debug('Active layer', this._project.activeLayer.name);
        this.annotationLayer.fitBounds(this._project.bounds);
        var path = new Paper.Path();
        path.strokeColor = 'white';
        path.strokeWidth = 30;
        path.strokeCap = 'round';
        path.blendMode = 'normal';
        path.add(new Paper.Point(50, 50));
        path.add(new Paper.Point(1280, 720));
        this._annotationLayer.addChild(path);
        global.logger.debug(path.exportJSON());
    }
    setBackground() {
        this.background = new Paper.Layer();
        this.background.name = 'background';
        this.project.addLayer(this.background);
        this.background.sendToBack();
        let rect = new Paper.Rectangle(
            new Paper.Point(0, 0),
            new Paper.Size(1280, 720)
        );
        let path = new Paper.Path.Rectangle(rect);
        path.fillColor = 'black';
        this.background.addChild(path);
    }
    get project() {
        return this._project;
    }
    set project(p) {}
    addLayer(layer) {
        this._project.addLayer(layer);
    }
    get annotationLayer() {
        this._annotationLayer.activate();
        // this._annotationLayer.bringToFront();
        return this._annotationLayer;
    }
    get height() {
        return this._project.view.viewSize.height;
    }
    set height(height) {
        this._project.view.size.setHeight(height);
    }
    get width() {
        return this._project.view.viewSize.width;
    }
    set width(width) {
        this._project.view.viewSize.setWidth(width);
    }
    set annotationLayer(a) {}

    get canvas() {
        return this._project.view.element;
    }
    set canvas(canvas) {
        throw new Error('Cannot set canvas');
    }
    get context() {
        return this.canvas.getContext('2d');
    }
    set context(context) {
        throw new Error('Cannot set context');
    }
    clear() {
        this.annotationLayer.clear();
    }
    undo() {
        this.annotationLayer.children.pop();
    }
    renderAnnotationArray(annotationArray) {
        this.backgroundImage.callback = () => {
            this.clear();
            for(let i = 0; i < annotationArray.annotations.length; i++) {
                var annotation = annotationArray.annotations[i];
                if(annotation !== null) {
                    this.renderAnnotationPart(annotation);
                }
            }
        }
        this.backgroundImage.url = annotationArray.slide.url;
    }
    renderAnnotationPart(annotationPart) {
        let owner = this.userLines.find(annotationPart);
        owner.render(annotationPart);
    }

    setListeners(socket) {
        this.socket = socket;
        var self = this;
        var clearFn = function(){
            // self.log('Got clear signal');
            self.clear();
            self.update();
        }
        var undoFn = function(){
            // self.log('Got undo signal');
            self.undo();
        }
        var annotationsFn = function(annotations){
            try {
                self.renderAnnotationArray(annotations);
            }
            catch(err) {
                global.logger.error(err);
            }
        }
        var pathPartFn = function(pathPart){
            try {
                self.renderAnnotationPart(JSON.parse(pathPart));
            }
            catch(err) {
                global.logger.error(err);
            }
        }
        var setSlideFn = function(message){
            self.log('Got set slide');
            self.backgroundImage.url = message;
        }
        this.socket.on('clear', clearFn);
        this.socket.on('undo', undoFn);
        this.socket.on('annotations', annotationsFn);
        this.socket.on('path_part', pathPartFn);
        this.socket.on('set_slide', setSlideFn);
        this.socket.emit('retrieve_annotations');
        //Set disconnect function
        this.disconnect = () => {
            this.socket.removeListener('clear', clearFn);
            this.socket.removeListener('undo', undoFn);
            this.socket.removeListener('annotations', annotationsFn);
            this.socket.removeListener('path_part', pathPartFn);
            this.socket.removeListener('set_slide', setSlideFn);
            this.disconnect = undefined;
        };
    }
    log(message) {
        global.logger.debug(`Renderer: message ${message}`);
    }
}
module.exports = Renderer;
