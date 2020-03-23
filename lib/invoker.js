const util = require("util");
const StreamingPipeline = require("./streaming-pipeline");
const services = require("../codegen/proto/riff-rpc_grpc_pb");
const promoteRequestReplyFunction = require("./request-reply-promoter");
const logger = require("util").debuglog("riff");
const { guardWithTimeout } = require("./hooks");
const grpc = require("grpc");

function lookUpFunction(userFunctionUri) {
    return ((fn) => {
        if (fn.__esModule && typeof fn.default === "function") {
            // transpiled ES Module interop
            // see https://2ality.com/2017/01/babel-esm-spec-mode.html
            return fn.default;
        }
        return fn;
    })(require(userFunctionUri));
}

const invoke = (userFunction) => {
    return (call) => {
        logger("New invocation started");
        const normalizedUserFunction = promoteRequestReplyFunction(
            userFunction
        );
        const pipeline = new StreamingPipeline(normalizedUserFunction, call);
        call.pipe(pipeline);
    };
};

const registerShutdown = (destroyHook, timeout, server, shutdownSignal) => {
    return shutdownSignal
        .then(() => {
            logger("Graceful shutdown started");
            const gracefulShutdown = util
                .promisify(server.tryShutdown)
                .bind(server);
            return gracefulShutdown();
        })
        .then(
            () => executeDestroy(destroyHook, timeout),
            (shutdownErr) => {
                logger(
                    `Error during graceful shutdown: ${shutdownErr.toString()}`
                );
                return executeDestroy(destroyHook, timeout).then(
                    () => Promise.reject(shutdownErr),
                    () => Promise.reject(shutdownErr)
                );
            }
        );
};

const executeInit = async (initHook, initTimeout) => {
    logger("Calling $init hook (if any)");
    return guardWithTimeout(initHook, initTimeout)
        .then(() =>
            logger("$init hook successfully completed (or skipped if none)")
        )
        .catch((err) => {
            logger(`Error during $init hook execution: ${err.toString()}`);
            return Promise.reject(err);
        });
};

const executeDestroy = async (destroyHook, timeout) => {
    logger("Calling $destroy hook (if any)");
    return guardWithTimeout(destroyHook, timeout)
        .then(() =>
            logger("$destroy hook successfully completed (or skipped if none)")
        )
        .catch((err) => {
            logger(`Error during $destroy hook execution: ${err.toString()}`);
            return Promise.reject(err);
        });
};

module.exports = async (userFunctionUri, options, shutdownSignal) => {
    const server = new grpc.Server();

    const userFunction = lookUpFunction(userFunctionUri);

    const destroyHook = userFunction.$destroy;
    const destroyHookTimeout = options.$destroyTimeoutMs || 10000;
    const shutdownPromise = registerShutdown(
        destroyHook,
        destroyHookTimeout,
        server,
        shutdownSignal
    );

    const initHookTimeout = options.$initTimeoutMs || 10000;
    return executeInit(userFunction.$init, initHookTimeout, server)
        .then(
            () => {
                server.addService(services.RiffService, {
                    invoke: invoke(userFunction),
                });
                server.bind(
                    `0.0.0.0:${options.port}`,
                    grpc.ServerCredentials.createInsecure()
                );
                server.start();
                logger("Ready to process signals");
            },
            (initErr) => {
                logger("Shutting down now");
                server.forceShutdown();
                return executeDestroy(destroyHook, destroyHookTimeout).then(
                    () => Promise.reject(initErr),
                    () => Promise.reject(initErr)
                );
            }
        )
        .then(() => ({ userFunction, shutdownPromise }));
};
