const startInvoker = require("../../lib/invoker");

const randomPort = () => {
    return 1024 + Math.floor(Math.random() * Math.floor(64511));
};

module.exports = async (functionUri, shutdownSignal, options) => {
    let lastError;
    const triedPorts = [];
    for (let i = 0; i < 5; i++) {
        const port = randomPort();
        triedPorts.push(port);
        const invokerOptions = Object.assign({}, options, { port });
        try {
            const { userFunction, shutdownPromise } = await startInvoker(
                functionUri,
                invokerOptions,
                shutdownSignal
            );
            return {
                address: `localhost:${port}`,
                userFunction,
                shutdownPromise
            };
        } catch (err) {
            lastError = err;
        }
    }
    const error = new Error(
        "An error occurred when starting the server. " +
            `Tried the following ports: ${triedPorts.join(", ")}. ` +
            `Last error was: ${lastError}`
    );
    return Promise.reject(error);
};
