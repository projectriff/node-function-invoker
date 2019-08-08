module.exports = (x) => x / 2;

module.exports.$argumentTransformers = [
    (x) => x.payload,
    (x) => x.payload
];
