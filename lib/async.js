const RiffError = require('./riff-error');

module.exports.guardWithTimeout = async (hookFn, timeoutInMs) => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        const timerId = setTimeout(() => {
            reject(new RiffError('error-hook-timeout', 'The hook took too long to run. Aborting now'));
        }, timeoutInMs);

        try {
            await hookFn();
        } catch (err) {
            reject(new RiffError('error-hook-runtime-error', err));
        }
        return resolve(timerId);
    });
};
