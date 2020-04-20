const services = require("../../codegen/proto/riff-rpc_grpc_pb");
const grpc = require("@grpc/grpc-js");

module.exports = (address) => {
    return new services.RiffClient(address, grpc.credentials.createInsecure());
};
