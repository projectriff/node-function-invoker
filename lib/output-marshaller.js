const { Transform } = require("stream");
const RiffError = require("./riff-error");
const { marshaller } = require("./content-negotiation");
const { types: errorTypes } = require("./errors");
const { AbstractMessage, Message } = require("@projectriff/message");

module.exports = class OutputMarshaller extends Transform {
    constructor(index, contentType) {
        super({ objectMode: true });
        this._index = index;
        this._acceptedContentType = contentType;
        this._marshallerFunction = marshaller(this._acceptedContentType);
    }

    _transform(value, _, callback) {
        const message = this._convertToRiffMessage(value);
        let payload;
        try {
            payload = this._marshallerFunction(message.payload);
        } catch (err) {
            callback(new RiffError(errorTypes.INVALID_OUTPUT, err));
            return;
        }
        const outputSignal = {
            data: {
                resultIndex: this._index,
                contentType: this._acceptedContentType,
                payload: payload,
                headers: this._toHeaderObject(message.headers),
            },
        };
        console.debug(
            `Received output #${this._index} with content-type: ${this._acceptedContentType}`
        );
        callback(null, outputSignal);
    }

    _convertToRiffMessage(value) {
        if (value instanceof AbstractMessage) {
            return new Message(value);
        }
        return new Message({}, value);
    }

    _toHeaderObject(rawHeaders) {
        const result = {};
        const headers = rawHeaders.toRiffHeaders();
        Object.keys(headers).forEach((headerName) => {
            // TODO: evolve proto to support multiple header values (getValue returns the first one)
            result[headerName] = rawHeaders.getValue(headerName);
        });
        return result;
    }
};
