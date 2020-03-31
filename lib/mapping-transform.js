const { Transform } = require("stream");
const RiffError = require("./riff-error");
const { types: errorTypes } = require("./errors");

module.exports = class MappingTransform extends Transform {
    constructor(fn) {
        super({ objectMode: true });
        this._function = fn;
    }

    _transform(chunk, _, callback) {
        Promise.resolve(chunk)
            .then(this._function)
            .then(
                (result) => callback(null, result),
                (err) =>
                    callback(
                        new RiffError(
                            errorTypes.REQUEST_REPLY_FUNCTION_RUNTIME,
                            err
                        )
                    )
            )
            .catch((err) => {
                console.error(
                    `Unexpected error happened when mapping request-reply function: ${err}`
                );
            });
    }
};
