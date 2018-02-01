const { FUNCTION_URI, HOST, HTTP_PORT, GRPC_PORT } = process.env;

const fn = require(FUNCTION_URI);

let httpServer, grpcServer;

console.log(`Node started in ${process.uptime() * 1000}ms`);

// handle startup

async function init() {
    if (typeof fn.$init === 'function') {
        // wait 10s for the sever to start before killing it
        const timeout = setTimeout(() => {
            console.log('$init timeout');
            process.exit(1);
        }, 10e3);
        try {
            await fn.$init();
        } catch (e) {
            console.log('$init error:', e);
            process.exit(2);
        }
        clearTimeout(timeout);
    }
}

function loadGRPC() {
    const grpc = require('grpc');
    const server = require('./lib/grpc')(fn);

    return () => {
        server.bind(`${HOST}:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure());
        server.start();
        console.log(`gRPC running on ${HOST === '0.0.0.0' ? 'localhost' : HOST}:${GRPC_PORT}`);
        return server;
    };
}

function loadHTTP() {
    const app = require('./lib/http')(fn);

    return () => {
        const server = app.listen(HTTP_PORT, HOST);
        console.log(`HTTP running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${HTTP_PORT}`);
        return server;
    };
}

async function startup() {
    // start initialization
    const initPromise = init();

    // load gRPC and HTTP while function is initializing
    const bindGRPC = time(loadGRPC, ms => { console.log(`gRPC loaded in ${ms}ms`); });
    const bindHTTP = time(loadHTTP, ms => { console.log(`HTTP loaded in ${ms}ms`); });

    // wait for function to finish initializing
    await initPromise;

    // bind gRPC and HTTP servers
    grpcServer = bindGRPC()
    httpServer = bindHTTP();
};

startup().then(() => {
    console.log(`Function invoker started in ${Math.floor(process.uptime() * 1000)}ms`);
}, e => {
    console.log('Startup error:', e);
    process.exit(-1);
});;


// handle shutdown

function shutdown() {
    console.log(`Server shutdown, ${process.uptime().toFixed(1)}s uptime`);

    // wait 10s for the sever to exit gracefully before killing it
    setTimeout(() => {
        console.log('$destroy timeout');
        process.exit(1);
    }, 10e3);

    // gracefully exit HTTP and gRPC servers
    Promise.all([
        new Promise(resolve => grpcServer.tryShutdown(resolve)),
        new Promise(resolve => httpServer.close(resolve))
    ]).then(async () => {
        if (typeof fn.$destroy === 'function') {
            try {
                await fn.$destroy();
            } catch (e) {
                console.log('$destroy error:', e);
                process.exit(2);
            }
        }
        process.exit(0);
    });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);


// helpers

function time(work, log) {
    const startTime = Date.now();
    try {
        return work();
    } finally {
        log(Date.now() - startTime);
    }
}
