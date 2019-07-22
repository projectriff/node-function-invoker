
const querystring = require('querystring');

module.exports = {
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
