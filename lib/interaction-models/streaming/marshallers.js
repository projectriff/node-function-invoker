
const {TextDecoder, TextEncoder} = require('util');
const querystring = require('querystring');
const textDecoder = new TextDecoder('utf8');
const textEncoder = new TextEncoder('utf8');

module.exports = {
    'application/octet-stream': {
        unmarshall: buffer => buffer,
        marshall: any => Buffer.from(any)
    },
    'text/plain': {
        unmarshall: buffer => textDecoder.decode(buffer),
        marshall: string => textEncoder.encode('' + string)
    },
    'application/json': {
        unmarshall: buffer => JSON.parse(textDecoder.decode(buffer)),
        marshall: object => textEncoder.encode(JSON.stringify(object))
    },
    'application/x-www-form-urlencoded': {
        unmarshall: buffer => querystring.parse(textDecoder.decode(buffer)),
        marshall: object => textEncoder.encode(querystring.stringify(object))
    }
};
