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
const { canUnmarshall, determineContentTypes } = require('./content-negotiation');
const { unmarshallPayload, buildMessage, buildErrorMessage, RiffError } = require('./commons');

function nodeStreamsInteractionModel(fn, argumentTransformer, messageStream) {
    const defaultContentType = fn.$defaultContentType || 'text/plain';

    // create transforming streams
    const toFunction = miss.through.obj(function (chunk, enc, callback) {
        const { headers, payload } = Message.fromRiffMessage(chunk);
        try {
            const { contentType } = determineContentTypes(headers.getValue('Content-Type'));
            if (!canUnmarshall(contentType)) throw new RiffError('error-client-content-type-unsupported');
            const unmarshalledPayload = unmarshallPayload(payload, contentType);
            const message = argumentTransformer(new Message(headers, unmarshalledPayload));
            this.push(message);
        } catch (e) {
            const errorMessage = buildErrorMessage(e, {
                correlationId: headers.getValue('correlationId')
            });
            // write errors directly to grpcStream
            messageStream.write(errorMessage.toRiffMessage());
        }
        callback();
    });
    const fromFunction = miss.through.obj(function (chunk, enc, callback) {
        const message = buildMessage(chunk, {
            // TODO allow override of contentType
            contentType: defaultContentType
        });
        this.push(message.toRiffMessage());
        callback();
    });

    // connect streams
    messageStream.pipe(toFunction);
    fromFunction.pipe(messageStream);

    // invoker function
    fn(toFunction, fromFunction);
}

module.exports = nodeStreamsInteractionModel;
