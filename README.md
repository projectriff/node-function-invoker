# Node Function Invoker [![Build Status](https://travis-ci.org/projectriff/node-function-invoker.svg?branch=master)](https://travis-ci.org/projectriff/node-function-invoker)

[![Greenkeeper badge](https://badges.greenkeeper.io/projectriff/node-function-invoker.svg)](https://greenkeeper.io/)

## Purpose
The *node function invoker* provides a Docker base layer for a function consisting of a single NodeJS module.
It accepts gRPC requests, invokes the command for each request in the input stream, and sends the command's output to the stream of gRPC responses.

## Install

To install as a riff invoker:

```sh
riff invokers apply -f https://github.com/projectriff/node-function-invoker/raw/master/node-invoker.yaml
```

> To install a specific version replace `master` in the URL with the version tag, like `v0.0.6`.

or, after getting the source:

```sh
riff invokers apply -f ./node-invoker.yaml
```

See [riff invokers apply](https://github.com/projectriff/riff/blob/master/riff-cli/docs/riff_invokers_apply.md) command docs for detail.

## Development

### Prerequisites

The following tools are required to build this project:

- `node` 8 (only for tests)
- Docker

### Get the source

```sh
cd $RIFF_HOME
git clone -o upstream https://github.com/projectriff/node-function-invoker
```

* To build the Docker base layer:
  ```sh
  ./build.sh
  ```

  This assumes that your docker client is correctly configured to target the daemon where you want the image built.

* To run tests:
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

Streaming functions can be created by setting the `$interactionModel` property on the function to `node-streams`.
The function will then be invoked with two arguments, an `input` [Readable Stream](https://nodejs.org/dist/latest-v8.x/docs/api/stream.html#stream_class_stream_readable) and an `output` [Writeable Stream](https://nodejs.org/dist/latest-v8.x/docs/api/stream.html#stream_class_stream_writable).
Both streams are object streams. Any value returned by the function is ignored, new messages must be written to the output stream.

```js
// echo.js
module.exports = (input, output) => {
    input.pipe(output);
};
module.exports.$interactionModel = 'node-streams';
```

Any npm package that works with Node Streams can be used.

```js
// upperCase.js
const miss = require('mississippi');

const upperCaser = miss.through.obj((chunk, enc, cb) => {
    cb(null, chunk.toUpperCase());
});

module.exports = (input, output) => {
    input.pipe(upperCaser).pipe(output);
};
module.exports.$interactionModel = 'node-streams';
```

The `Content-Type` for output messages can be set with the `$defaultContentType` property. By default, `text/plain` is used. For request-reply function, the `Accept` header is used, however, there is no Accept header in a stream.

```js
// greeter.js
const miss = require('mississippi');

const greeter = miss.through.obj((chunk, enc, cb) => {
    cb(null, {
        greeting: `Hello ${chunk}!`
    });
});

module.exports = (input, output) => {
    input.pipe(greeter).pipe(output);
};
module.exports.$interactionModel = 'node-streams';
module.exports.$defaultContentType = 'application/json';
```

### Lifecycle

Functions that communicate with external services, like a database, can use the `$init` and `$destroy` lifecycle hooks on the function.
These methods are invoked once per function invoker instance, whereas the target function may be invoked multiple times within a single function invoker instance.

The `$init` method is guarenteed to finish before the main function is invoked.
The `$destroy` method is guarenteed to be invoked after all of the main functions are finsished.

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
Lifecycle functions have up to 10 seconds to complete their work, or the function invoker will abort.

## riff Commands

- [riff init node](#riff-init-node)
- [riff create node](#riff-create-node)

<!-- riff-init -->
### riff init node

Initialize a node function

#### Synopsis

Generate the function based on the function source code specified as the filename, using the name
and version specified for the function image repository and tag.

For example, from a directory  named 'square' containing a function 'square.js', you can simply type :

    riff init node

to generate the resource definitions using sensible defaults.


```
riff init node [flags]
```

#### Options

```
  -h, --help                     help for node
      --invoker-version string   the version of invoker to use when building containers (default "0.0.6-snapshot")
```

#### Options inherited from parent commands

```
  -a, --artifact string      path to the function artifact, source code or jar file
      --config string        config file (default is $HOME/.riff.yaml)
      --dry-run              print generated function artifacts content to stdout only
  -f, --filepath string      path or directory used for the function resources (defaults to the current directory)
      --force                overwrite existing functions artifacts
  -i, --input string         the name of the input topic (defaults to function name)
  -n, --name string          the name of the function (defaults to the name of the current directory)
  -o, --output string        the name of the output topic (optional)
  -u, --useraccount string   the Docker user account to be used for the image repository (default "current OS user")
  -v, --version string       the version of the function image (default "0.0.1")
```

#### SEE ALSO

* [riff init](https://github.com/projectriff/riff/blob/master/riff-cli/docs/riff_init.md)	 - Initialize a function

<!-- /riff-init -->

<!-- riff-create -->
### riff create node

Create a node function

#### Synopsis

Create the function based on the function source code specified as the filename, using the name
and version specified for the function image repository and tag.

For example, from a directory  named 'square' containing a function 'square.js', you can simply type :

    riff create node

to create the resource definitions, and apply the resources, using sensible defaults.


```
riff create node [flags]
```

#### Options

```
  -h, --help                     help for node
      --invoker-version string   the version of invoker to use when building containers (default "0.0.6-snapshot")
      --namespace string         the namespace used for the deployed resources (defaults to kubectl's default)
      --push                     push the image to Docker registry
```

#### Options inherited from parent commands

```
  -a, --artifact string      path to the function artifact, source code or jar file
      --config string        config file (default is $HOME/.riff.yaml)
      --dry-run              print generated function artifacts content to stdout only
  -f, --filepath string      path or directory used for the function resources (defaults to the current directory)
      --force                overwrite existing functions artifacts
  -i, --input string         the name of the input topic (defaults to function name)
  -n, --name string          the name of the function (defaults to the name of the current directory)
  -o, --output string        the name of the output topic (optional)
  -u, --useraccount string   the Docker user account to be used for the image repository (default "current OS user")
  -v, --version string       the version of the function image (default "0.0.1")
```

#### SEE ALSO

* [riff create](https://github.com/projectriff/riff/blob/master/riff-cli/docs/riff_create.md)	 - Create a function (equivalent to init, build, apply)

<!-- /riff-create -->
