const MappingTransform = require("./mapping-transform");

module.exports = (userFunction) => {
    const interactionModel =
        userFunction["$interactionModel"] || "request-reply";
    if (interactionModel !== "request-reply") {
        return userFunction;
    }

    console.debug("Promoting request-reply function to streaming function");
    const mapper = new MappingTransform(userFunction);
    const result = (inputs, outputs) => {
        mapper.on("error", (err) => {
            inputs.$order[0].emit("error", err);
        });
        inputs.$order[0].pipe(mapper).pipe(outputs.$order[0]);
    };
    result.$interactionModel = "node-streams";
    return result;
};
