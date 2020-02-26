const RiffError = require("./riff-error");
const { types: errorTypes } = require("./errors");

const handleError = reject => err => {
    return reject(new RiffError(errorTypes.HOOK_RUNTIME, err));
};

module.exports.guardWithTimeout = (hookFn, timeoutInMs) => {
    return new Promise((resolve, reject) => {
        const hookType = typeof hookFn;
        if (hookType === "undefined") {
            return resolve();
        }
        if (hookType !== "function") {
            return reject(
                new RiffError(
                    errorTypes.HOOK_INVALID,
                    `Hooks must be functions, found: ${hookType}`
                )
            );
        }

        const timerId = setTimeout(() => {
            reject(
                new RiffError(
                    errorTypes.HOOK_TIMEOUT,
                    `The hook took too long to run (timeout: ${timeoutInMs}ms). Aborting now`
                )
            );
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
