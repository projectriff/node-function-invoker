const logger = require('util').debuglog('riff');
const MappingTransform = require('./mapping-transform');
const RiffError = require('./riff-error');

const withHooks = (promotedFunction, userFunction) => {
    if (typeof userFunction['$init'] === 'function') {
        promotedFunction['$init'] = userFunction['$init'];
    }
    if (typeof userFunction['$destroy'] === 'function') {
        promotedFunction['$destroy'] = userFunction['$destroy'];
    }
    return promotedFunction;
};

module.exports = (userFunction) => {
    const interactionModel = userFunction['$interactionModel'] || 'request-reply';
    if (interactionModel !== 'request-reply') {
        return userFunction;
    }

    if (userFunction.length !== 1) {
        throw new RiffError('error-promoting-function', `Request-reply function must have exactly 1 argument, ${userFunction.length} found`)
    }

    logger('Promoting request-reply function to streaming function');
    const mapper = new MappingTransform(userFunction, {objectMode: true});
    const promotedFunction = (inputs, outputs) => {
        const inputStream = inputs["0"];
        const outputStream = outputs["0"];
        inputStream
            .pipe(mapper)
            .pipe(outputStream);
    };
    promotedFunction.$arity = 2;
    return withHooks(promotedFunction, userFunction);
};
