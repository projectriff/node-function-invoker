module.exports = (inputStreams, outputStreams) => {
    const output = outputStreams["0"];
    inputStreams["0"].pipe(output);
    inputStreams["1"].pipe(output);
};
module.exports.$interactionModel = 'node-streams';
module.exports.$arity = 3;
module.exports.$argumentTransformers = [
    (x) => x.payload
];
