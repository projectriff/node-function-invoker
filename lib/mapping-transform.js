const {Transform} = require('stream');
const RiffError = require('./riff-error');

module.exports = class MappingTransform extends Transform {

    constructor(fn, options) {
        super(options);
        this._function = fn;

    }

    _transform(chunk, _, callback) {
        try {
            const result = this._function(chunk);
            const resultHandler = this._handleResult(callback);
            if (result instanceof Promise) {
                result
                    .then(resultHandler)
                    .catch((err) => this._handleError(err))
            } else {
                resultHandler(result);
            }
        } catch (err) {
            this._handleError(err);
        }
    }

    _handleResult(callback) {
        return (result) => {
            callback(null, result);
        }
    }

    _handleError(err) {
        this.emit('error', new RiffError('request-reply-function-runtime-error', err));
    }
};
