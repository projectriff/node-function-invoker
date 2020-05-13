# Node Function Invoker

![CI](https://github.com/projectriff/node-function-invoker/workflows/CI/badge.svg)

## Purpose

The node function invoker provides a host for functions consisting of a single NodeJS module.
It adheres to [riff streaming protocol](https://github.com/projectriff/streaming-processor)
and invokes functions accordingly.

## Supported functions

### Non-streaming functions (a.k.a. request-reply functions)

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
    const { numbers, letters } = inputStreams;
    const { repetitions } = outputStreams;
    // do something
};
module.exports.$interactionModel = 'node-streams';
```

Please note that streaming functions must always declare the corresponding interaction mode.

Streams can also be looked up by index:
```js
module.exports = (inputStreams, outputStreams) => {
    const firstInputStream = inputStreams.$order[0];
    const firstOutputStream = outputStreams.$order[0];
    const secondOutputStream = outputStreams.$order[1];
    // do something
};
module.exports.$interactionModel = 'node-streams';
```

Input streams are [Readable streams](https://nodejs.org/api/stream.html#stream_readable_streams).

Output streams are [Writable streams](https://nodejs.org/api/stream.html#stream_class_stream_readable).

The function **must** end the output streams when it is done emitting data or when an error occurs
(if the output streams are [`pipe`](https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options)'d from
input streams, then this is automatically managed).

## Message support

A message is an object that contains both headers and a payload.
Message headers are a map with case-insensitive keys and multiple string values.

Since JavaScript and Node have no built-in type for messages or headers, riff uses the [@projectriff/message](https://github.com/projectriff/node-message/) npm module.

By default, request-reply functions accept and produce payloads.
They can be configured instead to **receive** either the entire message or the headers only.

> Streaming functions can only receive messages. Configuring them with `$argumentType` will trigger an error.
> However, they can produce either messages or payloads, just like request-reply functions.

##### Receiving messages

```js
// a request-reply function that accepts a message, which is an instance of Message
module.exports = message => {
    const authorization = message.headers.getValue('Authorization');
    // [...]
};

// tell the invoker the function wants to receive messages
module.exports.$argumentType = 'message';
```

##### Producing messages

To produce messages, functions should install the `@projectriff/message` package:
```bash
npm install --save @projectriff/message
```

```js
const { Message } = require('@projectriff/message');

const instanceId = Math.round(Math.random() * 10000);
let invocationCount = 0;

// a request-reply function that produces a Message
module.exports = name => {
    return Message.builder()
        .addHeader('X-Riff-Instance', instanceId)
        .addHeader('X-Riff-Count', invocationCount++)
        .payload(`Hello ${name}!`)
        .build();
};
```

## Lifecycle

Functions that communicate with external services, like a database, can use the `$init` and `$destroy` lifecycle hooks
on the function.
These methods are called once **per process**.

The `$init` method is guaranteed to finish before the main function is invoked for the first time.

The `$destroy` method is guaranteed to be invoked after all of the main functions are finished, before the process shuts down.

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
Note that the lifecycle hooks must be fields on the exported function.
The hooks may be either synchronous or async functions.
Lifecycle functions have up to **10 seconds** to complete their work, or the function invoker will abort.

## Supported protocols

This invoker supports only streaming, and complies to [riff streaming protocol](https://github.com/projectriff/streaming-processor).
However, it is possible to send HTTP requests and receive HTTP responses if you combine this invoker with the streaming HTTP adapter available [here](https://github.com/projectriff/streaming-http-adapter).

## Development

### Prereqs

 - [Node](https://nodejs.org/en/download/) version required: 10 (LTS), 12 (LTS) or 13.
 - Make sure to install the [EditorConfig](https://editorconfig.org/) plugin in your editing environment.

#### Build

 - Install dependencies by running `npm ci`.
 - Run the tests with `npm test`

### Run

#### Streaming

Execute the following:

```shell script
 $ cd /path/to/node-function-invoker
 $ FUNCTION_URI="/absolute/path/to/function.js" NODE_DEBUG='riff' node server.js
```

#### Request-reply only

If you just want to test request-reply functions, clone the [Streaming HTTP adapter](https://github.com/projectriff/streaming-http-adapter) and run:

```shell script
 $ cd /path/to/streaming-http-adapter
 $ make
 $ FUNCTION_URI="/absolute/path/to/function.js" NODE_DEBUG='riff' ./streaming-http-adapter node /path/to/node-function-invoker/server.js
```

You can then send HTTP POST requests to `http://localhost:8080` and interact with the function.

### Source formatting

We use [prettier](https://prettier.io) style checks to enforce code consistency. Many editors can automatically reformat source to match this style. To manually request formatted source run `npm run format`.
