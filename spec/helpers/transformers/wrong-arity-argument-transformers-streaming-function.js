module.exports = (inputStreams, outputStreams) => {
    const output = outputStreams["0"];
    inputStreams["0"].pipe(output);
    inputStreams["1"].pipe(output);
};
module.exports.$interactionModel = 'node-streams';
module.exports.$argumentTransformers = [
    (msg) => msg,
    () => "constant"
];
