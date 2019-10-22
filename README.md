# Node Function Invoker [![Build Status](https://travis-ci.com/projectriff/node-function-invoker.svg?branch=master)](https://travis-ci.com/projectriff/node-function-invoker) [![Greenkeeper badge](https://badges.greenkeeper.io/projectriff/node-function-invoker.svg)](https://greenkeeper.io/)

## Purpose

The node function invoker provides a host for functions consisting of a single NodeJS module.
It adheres to [riff streaming protocol](https://github.com/projectriff/streaming-processor) 
and invokes functions accordingly.

## Supported functions

### Non-streaming functions

Non-streaming functions, more specifically "request-reply" functions, such as:
```js
module.exports = (x) => x ** 2;
```
will be automatically promoted to streaming functions via the equivalent of the `map` operator.

Request-reply functions can also be asynchronous:
```js
module.exports = async (x) => x ** 2;
```

or return a Promise:
```js
module.exports = (x) => Promise.resolve(x ** 2);
```

Finally, note that the interaction model can be explicitly advertised, albeit this is not necessary:
```js
module.exports = (x) => x ** 2;
module.exports.$interactionModel = 'request-reply';
```

### Streaming functions

Streaming functions must comply to the following signature:
```js
module.exports = (inputStreams, outputStreams) => {
    const firstInputStream = inputStreams["0"];
    const firstOutputStream = outputStreams["0"];
    const secondOutputStream = outputStreams["1"];
    // do something
};
module.exports.$interactionModel = 'node-streams';
module.exports.$arity = 3;
```
The interaction mode and the arity are **required** in this case.

The arity is the number of input streams plus the number of output streams the function accepts
(here: 1 input stream + 2 output streams hence an arity of 3).

Input streams are [Readable streams](https://nodejs.org/api/stream.html#stream_readable_streams).

Output streams are [Writable streams](https://nodejs.org/api/stream.html#stream_class_stream_readable).

The function **must** end the output streams when it is done emitting data or when an error occurs
(if the output streams are [`pipe`](https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options)'d from 
input streams, 
then this is automatically managed by this invoker).

## Lifecycle

Functions that communicate with external services, like a database, can use the `$init` and `$destroy` lifecycle hooks 
on the function.
These methods are called once per **function invocation**.

The `$init` method is guaranteed to finish before the main function is invoked.

The `$destroy` method is guaranteed to be invoked after all of the main functions are finished.

```js
let client;

// function
module.exports = async ({key, amount}) => {
    return await client.incrby(key, amount);
};

// setup
module.exports.$init = async () => {
    const Redis = require('redis-promise');
    client = new Redis();
    await client.connect();
};

// cleanup
module.exports.$destroy = async () => {
    await client.quit();
};
```

The lifecycle methods are optional, and should only be implemented when needed.
The hooks may be either traditional or async functions.
Lifecycle functions have up to **10 seconds** to complete their work, or the function invoker will abort.

## Argument transformers

Sometimes, the content-type information is not enough to extract the payload the user function is supposed to interact 
with.

Argument transformers are custom functions that take a `Message` (as defined by [`@projectriff/message`](https://github.com/projectriff/node-message))
and return whatever the function needs. 

The `Message` payload is the result of the first content-type-based  conversion pass. For instance, if the input 
content-type is `application/json` and its payload is `'{"key": "value"}'` the payload of the `Message` exposed to the 
transformer will be the corresponding object representation (i.e. `{"key": "value"}`).

Argument transformers are declared this way:

```js
module.exports.$argumentTransformers = [
    // transformer for first input
    (message) => {
        return message.payload;
    },
    // transformer for second input
    (message) => {
        return message.headers.getValue('x-some-header');
    },
    // ...
];
```

If `$argumentTransformers` is not declared, the default transformer assigned to each input extracts the `Message` 
payload.

## Supported protocols

This invoker supports only streaming, and complies to [riff streaming protocol](https://github.com/projectriff/streaming-processor).
However, it is possible to send HTTP requests and receive HTTP responses if you combine this invoker with the streaming HTTP adapter available [here](https://github.com/projectriff/streaming-http-adapter).

## Development

### Prereqs

 - [Node](https://nodejs.org/en/download/) version required: 10+.
 - Make sure to install the [EditorConfig](https://editorconfig.org/) plugin in your editing environment.
 
#### Build

 - Install dependencies by running `npm ci`.
 - Generate the Protobuf client and server with `npm run generate-proto`
 - Run the tests with `npm test`

#### Full streaming setup

1. Set up Kafka onto your K8s cluster (`kubectl apply` the file `kafka-broker.yaml` included in the [streaming processor project](https://github.com/projectriff/streaming-processor)).
1. Set up Liiklus (`kubectl apply` the file `liiklus.yaml` included in the [streaming processor project](https://github.com/projectriff/streaming-processor)).
1. Set up the Kafka Gateway by following these [instructions](https://github.com/projectriff/kafka-gateway).

### End-to-end local run

 - Run Liiklus producers and consumers with this [project](https://github.com/projectriff-samples/liiklus-client).
 - Run this invoker:
```shell script
 $ FUNCTION_URI='$(pwd)/samples/streaming-repeater' npm start
```
 - Run the [processor](https://github.com/projectriff/streaming-processor) with the appropriate parameters.
 - Start sending data via the Liiklus producers.

### Invoker local debug run

Execute the following and enjoy some logs:

```shell script
 $ FUNCTION_URI='$(pwd)/samples/streaming-repeater' NODE_DEBUG='riff' npm start
```

