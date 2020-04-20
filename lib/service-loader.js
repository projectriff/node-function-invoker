const services = require("../codegen/proto/riff-rpc_grpc_pb");
const grpc = require("@grpc/grpc-js");

module.exports = {
    loadRiffService: async () => {
        return grpc.loadPackageDefinition(services["streaming.Riff"]);
    },
};
