module.exports = (x) => {
    return x**2;
};

module.exports.$init = 42;

module.exports.$destroy = ['yo'];
