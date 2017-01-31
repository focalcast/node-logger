var {Enum} = require('enumify');

class RenderQuality extends Enum{}
RenderQuality.initEnum({
    FAST : {
        value : 'fast'
    },
    GOOD : {
        value : 'good'
    },
    BEST : {
        value : 'best'
    },
    NEAREST : {
        value : 'nearest'
    },
    BILINEAR : {
        value : 'bilinear'
    }
});

module.exports = RenderQuality;
