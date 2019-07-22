const {Transform} = require('stream');
const RiffError = require('../../riff-error');
const marshallers = require('./marshallers');
const logger = require('util').debuglog('riff');
const {canUnmarshall, determineContentTypes, unmarshaller} = require('../content-negotiation')(marshallers);

module.exports = class InputUnmarshaller extends Transform {

    constructor(index, options) {
        super(options);
        this.index = index;
    }

    _transform(inputSignal, _, callback) {
        const dataSignal = inputSignal.getData();
        const inputIndex = dataSignal.getArgindex();
        // see FIXME in riff-facade.js
        if (this.index !== inputIndex) {
            callback();
            return;
        }
        const payload = dataSignal.getPayload();
        const contentType = dataSignal.getContenttype();
        const acceptedContentType = determineContentTypes(contentType).accept;
        if (!canUnmarshall(acceptedContentType)) {
            callback(new RiffError('error-streaming-input-content-type-unsupported', `unsupported input #${inputIndex}'s content-type ${contentType}`));
            return;
        }
        const input = unmarshaller(acceptedContentType)(payload);
        logger(`Forwarding data for input #${inputIndex} with payload: ${input}`);
        this.push(input);
        callback();
    }
};
