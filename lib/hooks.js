const RiffError = require('./riff-error');
const {types: errorTypes} = require('./errors');

const handleError = (err) => {
    if (err instanceof RiffError) {
        return err
    }
    return new RiffError(errorTypes.HOOK_RUNTIME, err);
};

module.exports.guardWithTimeout = async (hookFn, timeoutInMs) => {
    const hookType = typeof hookFn;
    if (hookType === 'undefined') {
        return;
    }
    if (hookType !== 'function') {
        throw new RiffError(errorTypes.HOOK_INVALID, `Hooks must be functions, found: ${hookType}`);
    }

    const timerPromise = new Promise(function (resolve, reject) {
        setTimeout(() => {
            reject(new RiffError(errorTypes.HOOK_TIMEOUT, `The hook took too long to run (timeout: ${timeoutInMs}ms). Aborting now`))
        }, timeoutInMs);
    });

    try {
        const hookPromise = Promise.resolve(hookFn());
        await Promise.race([hookPromise, timerPromise])
    } catch (err) {
        throw handleError(err);
    }
};
