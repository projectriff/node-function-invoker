const MappingTransform = require('../../../lib/mapping-transform');

let counter = Number.MIN_SAFE_INTEGER;

module.exports = (inputStreams, outputStreams) => {
    inputStreams.$order[0].pipe(new MappingTransform((x) => {
        return x ** 2;
    })).pipe(outputStreams.$order[0]);
};
module.exports.$interactionModel = 'node-streams';

module.exports.$init = () => {
    counter = 0;
};

module.exports.$destroy = () => {
    counter = Number.MAX_SAFE_INTEGER;
};

module.exports.getCounter = () => {
    return counter;
};
