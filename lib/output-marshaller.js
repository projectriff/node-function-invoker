const {Transform} = require('stream');
const logger = require('util').debuglog('riff');
const RiffError = require('./riff-error');
const {canMarshall, determineContentTypes, marshaller} = require('./content-negotiation');

module.exports = class OutputMarshaller extends Transform {

    constructor(index, contentType, options) {
        super(options);
        if (index < 0) {
            throw new RiffError('error-output-index-invalid', `invalid output index: ${index}`);
        }
        const acceptedContentType = determineContentTypes(contentType).accept;
        if (!canMarshall(acceptedContentType)) {
            throw new RiffError('error-output-content-type-unsupported', `unrecognized output #${index}'s content-type ${contentType}`);
        }
        this._index = index;
        this._acceptedContentType = acceptedContentType;
        this._marshallerFunction = marshaller(this._acceptedContentType);
    }

    _transform(value, _, callback) {
        let payload;
        try {
            payload = this._marshallerFunction(value);
        } catch (err) {
            callback(new RiffError('error-output-invalid', err));
            return;
        }
        const outputFrame = new proto.streaming.OutputFrame();
        outputFrame.setResultindex(this._index);
        outputFrame.setContenttype(this._acceptedContentType);
        outputFrame.setPayload(payload);
        const outputSignal = new proto.streaming.OutputSignal();
        outputSignal.setData(outputFrame);
        logger(`Received output #${this._index} with content-type: ${this._acceptedContentType}`);
        callback(null, outputSignal);
    }
};

