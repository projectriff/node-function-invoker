const StreamingPipeline = require('./streaming-pipeline');
const services = require('../codegen/proto/riff-rpc_grpc_pb');
const logger = require('util').debuglog('riff');
const grpc = require('grpc');
const promoteRequestReplyFunction = require('./request-reply-promoter');

function lookUpFunction(userFunctionUri) {
    return (fn => {
        if (fn.__esModule && typeof fn.default === 'function') {
            // transpiled ES Module interop
            // see https://2ality.com/2017/01/babel-esm-spec-mode.html
            return fn.default;
        }
        return fn;
    })(require(userFunctionUri));
}

const invoke = (userFunction, onError) => {
    return (call) => {
        logger('New invocation started');
        const normalizedUserFunction = promoteRequestReplyFunction(userFunction);
        const pipeline = new StreamingPipeline(normalizedUserFunction, call, {objectMode: true});
        pipeline.on('error', onError);
        call.pipe(pipeline);
    };
};

module.exports = (userFunctionUri, port) => {
    const userFunction = lookUpFunction(userFunctionUri);

    const server = new grpc.Server();
    server.addService(services.RiffService, {
        invoke: invoke(userFunction, () => {
            logger('Force shutdown');
            server.forceShutdown();
        })
    });

    const shutDownGracefully = () => {
        logger('Graceful shutdown started');
        server.tryShutdown(() => logger('Graceful shutdown completed'));
    };
    process.on('SIGTERM', shutDownGracefully);
    process.on('SIGINT', shutDownGracefully);

    server.bind(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure());
    server.start();
    logger('Ready to process signals');
    return server;
};
