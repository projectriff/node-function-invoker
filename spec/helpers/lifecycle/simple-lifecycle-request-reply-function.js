let counter = Number.MIN_SAFE_INTEGER;

module.exports = (x) => {
    counter++;
    return x ** 2;
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
