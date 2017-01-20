var Q = require('q');
var fs = require('fs');
var Frame = require('./frame.js');

class FrameBuffer{
    constructor(canvas){
        this.canvas = canvas;
        this.stream = fs.createWriteStream(canvas.path);
    }
    start(){
        if(this.running){
            throw new Error(`Canvas already buffering output. Cannot start`);
        }
        this.numFrames = 0;
        this.running = true;
        this.start = new Date();
        this.deferred = Q.defer();
        this.createFrame();
        return this.deferred.promise;
    }
    createFrame(){
        this.canvas.toBuffer((err, buf)=>{
            if(err){
                this.deferred.reject(err);
            }
            else{
                this.deferred.notify(new Frame(buf, this.start));
                this.numFrames++;
            }
            if(this.running){
                this.createFrame();
            }else{
                var time = new Date() - this.start;
                this.deferred.resolve(
                    `Finished!
                    Wrote ${this.numFrames} in ${time}`
                );
            }
        });
    }
    stop(){
        if(!this.running){
            throw new Error(`Not started. Cannot stop buffering`);
        }
        this.running=false;
    }
    getBuffer(){
        return this.buffer;
    }
}
module.exports = FrameBuffer;
