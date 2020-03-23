const startInvoker = require("./lib/invoker");

const userFunctionUri = process.env.FUNCTION_URI;
if (typeof userFunctionUri === "undefined" || userFunctionUri.trim() === "") {
    throw "FUNCTION_URI envvar not set or empty. Aborting.";
}
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
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
})();
