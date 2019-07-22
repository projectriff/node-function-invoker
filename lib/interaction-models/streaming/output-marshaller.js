const { Transform } = require('stream');
const RiffError = require('../../riff-error');
const marshallers = require('./marshallers');
const logger = require('util').debuglog('riff');
const {canMarshall, determineContentTypes, marshaller} = require('../content-negotiation')(marshallers);

module.exports = class OutputMarshaller extends Transform {

    constructor(index, contentType, options) {
        super(options);
        this.index = index;
        this.acceptedContentType = determineContentTypes(contentType).accept;
        this.marshallerFunction = marshaller(this.acceptedContentType);
        if (this.index < 0) {
            throw new RiffError('error-streaming-output-index-invalid', `invalid output index: ${index}`);
        }
        if (!canMarshall(this.acceptedContentType)) {
            throw new RiffError('error-streaming-output-content-type-unsupported', `unrecognized output #${index}'s content-type ${contentType}`);
        }
    }

    _transform(value, _, callback) {
        const outputFrame = new proto.streaming.OutputFrame();
        outputFrame.setResultindex(this.index);
        outputFrame.setContenttype(this.acceptedContentType);
        outputFrame.setPayload(this.marshallerFunction(value));
        const outputSignal = new proto.streaming.OutputSignal();
        outputSignal.setData(outputFrame);

        logger(`Received output #${this.index} with value: ${value} and content-type: ${this.acceptedContentType}`);
        this.push(outputSignal);
        callback();
    }
};
