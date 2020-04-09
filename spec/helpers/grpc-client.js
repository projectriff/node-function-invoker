const protoLoader = require("@grpc/proto-loader");
const grpc = require("@grpc/grpc-js");

const proto = grpc.loadPackageDefinition(
    protoLoader.loadSync("./proto/riff-rpc.proto")
);

module.exports = (address) => {
    return new proto.streaming.Riff(address, grpc.credentials.createInsecure());
};
