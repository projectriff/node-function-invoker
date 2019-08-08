const RiffError = require('./riff-error');

const handleError = (reject) => (err) => {
    return reject(new RiffError('error-hook-runtime-error', err));
};

module.exports.guardWithTimeout = (hookFn, timeoutInMs) => {
    return new Promise((resolve, reject) => {
        const timerId = setTimeout(() => {
            reject(new RiffError('error-hook-timeout', 'The hook took too long to run. Aborting now'));
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
