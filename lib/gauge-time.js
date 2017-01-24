class GaugeTime{
    constructor(){
        this.startTime = new Date().getTime();
    }
    end(){
        this.endTime = new Date().getTime();
        return this.endTime-this.startTime;
    }
}

module.exports = GaugeTime;
