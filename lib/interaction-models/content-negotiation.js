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

const mediaTypeNegotiator = require('negotiator/lib/mediaType');
const SUPPORTED_MEDIA_TYPES = ['text/plain', 'application/octet-stream', 'application/json', 'application/x-www-form-urlencoded']; // In preference order

function canMarshall(mediaTypeMarshallers) {
    return (type) => {
        return !!marshaller(mediaTypeMarshallers)(type);
    }
}

function marshaller(mediaTypeMarshallers) {
    return (type) => {
        const { marshall } = mediaTypeMarshallers[type] || {};
        return marshall;
    }
}

function canUnmarshall(mediaTypeMarshallers) {
    return (type) => {
        return !!unmarshaller(mediaTypeMarshallers)(type);
    }
}

function unmarshaller(mediaTypeMarshallers) {
    return (type) => {
        const {unmarshall} = mediaTypeMarshallers[type] || {};
        return unmarshall;
    }
}

function determineContentTypes(contentType, accept) {
    // TODO correctly handle content-type charset, instead of ignoring it
    contentType = (contentType || 'text/plain').split(';')[0].trim();
    accept = accept || contentType;
    const accepted = mediaTypeNegotiator(accept, SUPPORTED_MEDIA_TYPES)[0];
    return { contentType, accept: accepted };
}

module.exports = (mediaTypeMarshallers) => {
    return {
        canMarshall: canMarshall(mediaTypeMarshallers),
        canUnmarshall: canUnmarshall(mediaTypeMarshallers),
        marshaller: marshaller(mediaTypeMarshallers),
        unmarshaller: unmarshaller(mediaTypeMarshallers),
        determineContentTypes: determineContentTypes
    }
};
