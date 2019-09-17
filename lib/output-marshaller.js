const {Transform} = require('stream');
const logger = require('util').debuglog('riff');
const RiffError = require('./riff-error');
const {canMarshall, determineContentTypes, marshaller} = require('./content-negotiation');
const {AbstractMessage, Message} = require('@projectriff/message');

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
        const message = this._convertToRiffMessage(value);
        let payload;
        try {
            payload = this._marshallerFunction(message.payload);
        } catch (err) {
            callback(new RiffError('error-output-invalid', err));
            return;
        }
        const outputFrame = new proto.streaming.OutputFrame();
        outputFrame.setResultindex(this._index);
        outputFrame.setContenttype(this._acceptedContentType);
        outputFrame.setPayload(payload);
        this._setHeaders(outputFrame, message.headers);
        const outputSignal = new proto.streaming.OutputSignal();
        outputSignal.setData(outputFrame);
        logger(`Received output #${this._index} with content-type: ${this._acceptedContentType}`);
        callback(null, outputSignal);
    }

    _convertToRiffMessage(value) {
        if (value instanceof AbstractMessage) {
            return new Message(value);
        }
        return new Message({}, value);
    }

    _setHeaders(outputFrame, rawHeaders) {
        const headers = rawHeaders.toRiffHeaders();
        const headersMap = outputFrame.getHeadersMap();
        Object.keys(headers).forEach((headerName) => {
            // TODO: evolve proto to support multiple header values (getValue returns the first one)
            headersMap.set(headerName, rawHeaders.getValue(headerName));
        });
    }
};

