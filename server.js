/*
 * Copyright 2017-2018 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { FUNCTION_URI, HOST, GRPC_PORT } = process.env;

const interactionModelTypes = require('./lib/interaction-models');

const fn = require(FUNCTION_URI);

let grpcServer;

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

function loadGRPC(interactionModel) {
    const grpc = require('grpc');
    const server = require('./lib/grpc')(fn, interactionModel);

    if (!server) {
        console.log(`gRPC not supported for ${interactionModel} interaction model`);
        return;
    }

    return () => {
        server.bind(`${HOST}:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure());
        server.start();
        console.log(`gRPC running on ${HOST === '0.0.0.0' ? 'localhost' : HOST}:${GRPC_PORT}`);
        return server;
    };
}

async function startup() {
    // start initialization
    const initPromise = init();

    let interactionModel;
    switch (fn.$interactionModel) {
        case undefined:
        case interactionModelTypes.REQUEST_REPLY:
            interactionModel = interactionModelTypes.REQUEST_REPLY;
            break;
        case interactionModelTypes.NODE_STREAMS:
            interactionModel = interactionModelTypes.NODE_STREAMS;
            break;
        default:
            throw new Error(`Unknown interaction model '${fn.$interactionModel}'`);
    }

    console.log(`Server starting with ${interactionModel} interaction model`);

    // load protocols while function is initializing
    const bindGRPC = time(loadGRPC.bind(null, interactionModel), ms => { console.log(`gRPC loaded in ${ms}ms`); });

    // wait for function to finish initializing
    await initPromise;

    // bind protocol servers
    grpcServer = bindGRPC && bindGRPC();
}

startup().then(() => {
    console.log(`Function invoker started in ${Math.floor(process.uptime() * 1000)}ms`);
}, e => {
    console.log('Startup error:', e);
    process.exit(-1);
});


// handle shutdown

function shutdown() {
    console.log(`Server shutdown, ${process.uptime().toFixed(1)}s uptime`);

    // wait 10s for the sever to exit gracefully before killing it
    setTimeout(() => {
        console.log('$destroy timeout');
        process.exit(1);
    }, 10e3);

    // gracefully exit protocol servers
    Promise.all([
        grpcServer && new Promise(resolve => grpcServer.tryShutdown(resolve))
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
