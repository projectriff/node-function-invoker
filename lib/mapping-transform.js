const { Transform } = require("stream");
const RiffError = require("./riff-error");
const { types: errorTypes } = require("./errors");

module.exports = class MappingTransform extends Transform {
    constructor(fn) {
        super({ objectMode: true });
        this._function = fn;
        this._argumentType = fn.$argumentType || "payload";
    }

    _transform(chunk, _, callback) {
        Promise.resolve(chunk)
            .then((message) => this._transformMessage(message))
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

    _transformMessage(message) {
        switch (this._argumentType) {
            case "payload":
                return message.payload;
            case "message":
                return message;
            case "headers":
                return message.headers;
            default:
                throw new Error(`unknown $argumentType: ${this._argumentType}`);
        }
    }
};
