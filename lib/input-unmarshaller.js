const { Transform } = require("stream");
const RiffError = require("./riff-error");
const { Message } = require("@projectriff/message");
const { types: errorTypes } = require("./errors");
const {
    canUnmarshal,
    parseContentType,
    unmarshaller,
} = require("./content-negotiation");

const DEFAULT_ARGUMENT_TRANSFORMER = (msg) => msg.payload;

module.exports = class InputUnmarshaller extends Transform {
    constructor(argumentTransformer) {
        super({ objectMode: true });
        this.argumentTransformer =
            argumentTransformer || DEFAULT_ARGUMENT_TRANSFORMER;
    }

    _transform(inputSignal, _, callback) {
        const dataSignal = inputSignal.data;

        let finalPayloadResult;
        console.debug(`Forwarding data for input #${dataSignal.argIndex || 0}`);
        try {
            const contentTypeResult = this._parseContentType(dataSignal);
            const unmarshalledPayloadResult = this._unmarshal(
                contentTypeResult,
                dataSignal
            );
            finalPayloadResult = this._convertToMessage(
                unmarshalledPayloadResult,
                dataSignal.headers
            );
        } catch (err) {
            callback(err);
            return;
        }

        try {
            callback(null, finalPayloadResult);
        } catch (err) {
            // propagate downstream error
            this.emit("error", err);
        }
    }

    _parseContentType(dataSignal) {
        const contentType = dataSignal.contentType;
        try {
            return parseContentType(contentType);
        } catch (err) {
            throw new RiffError(
                errorTypes.INVALID_INPUT_CONTENT_TYPE,
                `Invalid content-type '${contentType}' for input #${
                    dataSignal.argIndex || 0
                }`
            );
        }
    }

    _unmarshal(parsedContentType, dataSignal) {
        const contentType = parsedContentType.type;
        if (!canUnmarshal(contentType)) {
            throw new RiffError(
                errorTypes.UNSUPPORTED_INPUT_CONTENT_TYPE,
                `Unsupported content-type '${contentType}' for input #${
                    dataSignal.argIndex || 0
                }`
            );
        }
        try {
            return unmarshaller(contentType)(
                dataSignal.payload,
                parsedContentType.charset
            );
        } catch (err) {
            throw new RiffError(errorTypes.INVALID_INPUT, err);
        }
    }

    _convertToMessage(payload, headers) {
        try {
            return this.argumentTransformer(this._toMessage(payload, headers));
        } catch (err) {
            throw new RiffError(errorTypes.ARGUMENT_TRANSFORMER, err);
        }
    }

    _toMessage(payload, headers) {
        const messageBuilder = Message.builder();
        for (const headerName in headers) {
            messageBuilder.addHeader(headerName, headers[headerName]);
        }
        return messageBuilder.payload(payload).build();
    }
};
