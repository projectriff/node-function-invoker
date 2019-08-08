const _ = require('highland');

module.exports =
    (numbers /* Readable */, words /* Readable */, repeated_words /* Writable */) => {
        const numberStream = _(numbers);
        const wordStream = _(words);
        numberStream
            .zip(wordStream)
            .flatMap((numberWordPair) => {
                const result = [];
                for (let i = 0; i < numberWordPair[0]; i++) {
                    result.push(numberWordPair[1]);
                }
                return _(result);
            })
            .pipe(repeated_words);
    };
module.exports.$interactionModel = 'node-streams';
