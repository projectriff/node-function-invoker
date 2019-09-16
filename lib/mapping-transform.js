const {Transform} = require('stream');
const RiffError = require('./riff-error');

module.exports = class MappingTransform extends Transform {

    constructor(fn, options) {
        super(options);
        this._function = fn;

    }

    _transform(chunk, _, callback) {
        try {
            Promise.resolve(this._function(chunk))
                .then(
                    this._handleResult(callback),
                    this._handleError.bind(this)
                );
        } catch (err) {
            Promise.resolve(err).then(this._handleError.bind(this));
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
