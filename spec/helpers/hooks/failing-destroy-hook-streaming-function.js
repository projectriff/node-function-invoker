module.exports = (inputStreams, outputStreams) => {
    inputStreams["0"].pipe(outputStreams["0"]);
};
module.exports.$arity = 2;
module.exports.$interactionModel = 'node-streams';

module.exports.$destroy = async () => {
    return new Promise(() => {
        throw new Error('oopsie');
    });
};
