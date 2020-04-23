module.exports = (inputs, outputs) => {
    const numbers = inputs.$order[0];
    const squares = outputs.$order[0];
    numbers.on("data", (number) => {
        squares.write(number.payload * number.payload);
    });
    numbers.on("end", () => {
        squares.end();
    });
    numbers.on("error", () => {
        squares.end();
    });
};
module.exports.$interactionModel = "node-streams";
