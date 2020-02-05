const RiffError = require('./riff-error');
const {types: errorTypes} = require('./errors');

const validateArgumentTransformer = (argumentTransformer, transformerIndex) => {
    const transformerType = typeof argumentTransformer;
    if (transformerType !== 'function') {
        throw new RiffError(errorTypes.ARGUMENT_TRANSFORMER, `Argument transformer #${1 + transformerIndex} must be a function. Found: ${transformerType}`)
    }

    const transformerArity = argumentTransformer.length;
    if (transformerArity !== 1) {
        throw new RiffError(
            errorTypes.ARGUMENT_TRANSFORMER,
            `Argument transformer #${1 + transformerIndex} must be a single-parameter function. Found: ${transformerArity} parameter(s)`);
    }
};

module.exports = (argumentTransformers) => {
    if (!Array.isArray(argumentTransformers)) {
        throw new RiffError(errorTypes.ARGUMENT_TRANSFORMER, `Argument transformers must be declared in an array. Found: ${typeof argumentTransformers}`);
    }
    argumentTransformers.forEach(validateArgumentTransformer);
};
