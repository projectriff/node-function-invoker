# Node Function Invoker [![Build Status](https://travis-ci.com/projectriff/node-function-invoker.svg?branch=master)](https://travis-ci.com/projectriff/node-function-invoker) [![Greenkeeper badge](https://badges.greenkeeper.io/projectriff/node-function-invoker.svg)](https://greenkeeper.io/)

## Purpose

The _node function invoker_ provides a host for functions consisting of a single NodeJS module.
It accepts HTTP requests, invokes the function for each request, and sends the function's output to the HTTP response.

## Development

### Prerequisites

The following tools are required to build this project:

- `node` 10

### Get the source

```sh
git clone https://github.com/projectriff/node-function-invoker
cd node-function-invoker
```

- To install dependencies:

  ```sh
  npm ci
  ```

- To run tests:
  ```sh
  npm test
  ```

## Functions

At runtime, the node function invoker will `require()` the target function module.
This module must export the function to invoke.

```js
// square
module.exports = x => x ** 2;
```

The first argument is the triggering message's payload and the returned value is the resulting message's payload.

### Async

Asynchronous work can be completed by defining either an `async function` or by returning a `Promise`.

```js
// async
module.exports = async x => x ** 2;

// promise
module.exports = x => Promise.resolve(x ** 2);
```

### Streams (experimental)

#### Proto generation

```shell
 $ npm i # to install the dependencies if not done already
 $ npm generate-proto
```

#### Full streaming setup

1. Set up Kafka onto your K8s cluster (apply `kafka-broker.yaml` defined in https://github.com/projectriff/streaming-processor).
1. Set up Liiklus (apply `liiklus.yaml` defined in https://github.com/projectriff/streaming-processor).
1. Set up the Kafka Gateway by following these [instructions](https://github.com/projectriff/kafka-gateway).

##### Local execution

###### End-to-end run

1. Run the Liiklus producer and the consumer with this [project](https://github.com/projectriff-samples/liiklus-client).
1. Run this invoker: `FUNCTION_URI="${PWD}/samples/repeater" npm run start-streaming`
1. Run the [processor](https://github.com/projectriff/streaming-processor) with the appropriate parameters.
1. Start sending data via the Liiklus producer.

###### Invoker debug run

Execute the following:

```shell
 $ FUNCTION_URI="${PWD}/samples/repeater" NODE_DEBUG='riff' npm run start-streaming
```

### Messages vs Payloads

By default, functions accept and produce payloads. Functions that need to interact with headers can instead opt to receive and/or produce messages. A message is an object that contains both headers and a payload. Message headers are a map with case-insensitive keys and multiple string values.

Since JavaScript and Node have no built-in type for messages or headers, riff uses the [@projectriff/message](https://github.com/projectriff/node-message/) npm module. To use messages, functions should install the `@projectriff/message` package:

```bash
npm install --save @projectriff/message
```

#### Receiving messages

```js
const { Message } = require('@projectriff/message');

// a function that accepts a message, which is an instance of Message
module.exports = message => {
    const authorization = message.headers.getValue('Authorization');
    ...
};

// tell the invoker the function wants to receive messages
module.exports.$argumentType = 'message';

// tell the invoker to produce this particular type of message
Message.install();
```

#### Producing messages

```js
const { Message } = require("@projectriff/message");

const instanceId = Math.round(Math.random() * 10000);
let invocationCount = 0;

// a function that produces a Message
module.exports = name => {
  return Message.builder()
    .addHeader("X-Riff-Instance", instanceId)
    .addHeader("X-Riff-Count", invocationCount++)
    .payload(`Hello ${name}!`)
    .build();
};

// even if the function receives payloads, it can still produce a message
module.exports.$argumentType = "payload";
```

### Lifecycle

Functions that communicate with external services, like a database, can use the `$init` and `$destroy` lifecycle hooks on the function.
These methods are invoked once per function invoker instance, whereas the target function may be invoked multiple times within a single function invoker instance.

The `$init` method is guarenteed to finish before the main function is invoked.
The `$destroy` method is guarenteed to be invoked after all of the main functions are finsished.

```js
let client;

// function
module.exports = async ({ key, amount }) => {
  return await client.incrby(key, amount);
};

// setup
module.exports.$init = async () => {
  const Redis = require("redis-promise");
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
Lifecycle functions have up to 10 seconds to complete their work, or the function invoker will abort.
