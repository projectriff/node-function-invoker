module.exports =
    (inputs, outputs) => {
        const numbers = inputs["0"];
        const squares = outputs["0"];
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
module.exports.$arity = 2;
