const RiffError = require('./riff-error');

const validateArgumentTransformer = (argumentTransformer, transformerIndex) => {
    const transformerType = typeof argumentTransformer;
    if (transformerType !== 'function') {
        throw new RiffError('error-argument-transformer', `Argument transformer #${1 + transformerIndex} must be a function. Found: ${transformerType}`)
    }

    const transformerArity = argumentTransformer.length;
    if (transformerArity !== 1) {
        throw new RiffError(
            'error-argument-transformer',
            `Argument transformer #${1 + transformerIndex} must be a single-parameter function. Found: ${transformerArity} parameter(s)`);
    }
};

module.exports = (argumentTransformers) => {
    if (!Array.isArray(argumentTransformers)) {
        throw new RiffError('error-argument-transformer', `Argument transformers must be declared in an array. Found: ${typeof argumentTransformers}`);
    }
    argumentTransformers.forEach(validateArgumentTransformer);
};
