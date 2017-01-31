var defined = require('defined');
var sanitize = require('sanitize-filename');
class Frame {
    static add(frames, path, start){
        var frame = new Frame(path, start);
        if(frames.length === 0){
            frames.push(frame);
            return frames;
        }else{
            frames[frames.length - 1].duration = frame.startTime;
        }
        frames.push(frame);
    }
    static end(frames){
        let frame = frames[frames.length-1];
        frame.duration = frame.startTime;
    }
    constructor(path, start){
        this._path = path;
        this.startTime = (new Date() - start)/1000;
    }
    set duration(last){
        this._duration = last - this.startTime;
    }
    get duration(){
        return this._duration;
    }
    get path(){
        return this._path;
    }
    set path(path){
        this._path = path;
    }
    toString(){
        if(!defined(this.duration)){
            global.logger.debug('Last frame duration not set');
        }
        var write = `file '${this.path}'\nduration ${this.duration}`;
        return `file ${this.path}\nduration ${this.duration}\n`;
    }
}

module.exports = Frame;
