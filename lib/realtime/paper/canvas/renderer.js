var BackgroundImage = require('./annotations/image.js');
var Paper = require('paper');
var UserLines = require('./annotations/user-lines.js');
var defined = require('defined');
var Layer = require('./layer.js');
var spawn = require('child_process').spawn;
class Renderer {
    constructor(parent) {
        this.parent = parent;
        this._width = 960;
        this._height = 540;
        // spawn('Xvfb', [':1', '-screen', '1', '960x540x24+32', '-fbdir',  this.parent.path]);

        var canvas = Paper.createCanvas(this._width, this._height);
        // canvas.setDisplay(this.parent.path);

        Paper.setup(canvas);
        this.view = this.project.view;
        this.userLines = new UserLines(this);
        this._annotationLayer = new Layer.AnnotationLayer(this);
        this.backgroundImage = new BackgroundImage(this);
        this.background = new Layer.Background(this);
        this.letterBox = new Layer.LetterBox(this);
    }
    get bounds() {
        if(defined(this.backgroundImage.image)) {
            return this.backgroundImage.image.bounds;
        } else {
            return 0;
        }
    }
    get scaleX() {
        // return(this.backgroundImage.absWidth / this.backgroundImage.origWidth);
        return this.backgroundImage.scaleX;
    }
    get scaleY() {
        return this.backgroundImage.scaleY;
        // return(this.backgroundImage.absHeight / this.backgroundImage.origHeight);
    }
    update() {
        this.view.update();
    }
    testAddPath() {
        global.logger.debug('Active layer', this.project.activeLayer.name);
        this.annotationLayer.fitBounds(this.project.bounds);
        var path = new Paper.Path();
        path.strokeColor = 'white';
        path.strokeWidth = 30;
        path.strokeCap = 'round';
        path.blendMode = 'normal';
        path.add(new Paper.Point(50, 50));
        path.add(new Paper.Point(this._width, this._width));
        this._annotationLayer.layer.addChild(path);
        global.logger.debug(path.exportJSON());
    }
    setBackground() {
        this.background = new Paper.Layer();
        this.background.name = 'background';
        this.project.addLayer(this.background);
        this.background.sendToBack();
        let rect = new Paper.Rectangle(
            new Paper.Point(0, 0),
            new Paper.Size(this._width, this._width)
        );
        let path = new Paper.Path.Rectangle(rect);
        path.fillColor = 'pink';
        this.background.addChild(path);
    }

    get project() {
        return Paper.project;
    }
    addLayer(layer) {
        this.project.addLayer(layer);
    }
    set annotationLayer(annotationLayer) {
        // this._annotationLayer = a;
    }
    get annotationLayer() {
        return this._annotationLayer.layer;
    }
    get height() {
        return this.project.view.viewSize.height;
    }
    set height(height) {
        this.project.view.size.setHeight(height);
    }
    get width() {
        return this.project.view.viewSize.width;
    }
    set width(width) {
        this.project.view.viewSize.setWidth(width);
    }
    get canvas() {
        return this.project.view.element;
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
        global.logger.debug('Render annotation array');
        this.backgroundImage.callback = () => {
            logger.warn('Got render annotation array callback');
            this.clear();
            for(let i = 0; i < annotationArray.annotations.length; i++) {
                var annotation = annotationArray.annotations[i];
                if(annotation !== null && annotation.type !== 4) {
                    this.renderAnnotationPart(annotation);
                } else if(annotation !== null && annotation.type === 4) {
                    this.renderAnnotationText(annotation);
                }
            }
        }
        this.backgroundImage.url = annotationArray.slide.url;
    }
    renderAnnotationPart(annotationPart) {
        let owner = this.userLines.find(annotationPart);
        owner.render(annotationPart);
    }
    renderAnnotationText(data) {
        logger.debug('Text annotation', JSON.stringify(data));
        data.type = 4;
        let owner = this.userLines.find(data);
        owner.renderText(data);
    }
    setListeners(socket) {
        this.socket = socket;
        var self = this;
        var clearFn = function(slideChanged) {
            if(!defined(slideChanged)) {
                self.clear();
                self.update();
            }
        }
        var undoFn = function() {
            // self.log('Got undo signal');
            self.undo();
        }
        var annotationsFn = function(annotations) {
            try {
                global.logger.debug('got annotations array');
                self.renderAnnotationArray(annotations);
            } catch(err) {
                global.logger.error(err);
            }
        }
        var pathPartFn = function(pathPart) {
            try {
                self.renderAnnotationPart(JSON.parse(pathPart));
            } catch(err) {
                global.logger.error(err);
            }
        }
        var renderTextFn = function(data) {
            var data = JSON.parse(data);
            for(let x in data) {
                self.renderAnnotationText(data[x]);
            }
        }
        var setSlideFn = function(message) {
            self.log('Got set slide');
            self.backgroundImage.url = message;
        }
        this.socket.on('clear', clearFn);
        this.socket.on('undo', undoFn);
        this.socket.on('annotations', annotationsFn);
        this.socket.on('path_part', pathPartFn);
        this.socket.on('set_slide', setSlideFn);
        this.socket.on('text', renderTextFn);
        this.socket.emit('retrieve_annotations');
        //Set disconnect function
        this.disconnect = () => {
            this.socket.removeListener('clear', clearFn);
            this.socket.removeListener('undo', undoFn);
            this.socket.removeListener('annotations', annotationsFn);
            this.socket.removeListener('path_part', pathPartFn);
            this.socket.removeListener('set_slide', setSlideFn);
            this.socket.removeListener('text', renderTextFn);
            this.disconnect = undefined;
        };
    }
    log(message) {
        global.logger.debug(`Renderer: message ${message}`);
    }
}
module.exports = Renderer;
