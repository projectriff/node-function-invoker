const logger = require('util').debuglog('riff');

const { FunctionService } = require('@projectriff/function-proto');
const grpc = require('grpc');
const path = require('path');

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

    server.addService(FunctionService, {
        call(call) {
            call.on('data', async message => {
                const { headers, payload } = message;

                // TODO case insensitive headers
                const contentType = headerValue(headers, 'Content-Type') || 'text/plain';
                const accept = headerValue(headers, 'Accept') || 'text/plain';
                const correlationId = headerValue(headers, 'correlationId');

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
                    call.write({
                        headers: addCorrelationIdHeader({
                            'Content-Type': createHeader(accepted)
                        }, correlationId),
                        payload: marshalledOutput
                    });
                } catch (err) {
                    logger('Error:', err);

                    if (err instanceof RiffError) {
                        call.write({
                            headers: addCorrelationIdHeader({
                                error: createHeader(err.type)
                            }, correlationId),
                            payload: Buffer.from(err.cause ? err.cause.stack || ('' + err.cause) : '')
                        });
                    } else {
                        call.write({
                            headers: addCorrelationIdHeader({
                                error: createHeader('error-server-function-invocation')
                            }, correlationId),
                            payload: Buffer.from('' + (err && err.stack || err))
                        });
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

function headerValue(headers, header) {
    return headers[header] && headers[header].values[0];
}

function createHeader(value) {
    return { values: [value] };
}

function addCorrelationIdHeader(headers, correlationId) {
    if (correlationId != null) {
        headers.correlationId = createHeader(correlationId);
    }
    return headers;
}

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
