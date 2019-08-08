const MappingTransform = require('../../../lib/mapping-transform');

let counter = Number.MIN_SAFE_INTEGER;

module.exports = (inputStream, outputStream) => {
    inputStream.pipe(new MappingTransform((x) => {
        return x ** 2;
    }, {objectMode: true})).pipe(outputStream);
};

module.exports.$init = () => {
    counter = 0;
};

module.exports.$destroy = () => {
    counter = Number.MAX_SAFE_INTEGER;
};

module.exports.getCounter = () => {
    return counter;
};
