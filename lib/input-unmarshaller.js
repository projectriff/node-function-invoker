const { Transform } = require("stream");
const RiffError = require("./riff-error");
const { Message } = require("@projectriff/message");
const { types: errorTypes } = require("./errors");
const {
    canUnmarshall,
    determineContentTypes,
    unmarshaller,
} = require("./content-negotiation");

const DEFAULT_ARGUMENT_TRANSFORMER = (msg) => msg.payload;

const convertToRiffMessage = (payload, headers) => {
    const messageBuilder = Message.builder();
    for (const headerName in headers) {
        messageBuilder.addHeader(headerName, headers[headerName]);
    }
    return messageBuilder.payload(payload).build();
};

module.exports = class InputUnmarshaller extends Transform {
    constructor(argumentTransformer) {
        super({ objectMode: true });
        this.argumentTransformer =
            argumentTransformer || DEFAULT_ARGUMENT_TRANSFORMER;
    }

    _transform(inputSignal, _, callback) {
        const dataSignal = inputSignal.data;
        const inputIndex = dataSignal.argIndex || 0;
        const rawPayload = dataSignal.payload;
        const contentType = dataSignal.contentType;
        const acceptedContentType = determineContentTypes(contentType).accept;
        if (!canUnmarshall(acceptedContentType)) {
            callback(
                new RiffError(
                    errorTypes.UNSUPPORTED_INPUT_CONTENT_TYPE,
                    `Unsupported content-type '${contentType}' for input #${inputIndex}`
                )
            );
            return;
        }

        let unmarshalledPayload;
        try {
            unmarshalledPayload = unmarshaller(acceptedContentType)(rawPayload);
            console.debug(`Forwarding data for input #${inputIndex}`);
        } catch (err) {
            callback(new RiffError(errorTypes.INVALID_INPUT, err));
            return;
        }

        let finalPayload;
        try {
            const message = convertToRiffMessage(
                unmarshalledPayload,
                dataSignal.headers
            );
            finalPayload = this.argumentTransformer(message);
        } catch (err) {
            callback(new RiffError(errorTypes.ARGUMENT_TRANSFORMER, err));
            return;
        }

        try {
            callback(null, finalPayload);
        } catch (err) {
            // propagate downstream error
            this.emit("error", err);
        }
    }
};
