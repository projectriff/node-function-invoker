const services = require("../../codegen/proto/riff-rpc_grpc_pb");
const grpc = require("@grpc/grpc-js");

module.exports = (address) => {
    const clientConstructor = grpc.makeGenericClientConstructor(
        services["streaming.Riff"]
    );
    return new clientConstructor(address, grpc.credentials.createInsecure());
};
