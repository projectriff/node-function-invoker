const grpc = require('grpc');
const services = require('../../codegen/proto/riff-rpc_grpc_pb');

module.exports = (address) => {
    return new services.RiffClient(address, grpc.credentials.createInsecure())
};
