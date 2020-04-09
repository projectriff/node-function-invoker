const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const grpc = require("@grpc/grpc-js");

const loadProto = async () => {
    const protoFile = path.join(__dirname, "..", "proto", "riff-rpc.proto");
    const packageDefinition = await protoLoader.load(protoFile);
    return grpc.loadPackageDefinition(packageDefinition);
};

module.exports = {
    loadRiffService: async () => {
        const proto = await loadProto();
        return proto.streaming.Riff.service;
    },
};
