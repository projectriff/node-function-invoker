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

function makeServer(fn) {
    const server = new grpc.Server();

    server.addService(FunctionInvokerService, {
        call(call) {
            call.on('data', async message => {
                const { payload } = message;
                const headers = MessageHeaders.fromObject(message.headers);

                // TODO case insensitive headers
                const contentType = headers.getValue('Content-Type') || 'text/plain';
                const accept = headers.getValue('Accept') || 'text/plain';
                const correlationId = headers.getValue('correlationId');

                try {
                    const accepted = mediaTypeNegotiator(accept, SUPPORTED_MEDIA_TYPES)[0];

                    // check MIME type validity before invoking function
                    const { unmarshall } = mediaTypeMarshallers[contentType] || {};
                    const { marshall } = mediaTypeMarshallers[accepted] || {};

                    if (!unmarshall) throw new RiffError('error-client-content-type-unsupported');
                    if (!marshall) throw new RiffError('error-client-accept-type-unsupported');

                    // convert payloads and invoke function
                    const unmarshalledInput = attempt(unmarshall, payload, 'error-client-unmarshall');
                    const output = await fn(unmarshalledInput);
                    const marshalledOutput = attempt(marshall, output, 'error-client-marshall');

                    logger('Result:', marshalledOutput);

                    // send response
                    let messageBuilder = new MessageBuilder()
                        .addHeader('Content-Type', accepted)
                        .payload(marshalledOutput);
                    if (correlationId) {
                        messageBuilder = messageBuilder.addHeader('correlationId', correlationId)
                    }
                    call.write(messageBuilder.build());
                } catch (err) {
                    logger('Error:', err);

                    if (err instanceof RiffError) {
                        let messageBuilder = new MessageBuilder()
                            .addHeader('error', err.type)
                            .payload(err.cause ? err.cause.stack || ('' + err.cause) : '');
                        if (correlationId) {
                            messageBuilder = messageBuilder.addHeader('correlationId', correlationId)
                        }
                        call.write(messageBuilder.build());
                    } else {
                        let messageBuilder = new MessageBuilder()
                            .addHeader('error', 'error-server-function-invocation')
                            .payload('' + (err && err.stack || err));
                        if (correlationId) {
                            messageBuilder = messageBuilder.addHeader('correlationId', correlationId)
                        }
                        call.write(messageBuilder.build());
                    }
                }
            });
            call.on('end', () => {
                call.end();
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
