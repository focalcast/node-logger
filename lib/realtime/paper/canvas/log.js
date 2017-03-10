class Log{

    constructor(parent, prefix){
        this.parent = parent;
        this.prefix = prefix;
        this.parent.log = this;
    }
    log(...args){
        console.log(this.prefix, ...args);
    }
    debug(...args){
        global.logger.debug(`${this.prefix}`, ...args);
    }
    info(...args){
        global.logger.info(`${this.prefix}`, ...args);
    }
    warn(...args){
        global.logger.warn(`${this.prefix}`, ...args);
    }
    error(...args){
        global.logger.error(`${this.prefix}`, ...args);
    }
}
module.exports = Log;
