const _ = require('highland');

module.exports =
    (inputs, outputs) => {
        const numberStream = _(inputs["0"]);
        const wordStream = _(inputs["1"]);
        numberStream
            .zip(wordStream)
            .flatMap((numberWordPair) => {
                const result = [];
                for (let i = 0; i < numberWordPair[0]; i++) {
                    result.push(numberWordPair[1]);
                }
                return _(result);
            })
            .pipe(outputs["0"]);
    };
module.exports.$interactionModel = 'node-streams';
module.exports.$arity = 3;
