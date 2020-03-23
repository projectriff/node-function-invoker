module.exports = (x) => x / 2;

module.exports.$argumentTransformers = [(x, y) => x + y];
