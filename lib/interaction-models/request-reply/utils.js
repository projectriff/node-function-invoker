/*
 * Copyright 2018 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const logger = require('util').debuglog('riff');
const RiffError = require('../../riff-error');
const { Message, AbstractMessage } = require('@projectriff/message');
const marshallers = require('./marshallers');
const { marshaller, unmarshaller } = require('../content-negotiation')(marshallers);

function marshallPayload(payload, contentType) {
    const marshall = marshaller(contentType);
    if (!marshall) {
        // TODO is this error type still appropriate
        throw new RiffError('error-client-accept-type-unsupported');
    }
    return attempt(marshall, payload, 'error-client-marshall');
}

function unmarshallPayload(payload, contentType) {
    const unmarshall = unmarshaller(contentType);
    if (!unmarshall) {
        throw new RiffError('error-client-content-type-unsupported');
    }
    return attempt(unmarshall, payload, 'error-client-unmarshall');
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


module.exports = {
    unmarshallPayload,
    buildMessage,
    buildErrorMessage
};
