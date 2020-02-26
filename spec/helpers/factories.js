require("../../codegen/proto/riff-rpc_grpc_pb");
const { Message, Headers } = require("@projectriff/message");
const MappingTransform = require("../../lib/mapping-transform");
const FixedSource = require("./fixed-source");

module.exports = {
    newInputFrame: (index, contentType, payload, headers = []) => {
        const inputFrame = new proto.streaming.InputFrame();
        inputFrame.setArgindex(index);
        inputFrame.setContenttype(contentType);
        inputFrame.setPayload(payload);
        const headersMap = inputFrame.getHeadersMap();
        headers.forEach(header => {
            headersMap.set(header[0], header[1]);
        });
        return inputFrame;
    },
    newStartFrame: (contentTypes, inputNames = [], outputNames = []) => {
        const startFrame = new proto.streaming.StartFrame();
        startFrame.setInputnamesList(inputNames);
        startFrame.setOutputnamesList(outputNames);
        startFrame.setExpectedcontenttypesList(contentTypes);
        return startFrame;
    },
    newInputSignal: inputFrame => {
        const inputSignal = new proto.streaming.InputSignal();
        inputSignal.setData(inputFrame);
        return inputSignal;
    },
    newStartSignal: startFrame => {
        const inputSignal = new proto.streaming.InputSignal();
        inputSignal.setStart(startFrame);
        return inputSignal;
    },
    newOutputFrame: (index, contentType, payload, headers = []) => {
        const outputFrame = new proto.streaming.OutputFrame();
        outputFrame.setResultindex(index);
        outputFrame.setContenttype(contentType);
        outputFrame.setPayload(payload);
        const headersMap = outputFrame.getHeadersMap();
        headers.forEach(header => {
            headersMap.set(header[0], header[1]);
        });
        return outputFrame;
    },
    newOutputSignal: outputFrame => {
        const outputSignal = new proto.streaming.OutputSignal();
        outputSignal.setData(outputFrame);
        return outputSignal;
    },
    newFixedSource: data => {
        return new FixedSource(data);
    },
    newMappingTransform: fn => {
        return new MappingTransform(fn);
    },
    newRiffMessage: (headers, payload) => {
        return Message.builder()
            .headers(headers)
            .payload(payload)
            .build();
    },
    newRiffHeaders: () => {
        return new Headers();
    }
};
