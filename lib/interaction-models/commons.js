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

const { Message, AbstractMessage } = require('@projectriff/message');
const { marshaller, unmarshaller } = require('./content-negotiation');

function marshallPayload(payload, contentType) {
    const marshall = marshaller(contentType);
    if (!marshall) {
        // TODO is this error type still appropriate
        throw new RiffError('error-client-accept-type-unsupported');
    }
    const marshalledPayload = attempt(marshall, payload, 'error-client-marshall');
    return marshalledPayload;
}

function unmarshallPayload(payload, contentType) {
    const unmarshall = unmarshaller(contentType);
    if (!unmarshall) {
        throw new RiffError('error-client-content-type-unsupported');
    }
    const unmarshalledPayload = attempt(unmarshall, payload, 'error-client-unmarshall');
    return unmarshalledPayload;
}

function buildMessage(message, { contentType, correlationId } = {}) {
    if (message instanceof AbstractMessage) {
        // convert to Message
        message = new Message(message);
    } else {
        // convert generic payload to a Message
        message = new Message({}, message);
    }
    const { headers, payload } = message;
    try {
        const marshalledOutput = marshallPayload(payload, contentType);
        logger('Result:', marshalledOutput);
        let messageBuilder = Message.builder()
            .headers(headers)
            .replaceHeader('Content-Type', contentType)
            .payload(marshalledOutput);
        if (correlationId) {
            messageBuilder = messageBuilder.replaceHeader('correlationId', correlationId)
        }
        return messageBuilder.build();
    } catch (e) {
        return buildErrorMessage(e, { correlationId });
    }
}

function buildErrorMessage(err, { correlationId } = {}) {
    logger('Error:', err);

    let messageBuilder = Message.builder()
        .addHeader('Content-Type', 'text/plain');
    if (err instanceof RiffError) {
        messageBuilder = messageBuilder
            .replaceHeader('error', err.type)
            .payload(err.cause ? err.cause.stack || ('' + err.cause) : '');
    } else {
        messageBuilder = messageBuilder
            .replaceHeader('error', 'error-server-function-invocation')
            .payload('' + (err && err.stack || err));
    }
    if (correlationId) {
        messageBuilder = messageBuilder.replaceHeader('correlationId', correlationId)
    }
    return messageBuilder.build();
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

module.exports = {
    unmarshallPayload,
    RiffError,
    buildMessage,
    buildErrorMessage
};
