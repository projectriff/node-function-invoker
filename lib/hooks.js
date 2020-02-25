const RiffError = require("./riff-error");
const { types: errorTypes } = require("./errors");

module.exports.guardWithTimeout = async (hookFn, timeoutInMs) => {
    if (typeof hookFn === "undefined") {
        return;
    }
    if (typeof hookFn !== "function") {
        throw new RiffError(
            errorTypes.HOOK_INVALID,
            `Hooks must be functions, found: ${typeof hookFn}`
        );
    }

    let timerId;
    const hookPromise = Promise.resolve()
        .then(hookFn)
        .catch((err) => {
            throw new RiffError(errorTypes.HOOK_RUNTIME, err);
        });
    const timerPromise = new Promise((resolve, reject) => {
        timerId = setTimeout(() => {
            reject(
                new RiffError(
                    errorTypes.HOOK_TIMEOUT,
                    `The hook took too long to run (timeout: ${timeoutInMs}ms). Aborting now`
                )
            );
        }, timeoutInMs);
    });
    return Promise.race([hookPromise, timerPromise]).finally(() =>
        clearTimeout(timerId)
    );
};
