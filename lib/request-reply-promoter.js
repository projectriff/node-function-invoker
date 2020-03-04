const validateArgumentTransformers = require("./argument-transformer-validator");
const RiffError = require("./riff-error");
const MappingTransform = require("./mapping-transform");
const { types: errorTypes } = require("./errors");

const withTransformers = (promotedFunction, userFunction) => {
    const transformers = userFunction["$argumentTransformers"];
    if (typeof transformers === "undefined") {
        return promotedFunction;
    }

    validateArgumentTransformers(transformers);
    const transformerCount = transformers.length;
    if (transformerCount !== 1) {
        throw new RiffError(
            errorTypes.ARGUMENT_TRANSFORMER,
            `Request-reply function must declare exactly 1 argument transformer. Found ${transformerCount}`
        );
    }
    promotedFunction["$argumentTransformers"] = transformers;
    return promotedFunction;
};

module.exports = (userFunction) => {
    const interactionModel =
        userFunction["$interactionModel"] || "request-reply";
    if (interactionModel !== "request-reply") {
        return userFunction;
    }

    console.debug("Promoting request-reply function to streaming function");
    const mapper = new MappingTransform(userFunction);
    const promotedFunction = (inputs, outputs) => {
        inputs.$order[0].pipe(mapper).pipe(outputs.$order[0]);
    };
    promotedFunction.$interactionModel = "node-streams";
    return withTransformers(promotedFunction, userFunction);
};
