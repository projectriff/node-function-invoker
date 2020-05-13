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

const { TextDecoder, TextEncoder } = require("util");
const querystring = require("querystring");
const mediaTypeNegotiator = require("negotiator/lib/mediaType");
const contentTypeParser = require("content-type");

const SUPPORTED_MEDIA_TYPES = [
    "application/json",
    "text/plain",
    "application/octet-stream",
    "application/x-www-form-urlencoded",
    "application/cloudevents+json",
]; // In preference order

const acceptableJsonCharsets = ["utf-8", "utf-16", "utf-16le", "utf-16be"];
const textEncoder = new TextEncoder();

const jsonUnmarshall = (buffer, charset) => {
    if (
        charset &&
        acceptableJsonCharsets.indexOf(charset.toLocaleLowerCase("en-US")) ===
            -1
    ) {
        throw new Error(
            `Expected one of the following charsets: ${acceptableJsonCharsets.join(
                ", "
            )}, but was given: ${charset}`
        );
    }
    return JSON.parse(new TextDecoder(charset || "utf-8").decode(buffer));
};
const jsonMarshall = (object) => {
    const json = JSON.stringify(object);
    if (typeof json === "undefined") {
        throw new Error(`Could not marshall ${object.toString()} to JSON`);
    }
    return textEncoder.encode(json);
};

const mediaTypeMarshallers = {
    "application/octet-stream": {
        unmarshal: (buffer) => buffer,
        marshal: (any) => Buffer.from(any),
    },
    "text/plain": {
        unmarshal: (buffer, charset) =>
            new TextDecoder(charset || "utf-8").decode(buffer),
        marshal: (string) => textEncoder.encode("" + string),
    },
    "application/json": {
        unmarshal: jsonUnmarshall,
        marshal: jsonMarshall,
    },
    "application/x-www-form-urlencoded": {
        unmarshal: (buffer) =>
            querystring.parse(new TextDecoder("utf-8").decode(buffer)),
        marshal: (object) => textEncoder.encode(querystring.stringify(object)),
    },
    "application/cloudevents+json": {
        unmarshal: jsonUnmarshall,
        marshal: jsonMarshall,
    },
};

function canMarshal(type) {
    return !!marshaller(type);
}

function marshaller(type) {
    const { marshal } = mediaTypeMarshallers[type] || {};
    return marshal;
}

function canUnmarshal(type) {
    return !!unmarshaller(type);
}

function unmarshaller(mediaType) {
    const { unmarshal } = mediaTypeMarshallers[mediaType] || {};
    return unmarshal;
}

function parseContentType(contentType) {
    const { type, parameters } = contentTypeParser.parse(contentType);
    return { type, charset: parameters.charset };
}

function determineContentTypes(contentType, accept) {
    // TODO correctly handle content-type charset, instead of ignoring it
    contentType = (contentType || "text/plain").split(";")[0].trim();
    accept = accept || contentType;
    const accepted = mediaTypeNegotiator(accept, SUPPORTED_MEDIA_TYPES)[0];
    return { contentType, accept: accepted };
}

module.exports = {
    canMarshal,
    canUnmarshal,
    marshaller,
    unmarshaller,
    parseContentType,
    determineContentTypes,
};
