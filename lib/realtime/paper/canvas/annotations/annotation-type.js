var {
    Enum
} = require('enumify');
var Line = require('./line.js');
class AnnotationType extends Enum {
    static get(type) {
        return Line;
        for(var i=0; i < AnnotationType.enumValues; i++) {
            var t = AnnotationType.enumValues[i];
            if(t.value === type) {
                global.logger.debug('Got annotation type', t);
                return t.class;
            }
        }
    }
}

AnnotationType.initEnum({
    LINE: {
        value: 1,
        class: Line
    },
    LASER: {
        value: 2,
        class: Line
    },
    ERASER: {
        value: 3,
        class: Line
    }
});

module.exports = AnnotationType;
