const starttime = Date.now();

const PORT = 8080;

const fn = require(process.env.FUNCTION_URI);
const app = require('./lib/app')(fn);

let server;

(async function startup() {
    if (typeof fn.$init === 'function') {
        await fn.$init();
    }
    server = app.listen(PORT);
    console.log('Running on http://localhost:' + PORT);
})().catch(e => {
    console.log('Startup error:', e);
    process.exit(-1);
});

function shutdown() {
    console.log(`Server shutdown, ${((Date.now() - starttime) / 1000).toFixed(1)}s uptime`);

    // wait 10s for the sever to exit gracefully before killing it
    setTimeout(() => process.exit(-1), 10e3);

    // gracefully exit
    server.close(async () => {
        if (typeof fn.$destroy === 'function') {
            try {
                await fn.$destroy();
            } catch (e) {
                console.log('Shutdown error:', e);
                process.exit(-1);
            }
        }
        process.exit(0)
    });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
