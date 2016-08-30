var metrics = require('datadog-metrics');
var _ = require('underscore');


var Metrics = function(prefix) {
    this.prefix = prefix;
};

Metrics.prototype.applyPrefix = function(func, arguments) {
    if(typeof this.prefix === 'string') {
        arguments[0] = this.prefix + '.' + arguments[0];
        func.apply(undefined, arguments);
    }else{
        func.apply(undefined, arguments);
    }

}
Metrics.prototype.addPoint = function() {
    var arg = arguments.shift();
    this.applyPrefix(
        function(){
            arguments.unshift(arg),
            metrics.addPoint(arguments);
        },
        arguments
    );
};
Metrics.prototype.gauge = function() {
    this.applyPrefix(
        metrics.gauge,
        arguments
    );
};
Metrics.prototype.increment = function() {
    this.applyPrefix(
        metrics.increment,
        arguments
    );
};
Metrics.prototype.histogram = function() {

    this.applyPrefix(
        metrics.histogram,
        arguments
    );
};

module.exports = {
    Metrics: Metrics,
    init: metrics.init
};
