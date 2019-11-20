module.exports = (inputStreams, outputStreams) => {
    inputStreams.$order[0].pipe(outputStreams.$order[0]);
};
module.exports.$interactionModel = 'node-streams';

module.exports.$destroy = async () => {
    return new Promise(resolve => {
        setTimeout(resolve, 500);
    });
};
