const _ = require('highland');

const logError = (err) => {
    console.error(err);
};

module.exports =
    (inputs, outputs) => {
        const numberStream = _(inputs.$order[0]).errors(logError);
        const wordStream = _(inputs.$order[1]).errors(logError);
        numberStream
            .zip(wordStream)
            .flatMap((numberWordPair) => {
                const result = [];
                for (let i = 0; i < numberWordPair[0]; i++) {
                    result.push(numberWordPair[1]);
                }
                return _(result);
            })
            .pipe(outputs.$order[0]);
    };
module.exports.$interactionModel = 'node-streams';
