module.exports = (inputs, outputs) => {
    const numbers = inputs["numbers"];
    const squares = outputs["squares"];
    numbers.on("data", (number) => {
        squares.write(number * number);
    });
    numbers.on("end", () => {
        squares.end();
    });
    numbers.on("error", () => {
        squares.end();
    });
};
module.exports.$interactionModel = "node-streams";
