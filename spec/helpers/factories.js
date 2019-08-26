require('../../codegen/proto/riff-rpc_grpc_pb');
const {TextEncoder} = require('util');
const MappingTransform = require('../../lib/mapping-transform');
const FixedSource = require('./fixed-source');

const textEncoder = new TextEncoder('utf-8');

module.exports = {
    'newInputFrame': (index, contentType, payload, headers = []) => {
        const inputFrame = new proto.streaming.InputFrame();
        inputFrame.setArgindex(index);
        inputFrame.setContenttype(contentType);
        inputFrame.setPayload(textEncoder.encode(payload));
        const headersMap = inputFrame.getHeadersMap();
        headers.forEach((header) => {
            headersMap.set(header[0], header[1]);
        });
        return inputFrame;
    },
    'newStartFrame': (contentTypes) => {
        const startFrame = new proto.streaming.StartFrame();
        startFrame.setExpectedcontenttypesList(contentTypes);
        return startFrame;
    },
    'newInputSignal': (inputFrame) => {
        const inputSignal = new proto.streaming.InputSignal();
        inputSignal.setData(inputFrame);
        return inputSignal;
    },
    'newStartSignal': (startFrame) => {
        const inputSignal = new proto.streaming.InputSignal();
        inputSignal.setStart(startFrame);
        return inputSignal;
    },
    'newOutputFrame': (index, contentType, payload) => {
        const outputFrame = new proto.streaming.OutputFrame();
        outputFrame.setResultindex(index);
        outputFrame.setContenttype(contentType);
        outputFrame.setPayload(textEncoder.encode(payload));
        return outputFrame;
    },
    'newOutputSignal': (outputFrame) => {
        const outputSignal = new proto.streaming.OutputSignal();
        outputSignal.setData(outputFrame);
        return outputSignal;
    },
    'newFixedSource': (data) => {
        return new FixedSource(data, {objectMode: true})
    },
    'newMappingTransform': (fn) => {
        return new MappingTransform(fn, {objectMode: true})
    }
};
