const { FUNCTION_URI, HOST, PORT } = process.env;

const fn = require(FUNCTION_URI);
const app = require('./lib/app')(fn);

let server;

(async function startup() {
    if (typeof fn.$init === 'function') {
        // wait 10s for the sever to start before killing it
        const timeout = setTimeout(() => {
            console.log('Init timeout');
            process.exit(1);
        }, 10e3);
        try {
            await fn.$init();
        } catch (e) {
            console.log('Init error:', e);
            process.exit(2);
        }
        clearTimeout(timeout);
    }
    server = app.listen(PORT, HOST);
    console.log(`Running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
})().catch(e => {
    console.log('Startup error:', e);
    process.exit(-1);
});

function shutdown() {
    console.log(`Server shutdown, ${process.uptime().toFixed(1)}s uptime`);

    // wait 10s for the sever to exit gracefully before killing it
    setTimeout(() => {
        console.log('Destroy timeout');
        process.exit(1);
    }, 10e3);

    // gracefully exit
    server.close(async () => {
        if (typeof fn.$destroy === 'function') {
            try {
                await fn.$destroy();
            } catch (e) {
                console.log('Destroy error:', e);
                process.exit(2);
            }
        }
        process.exit(0);
    });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
