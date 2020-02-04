// Error type for non-function errors
module.exports = class RiffError extends Error {
    constructor(type, cause) {
        super();

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, RiffError);
        }

        this.type = type;
        this.cause = cause;
    }


    toString() {
        return `${this.type}: ${this.cause}`;
    }
};
