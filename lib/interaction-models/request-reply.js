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

const miss = require('mississippi');
const { Message } = require('@projectriff/message');
const { canMarshall, canUnmarshall, determineContentTypes } = require('./content-negotiation');
const { unmarshallPayload, buildMessage, buildErrorMessage, RiffError } = require('./commons');

function requestReplyInteractionModel(fn, argumentTransformer, messageStream) {
    const requestReplyStream = miss.through.obj(async function (message, enc, callback) {
        const { headers, payload } = Message.fromRiffMessage(message);
        const correlationId = headers.getValue('correlationId');

        try {
            const { contentType, accept } = determineContentTypes(headers.getValue('Content-Type'), headers.getValue('Accept'));

            if (!canUnmarshall(contentType)) throw new RiffError('error-client-content-type-unsupported');
            if (!canMarshall(accept)) throw new RiffError('error-client-accept-type-unsupported');

            // convert payloads and invoke function
            const unmarshalledInput = unmarshallPayload(payload, contentType)
            const unmarshalledMessage = new Message(headers, unmarshalledInput);
            const output = await fn(argumentTransformer(unmarshalledMessage));
            const responseMessage = buildMessage(output, { correlationId, contentType: accept });
            callback(null, responseMessage.toRiffMessage());
        } catch (err) {
            const errorMessage = buildErrorMessage(err, { correlationId });
            callback(null, errorMessage.toRiffMessage());
        }
    });
    messageStream.pipe(requestReplyStream).pipe(messageStream);
}

module.exports = requestReplyInteractionModel;
