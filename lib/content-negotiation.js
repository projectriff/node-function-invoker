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

const {TextDecoder, TextEncoder} = require('util');
const querystring = require('querystring');
const mediaTypeNegotiator = require('negotiator/lib/mediaType');

const SUPPORTED_MEDIA_TYPES = ['text/plain', 'application/octet-stream', 'application/json', 'application/x-www-form-urlencoded', 'application/cloudevents+json']; // In preference order
const textDecoder = new TextDecoder('utf8');
const textEncoder = new TextEncoder();

const jsonUnmarshall = buffer => JSON.parse(textDecoder.decode(buffer));
const jsonMarshall = object => {
    const json = JSON.stringify(object);
    if (typeof json === 'undefined') {
        throw new Error(`Could not marshall ${object.toString()} to JSON`)
    }
    return textEncoder.encode(json);
};

const mediaTypeMarshallers = {
    'application/octet-stream': {
        unmarshall: buffer => buffer,
        marshall: any => Buffer.from(any)
    },
    'text/plain': {
        unmarshall: buffer => textDecoder.decode(buffer),
        marshall: string => textEncoder.encode('' + string)
    },
    'application/json': {
        unmarshall: jsonUnmarshall,
        marshall: jsonMarshall
    },
    'application/x-www-form-urlencoded': {
        unmarshall: buffer => querystring.parse(textDecoder.decode(buffer)),
        marshall: object => textEncoder.encode(querystring.stringify(object))
    },
    'application/cloudevents+json': {
        unmarshall: jsonUnmarshall,
        marshall: jsonMarshall
    }
};

function canMarshall(type) {
    return !!marshaller(type);
}

function marshaller(type) {
    const {marshall} = mediaTypeMarshallers[type] || {};
    return marshall;
}

function canUnmarshall(type) {
    return !!unmarshaller(type);
}

function unmarshaller(type) {
    const {unmarshall} = mediaTypeMarshallers[type] || {};
    return unmarshall;
}

function determineContentTypes(contentType, accept) {
    // TODO correctly handle content-type charset, instead of ignoring it
    contentType = (contentType || 'text/plain').split(';')[0].trim();
    accept = accept || contentType;
    const accepted = mediaTypeNegotiator(accept, SUPPORTED_MEDIA_TYPES)[0];
    return {contentType, accept: accepted};
}

module.exports = {
    canMarshall,
    canUnmarshall,
    marshaller,
    unmarshaller,
    determineContentTypes
};
