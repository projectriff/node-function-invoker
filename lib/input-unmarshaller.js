const {Transform} = require('stream');
const RiffError = require('./riff-error');
const logger = require('util').debuglog('riff');
const {canUnmarshall, determineContentTypes, unmarshaller} = require('./content-negotiation');

module.exports = class InputUnmarshaller extends Transform {

    constructor(options) {
        super(options);
    }

    _transform(inputSignal, _, callback) {
        const dataSignal = inputSignal.getData();
        const inputIndex = dataSignal.getArgindex();
        const payload = dataSignal.getPayload();
        const contentType = dataSignal.getContenttype();
        const acceptedContentType = determineContentTypes(contentType).accept;
        if (!canUnmarshall(acceptedContentType)) {
            callback(new RiffError('error-input-content-type-unsupported', `unsupported input #${inputIndex}'s content-type ${contentType}`));
            return;
        }

        let input;
        try {
            input = unmarshaller(acceptedContentType)(payload);
            logger(`Forwarding data for input #${inputIndex} with payload: ${input}`);
        } catch (err) {
            callback(new RiffError('error-input-invalid', err));
            return;
        }
        try {
            callback(null, input);
        } catch (err) {
            // propagate downstream error
            this.emit('error', err);
        }
    }
}
;
