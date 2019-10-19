module.exports = (inputStreams, outputStreams) => {
    inputStreams["0"].pipe(outputStreams["0"]);
};
module.exports.$arity = 2;
module.exports.$interactionModel = 'node-streams';

module.exports.$init = async () => {
    return new Promise(resolve => {
        setTimeout(resolve, 500);
    });
};
