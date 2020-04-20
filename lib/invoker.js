const util = require("util");
const StreamingPipeline = require("./streaming-pipeline");
const promoteRequestReplyFunction = require("./request-reply-promoter");
const { loadRiffService } = require("./service-loader");
const { guardWithTimeout } = require("./hooks");
const grpc = require("@grpc/grpc-js");

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
        console.log("New invocation started");
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
            console.log("Graceful shutdown started");
            const gracefulShutdown = util
                .promisify(server.tryShutdown)
                .bind(server);
            return gracefulShutdown();
        })
        .then(
            () => executeDestroy(destroyHook, timeout),
            (shutdownErr) => {
                console.error(
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
    console.debug("Calling $init hook (if any)");
    return guardWithTimeout(initHook, initTimeout)
        .then(() =>
            console.debug(
                "$init hook successfully completed (or skipped if none)"
            )
        )
        .catch((err) => {
            console.error(
                `Error during $init hook execution: ${err.toString()}`
            );
            return Promise.reject(err);
        });
};

const executeDestroy = async (destroyHook, timeout) => {
    console.debug("Calling $destroy hook (if any)");
    return guardWithTimeout(destroyHook, timeout)
        .then(() =>
            console.debug(
                "$destroy hook successfully completed (or skipped if none)"
            )
        )
        .catch((err) => {
            console.error(
                `Error during $destroy hook execution: ${err.toString()}`
            );
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
        .then(loadRiffService)
        .then((riffService) => {
            server.addService(riffService, {
                invoke: invoke(userFunction),
            });
            const bindPromise = util.promisify(server.bindAsync);
            return bindPromise.call(
                server,
                `0.0.0.0:${options.port}`,
                grpc.ServerCredentials.createInsecure()
            );
        })
        .then(
            () => {
                server.start();
                console.log("Ready to process signals");
            },
            (initErr) => {
                console.error(`Shutting down now: ${initErr.toString()}`);
                server.forceShutdown();
                return executeDestroy(destroyHook, destroyHookTimeout).then(
                    () => Promise.reject(initErr),
                    () => Promise.reject(initErr)
                );
            }
        )
        .then(() => ({ userFunction, shutdownPromise }));
};
