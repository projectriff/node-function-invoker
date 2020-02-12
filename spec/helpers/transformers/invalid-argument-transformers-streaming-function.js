module.exports = (inputStreams, outputStreams) => {
    const output = outputStreams.$order[0];
    inputStreams.$order[0].pipe(output);
    inputStreams.$order[1].pipe(output);
};
module.exports.$interactionModel = "node-streams";
module.exports.$argumentTransformers = "nope";
