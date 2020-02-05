const validateArgumentTransformers = require('./argument-transformer-validator');
const RiffError = require('./riff-error');
const MappingTransform = require('./mapping-transform');
const logger = require('util').debuglog('riff');
const {types: errorTypes} = require('./errors');

const withTransformers = (promotedFunction, userFunction) => {
    const transformers = userFunction['$argumentTransformers'];
    if (typeof transformers === 'undefined') {
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
    promotedFunction['$argumentTransformers'] = transformers;
    return promotedFunction;
};

const withHooks = (promotedFunction, userFunction) => {
    const initHook = userFunction['$init'];
    validateHook(initHook, 'init');
    if (typeof initHook === 'function') {
        promotedFunction['$init'] = userFunction['$init'];
    }

    const destroyHook = userFunction['$destroy'];
    validateHook(destroyHook, 'destroy');
    if (typeof destroyHook === 'function') {
        promotedFunction['$destroy'] = userFunction['$destroy'];
    }
    return promotedFunction;
};

const validateHook = (hook, hookName) => {
    const hookType = typeof hook;
    if (hookType !== 'function' && hookType !== 'undefined') {
        throw new RiffError(errorTypes.FUNCTION_PROMOTION, `Request-reply function ${hookName} hook must be a function. Found: ${hookType}`);
    }
};

module.exports = (userFunction) => {
    const interactionModel = userFunction['$interactionModel'] || 'request-reply';
    if (interactionModel !== 'request-reply') {
        return userFunction;
    }

    logger('Promoting request-reply function to streaming function');
    const mapper = new MappingTransform(userFunction, {objectMode: true});
    const promotedFunction = (inputs, outputs) => {
        inputs.$order[0]
            .pipe(mapper)
            .pipe(outputs.$order[0]);
    };
    promotedFunction.$interactionModel = 'node-streams';
    return withTransformers(
        withHooks(promotedFunction, userFunction),
        userFunction
    );
};
