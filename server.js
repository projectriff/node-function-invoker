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

const { FUNCTION_URI, HOST, GRPC_PORT, HTTP_PORT } = process.env;

const interactionModels = require('./lib/interaction-models');
const argumentTransformers = require('./lib/argument-transformers');

const { Message } = require('@projectriff/message');
// register Message as default AbstractMessage type
// must be run before the function is required
Message.install();

const fn = require(FUNCTION_URI);

let grpcServer, httpServer;

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

function loadGRPC(interactionModel, argumentTransformer) {
    const grpc = require('grpc');
    const server = require('./lib/protocols/grpc')(fn, interactionModel, argumentTransformer);

    return () => {
        server.bind(`${HOST}:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure());
        server.start();
        console.log(`gRPC running on ${HOST === '0.0.0.0' ? 'localhost' : HOST}:${GRPC_PORT}`);
        return server;
    };
}

function loadHTTP(interactionModel, argumentTransformer) {
    const app = require('./lib/protocols/http')(fn, interactionModel, argumentTransformer);

    return () => {
        const server = app.listen(HTTP_PORT, HOST);
        console.log(`HTTP running on ${HOST === '0.0.0.0' ? 'localhost' : HOST}:${HTTP_PORT}`);
        return server;
    };
}

async function startup() {
    // start initialization
    const initPromise = init();

    let interactionModel;
    switch (fn.$interactionModel) {
        case undefined:
        case 'request-reply':
            interactionModel = interactionModels['request-reply'];
            break;
        case 'node-streams':
            interactionModel = interactionModels['node-streams'];
            break;
        default:
            throw new Error(`Unknown interaction model '${fn.$interactionModel}'`);
    }

    let argumentTransformer;
    switch (fn.$argumentType) {
        case 'message':
            argumentTransformer = argumentTransformers.message;
            break;
        case 'headers':
            argumentTransformer = argumentTransformers.headers;
            break;
        case undefined:
        case 'payload':
            argumentTransformer = argumentTransformers.payload;
            break
        default:
            throw new Error(`Unknown argument type '${fn.$argumentType}'`);
    }

    console.log(`Server starting with ${fn.$interactionModel} interaction model and ${fn.$argumentType} argument type`);

    // load protocols while function is initializing
    const bindGRPC = time(loadGRPC.bind(null, interactionModel, argumentTransformer), ms => { console.log(`gRPC loaded in ${ms}ms`); });
    const bindHTTP = time(loadHTTP.bind(null, interactionModel, argumentTransformer), ms => { console.log(`HTTP loaded in ${ms}ms`); });

    // wait for function to finish initializing
    await initPromise;

    // bind protocol servers
    grpcServer = bindGRPC && bindGRPC();
    httpServer = bindHTTP && bindHTTP();
}

startup().then(() => {
    console.log(`Function invoker started in ${Math.floor(process.uptime() * 1000)}ms`);
}, e => {
    console.log('Startup error:', e);
    process.exit(-1);
});


// handle shutdown

async function shutdown() {
    console.log(`Server shutdown, ${process.uptime().toFixed(1)}s uptime`);

    // wait 10s for the sever to exit gracefully before killing it
    setTimeout(() => {
        console.log('$destroy timeout');
        process.exit(1);
    }, 10e3);

    // gracefully exit protocol servers
    await Promise.all([
        grpcServer && new Promise(resolve => grpcServer.tryShutdown(resolve)),
        httpServer && new Promise(resolve => httpServer.close(resolve))
    ]);

    if (typeof fn.$destroy === 'function') {
        try {
            await fn.$destroy();
        } catch (e) {
            console.log('$destroy error:', e);
            process.exit(2);
        }
    }

    process.exit(0);
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
