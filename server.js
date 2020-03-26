const startInvoker = require("./lib/invoker");

const userFunctionUri = process.env.FUNCTION_URI;
if (typeof userFunctionUri === "undefined" || userFunctionUri.trim() === "") {
    throw "FUNCTION_URI envvar not set or empty. Aborting.";
}

const debug = process.env.NODE_DEBUG;
if (typeof debug === "undefined" || debug !== "riff") {
    console.debug = () => {};
}

console.time("riff-invoker");
const port = process.env.GRPC_PORT || "8081";

const shutdownSignal = new Promise((resolve) => {
    process.once("SIGTERM", resolve);
    process.once("SIGINT", resolve);
});

(async () => {
    try {
        const { shutdownPromise } = await startInvoker(
            userFunctionUri,
            { port },
            shutdownSignal
        );
        await shutdownPromise;
        console.timeEnd("riff-invoker");
        process.exit(0);
    } catch (err) {
        console.timeEnd("riff-invoker");
        process.exit(1);
    }
})();
