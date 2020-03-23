module.exports = (x) => x / 2;

module.exports.$argumentTransformers = [
    (message) => {
        return message.payload.age;
    },
];
