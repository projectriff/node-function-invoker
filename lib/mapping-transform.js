const {Transform} = require('stream');
const RiffError = require('./riff-error');

/*
 * Wraps promise-based (using async or raw API) and synchronous
 * functions to pipe-able stream.
 */
module.exports = class MappingTransform extends Transform {

    constructor(fn, options) {
        super(options);
        this._function = fn;
    }

    _transform(chunk, _, callback) {
        // the function may throw, in which case the error is caught upstream by the input unmarshaller
        Promise.resolve(this._function(chunk))
            .then(
                (result) => {
                    callback(null, result);
                },
                (err) => {
                    callback(new RiffError('request-reply-function-runtime-error', err));
                }
            );
    }
};
