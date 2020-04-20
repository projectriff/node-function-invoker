const { Message, Headers } = require("@projectriff/message");
const MappingTransform = require("../../lib/mapping-transform");

function tuplesToObject(headers) {
    const result = {};
    headers.forEach((header) => {
        result[header[0]] = header[1];
    });
    return result;
}

module.exports = {
    newInputFrame: (index, contentType, payload, headers = []) => {
        const result = {
            payload,
            contentType,
            headers: tuplesToObject(headers),
            argIndex: index,
        };
        if (Object.keys(result.headers).length === 0) {
            delete result.headers;
        }
        return result;
    },
    newStartFrame: (contentTypes, inputNames = [], outputNames = []) => {
        return {
            expectedContentTypes: contentTypes,
            inputNames,
            outputNames,
        };
    },
    newInputSignal: (inputFrame) => {
        return {
            data: inputFrame,
        };
    },
    newStartSignal: (startFrame) => {
        return {
            start: startFrame,
        };
    },
    newOutputFrame: (index, contentType, payload, headers = []) => {
        const result = {
            payload,
            contentType,
            headers: tuplesToObject(headers),
            resultIndex: index,
        };
        // if (Object.keys(result.headers).length === 0) {
        //     delete result.headers;
        // }
        return result;
    },
    newOutputSignal: (outputFrame) => {
        return {
            data: outputFrame,
        };
    },
    newMappingTransform: (fn) => {
        return new MappingTransform(fn);
    },
    newRiffMessage: (headers, payload) => {
        return Message.builder().headers(headers).payload(payload).build();
    },
    newRiffHeaders: () => {
        return new Headers();
    },
};
