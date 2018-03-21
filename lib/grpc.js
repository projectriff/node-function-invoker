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

const interactionModelTypes = require('./interaction-models');

const { FunctionInvokerService, MessageBuilder, MessageHeaders } = require('@projectriff/function-proto');
const grpc = require('grpc');
const through2 = require('through2');

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

const interactionModels = {
    [interactionModelTypes.NODE_STREAMS](fn, grpcStream) {
        const { grpcToFn, fnToGRPC } = makeFunctionStreams(grpcStream, {
            defaultContentType: fn.$defaultContentType || 'text/plain'
        });
        fn(grpcToFn, fnToGRPC);
    },
    [interactionModelTypes.REQUEST_REPLY](fn, grpcStream) {
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
};

function makeServer(fn, interactionModel) {
    let service = interactionModels[interactionModel];
    if (!service) return;

    const server = new grpc.Server();
    server.addService(FunctionInvokerService, {
        call(grpcStream) {
            service(fn, grpcStream);
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
    const grpcToFn = through2.obj(function (message, enc, callback) {
        const headers = MessageHeaders.fromObject(message.headers);
        try {
            const { contentType } = determineContentTypes(headers);
            if (!canUnmarshall(contentType)) throw new RiffError('error-client-content-type-unsupported');
            const chunk = parseMessage(message.payload, { contentType });
            this.push(chunk);
        } catch (e) {
            const errorMessage = buildErrorMessage(e, {
                correlationId: headers.getValue('correlationId')
            });
            // write errors directly to grpcStream
            grpcStream.write(errorMessage);
        }
        callback();
    });
    const fnToGRPC = through2.obj(function (chunk, enc, callback) {
        const message = buildMessage(chunk, {
            // TODO allow override of contentType
            contentType: defaultContentType
        });
        this.push(message);
        callback();
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
    try {
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
    } catch (e) {
        return buildErrorMessage(e, { correlationId });
    }
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
