const startInvoker = require('./lib/invoker');

const userFunctionUri = process.env.FUNCTION_URI;
if (typeof userFunctionUri === 'undefined' || userFunctionUri.trim() === '') {
    throw 'FUNCTION_URI envvar not set or empty. Aborting.'
}
const port = process.env.GRPC_PORT || '8081';

startInvoker(userFunctionUri, port);
