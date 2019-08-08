module.exports =
    (numbers /* Readable */, squares /* Writable */) => {
        numbers.on('data', (number) => {
            squares.write(number * number);
        });
        numbers.on('end', () => {
            squares.end();
        });
        numbers.on('error', () => {
            squares.end();
        });
    };
module.exports.$interactionModel = 'node-streams';
