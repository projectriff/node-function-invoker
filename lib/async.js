const RiffError = require('./riff-error');
const {types: errorTypes} = require('./errors');

const handleError = (reject) => (err) => {
    return reject(new RiffError(errorTypes.HOOK_RUNTIME, err));
};

module.exports.guardWithTimeout = (hookFn, timeoutInMs) => {
    return new Promise((resolve, reject) => {
        const timerId = setTimeout(() => {
            reject(new RiffError(errorTypes.HOOK_TIMEOUT, 'The hook took too long to run. Aborting now'));
        }, timeoutInMs);

        try {
            Promise.resolve(hookFn())
                .then(resolve, handleError(reject))
                .finally(() => clearTimeout(timerId));
        } catch (err) {
            handleError(reject)(err);
        }
    });
};
