var Annotations = require('./annotations.js');
var defined = require('defined');
class Slide {
    constructor(presentation, url, thumbnail, index) {
        this.presentation = presentation;
        this.thumbnail_url = thumbnail;
        this.url = url;
        this.index = index;
        this.presentation.session.emit('clear');
        //this.presentation.session.emit('set_slide', this.thumbnail_url);
        this.presentation.session.emit('set_slide', this.url);
    }
}
class Presentation {
    constructor(session) {
        this.session = session;
    }
    set data(data) {
        if(data !== null && data.hasOwnProperty('presentation') && data.presentation !== null && data.presentation.hasOwnProperty('uuid')) {
            this.uuid = data.presentation.uuid;
            this.length = data.presentation.length;
            this.name = data.presentation.name;
        }
        if(data.hasOwnProperty('current_slide') && data.current_slide !== null) {
            this.slide = data.current_slide;
        }
    }
    get annotations() {
        return this._annotations;
    }
    set annotations(annotations) {
        this._annotations = annotations;
    }
    set slide(slide) {
        if(slide !== null && slide.hasOwnProperty('url') && slide.hasOwnProperty('number') && (!defined(this._slide) || this._slide.url !== slide.url)) {
            this._slide = new Slide(this, slide.url, slide.thumbnail_url, slide.number);
            this.annotations = new Annotations(this);
            this.annotations.get();
        }
    }
    get slide() {
        return this._slide;
    }
}
module.exports = Presentation;
