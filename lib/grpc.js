/*
 * Copyright 2018 the original author or authors.
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

const logger = require('util').debuglog('riff');

const { FunctionInvokerService, MessageBuilder, MessageHeaders } = require('@projectriff/function-proto');
const grpc = require('grpc');
const ps = require('promise-streams');

const mediaTypeNegotiator = require('negotiator/lib/mediaType');
const SUPPORTED_MEDIA_TYPES = ['text/plain', 'application/octet-stream', 'application/json', 'application/x-www-form-urlencoded']; // In preference order
const querystring = require('querystring');
const mediaTypeMarshallers = {
    'application/octet-stream': {
        unmarshall: buffer => buffer,
        marshall: any => Buffer.from(any)
    },
    'text/plain': {
        unmarshall: buffer => '' + buffer,
        marshall: string => Buffer.from('' + string)
    },
    'application/json': {
        unmarshall: buffer => JSON.parse('' + buffer),
        marshall: object => Buffer.from(JSON.stringify(object))
    },
    'application/x-www-form-urlencoded': {
        unmarshall: buffer => querystring.parse('' + buffer),
        marshall: object => Buffer.from(querystring.stringify(object))
    }
};

function makeServer(fn, interactionModel = 'request-reply') {
    const server = new grpc.Server();

    server.addService(FunctionInvokerService, {
        call(grpcStream) {

            if (interactionModel === 'streaming') {
                const { grpcToFn, fnToGRPC } = makeFunctionStreams(grpcStream, {
                    // TODO configure defaultContentType somewhere
                    defaultContentType: 'text/plain'
                });
                fn(grpcToFn, fnToGRPC);
                return;
            }

            grpcStream.on('data', async message => {
                const { payload } = message;
                const headers = MessageHeaders.fromObject(message.headers);

                const correlationId = headers.getValue('correlationId');

                try {
                    const { contentType, accept } = determineContentTypes(headers);

                    if (!canUnmarshall(contentType)) throw new RiffError('error-client-content-type-unsupported');
                    if (!canMarshall(accept)) throw new RiffError('error-client-accept-type-unsupported');

                    // convert payloads and invoke function
                    const unmarshalledInput = parseMessage(payload, { contentType })
                    const output = await fn(unmarshalledInput);

                    const responseMessage = buildMessage(output, { correlationId, contentType: accept });
                    grpcStream.write(responseMessage);
                } catch (err) {
                    const errorMessage = buildErrorMessage(err, { correlationId });
                    grpcStream.write(errorMessage);
                }
            });
            grpcStream.on('end', () => {
                grpcStream.end();
            });
        }
    });

    return server;
}

// helpers

function attempt(fn, arg, type) {
    try {
        return fn(arg);
    } catch (e) {
        throw new RiffError(type, e);
    }
}

function canMarshall(type) {
    const { marshall } = mediaTypeMarshallers[type] || {};
    return !!marshall;
}

function canUnmarshall(type) {
    const { unmarshall } = mediaTypeMarshallers[type] || {};
    return !!unmarshall;
}

function makeFunctionStreams(grpcStream, { defaultContentType } = {}) {
    // create transforming streams
    const grpcToFn = ps.map(async message => {
        const headers = MessageHeaders.fromObject(message.headers);
        const { contentType } = determineContentTypes(headers);
        if (!canUnmarshall(contentType)) throw new RiffError('error-client-content-type-unsupported');
        const chunk = parseMessage(message.payload, { contentType });
        return chunk;
    });
    const fnToGRPC = ps.map(async chunk => {
        const message = buildMessage(chunk, {
            // TODO allow override of contentType
            contentType: defaultContentType
        });
        return message
    });

    // connect streams
    grpcStream.pipe(grpcToFn);
    fnToGRPC.pipe(grpcStream);

    return { grpcToFn, fnToGRPC };
}

function determineContentTypes(headers) {
    // TODO correctly handle content-type charset, instead of ignoring it
    const contentType = (headers.getValue('Content-Type') || 'text/plain').split(';')[0].trim();
    const accept = headers.getValue('Accept') || contentType;
    const accepted = mediaTypeNegotiator(accept, SUPPORTED_MEDIA_TYPES)[0];
    return { contentType, accept: accepted };
}

function parseMessage(payload, { contentType }) {
    const { unmarshall } = mediaTypeMarshallers[contentType] || {};
    const unmarshalledInput = attempt(unmarshall, payload, 'error-client-unmarshall');
    return unmarshalledInput;
}

function buildMessage(payload, { contentType, correlationId } = {}) {
    const { marshall } = mediaTypeMarshallers[contentType] || {};
    // TODO is this error type still appropriate
    if (!marshall) throw new RiffError('error-client-accept-type-unsupported');
    const marshalledOutput = attempt(marshall, payload, 'error-client-marshall');
    logger('Result:', marshalledOutput);
    let messageBuilder = new MessageBuilder()
        .addHeader('Content-Type', contentType)
        .payload(marshalledOutput);
    if (correlationId) {
        messageBuilder = messageBuilder.addHeader('correlationId', correlationId)
    }
    return messageBuilder.build();
}

function buildErrorMessage(err, { correlationId } = {}) {
    logger('Error:', err);

    let messageBuilder = new MessageBuilder();
    if (err instanceof RiffError) {
        messageBuilder = messageBuilder
            .addHeader('error', err.type)
            .payload(err.cause ? err.cause.stack || ('' + err.cause) : '');
    } else {
        messageBuilder = messageBuilder
            .addHeader('error', 'error-server-function-invocation')
            .payload('' + (err && err.stack || err));
    }
    if (correlationId) {
        messageBuilder = messageBuilder.addHeader('correlationId', correlationId)
    }
    return messageBuilder.build();
}

// Error type for non-function errors
class RiffError extends Error {
    constructor(type, cause) {
        super();

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, RiffError);
        }

        this.type = type;
        this.cause = cause;
    }
}

module.exports = makeServer;
