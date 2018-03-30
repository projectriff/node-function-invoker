/*
 * Copyright 2018 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { FunctionInvokerClient } = require('@projectriff/function-proto');
const { Message, AbstractMessage } = require('@projectriff/message');
const grpc = require('grpc');
const makeServer = require('../lib/grpc');

const HOST = process.env.HOST || '127.0.0.1';
let port = 50051;

function makeLocalServer(fn) {
    const server = makeServer(fn, fn.$interactionModel || 'request-reply', fn.$argumentType || 'payload');

    // TODO figure out why resuing the same port fails after three test cases
    const address = `${HOST}:${++port}`;

    server.bind(address, grpc.ServerCredentials.createInsecure());
    server.start();

    const client = new FunctionInvokerClient(address, grpc.credentials.createInsecure());

    return { client, server };
}

function parseMessage(message) {
    expect(message instanceof AbstractMessage).toBe(false);
    return Message.fromRiffMessage(message);
}

describe('grpc', () => {
    let client, server, uninstall;

    beforeEach(() => {
        uninstall = Message.install();
    });
    afterEach(done => {
        if (uninstall) {
            uninstall();
            uninstall = null;
        }
        if (!server) return done();
        server.tryShutdown(done);
    });

    describe('request-reply semantics', () => {
        it('handles sync functions', done => {
            const fn = jasmine.createSpy('fn', name => `Hello ${name}!`).and.callThrough();
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(payload.toString()).toBe('Hello riff!');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(Message.builder().payload('riff').build().toRiffMessage());
            call.end();
        });

        it('handles promised functions', done => {
            const fn = jasmine.createSpy('fn', name => Promise.resolve(`Hello ${name}!`)).and.callThrough();
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(payload.toString()).toBe('Hello riff!');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(Message.builder().payload('riff').build().toRiffMessage());
            call.end();
        });

        it('handles async functions', done => {
            const fn = jasmine.createSpy('fn', async name => `Hello ${name}!`).and.callThrough();
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(payload.toString()).toBe('Hello riff!');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(Message.builder().payload('riff').build().toRiffMessage());
            call.end();
        });

        it('handles thrown errors', done => {
            const fn = jasmine.createSpy('fn', () => { throw new Error('I always throw'); }).and.callThrough();
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('error')).toEqual(['error-server-function-invocation']);
                expect(payload.toString()).toMatch('Error: I always throw\n   ');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(Message.builder().payload('riff').build().toRiffMessage());
            call.end();
        });

        it('handles rejected promises', done => {
            const fn = jasmine.createSpy('fn', () => Promise.reject(new Error('I always reject'))).and.callThrough();
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('error')).toEqual(['error-server-function-invocation']);
                expect(payload.toString()).toMatch('Error: I always reject\n    ');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(Message.builder().payload('riff').build().toRiffMessage());
            call.end();
        });

        it('handles thrown non-errors', done => {
            const fn = jasmine.createSpy('fn', () => { throw 'an error, but not an Error'; }).and.callThrough();
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('error')).toEqual(['error-server-function-invocation']);
                expect(payload.toString()).toBe('an error, but not an Error');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(Message.builder().payload('riff').build().toRiffMessage());
            call.end();
        });

        it('correlates responses', done => {
            const fn = jasmine.createSpy('fn', echo => echo).and.callThrough();
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('correlationId')).toEqual(['12345']);
                expect(payload.toString()).toEqual('riff');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(
                Message.builder()
                    .addHeader('correlationId', '12345')
                    .payload('riff')
                    .build()
                    .toRiffMessage()
            );
            call.end();
        });

        it('can operate on payloads', done => {
            const fn = jasmine.createSpy('fn', name => `Hello ${name}!`).and.callThrough();
            fn.$argumentType = 'payload';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(payload.toString()).toBe('Hello riff!');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(Message.builder().addHeader('Content-Type', 'text/plain').payload('riff').build().toRiffMessage());
            call.end();
        });

        it('can operate on messages', done => {
            const fn = jasmine.createSpy('fn', ({ headers, payload }) => `Hello ${payload}! Via ${headers.getValue('content-type')}`).and.callThrough();
            fn.$argumentType = 'message';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                const message = fn.calls.first().args[0];
                expect(message.payload).toBe('riff');
                expect(message.headers.getValue('Content-Type')).toBe('text/plain');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(payload.toString()).toBe('Hello riff! Via text/plain');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(Message.builder().addHeader('Content-Type', 'text/plain').payload('riff').build().toRiffMessage());
            call.end();
        });

        it('can operate on headers', done => {
            const fn = jasmine.createSpy('fn', headers => `Via ${headers.getValue('content-type')}`).and.callThrough();
            fn.$argumentType = 'headers';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                const arg = fn.calls.first().args[0];
                expect(arg.getValues('content-type')).toEqual(['text/plain']);

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(payload.toString()).toBe('Via text/plain');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(Message.builder().addHeader('Content-Type', 'text/plain').payload('riff').build().toRiffMessage());
            call.end();
        });

        it('can produce messages', done => {
            const fn = jasmine.createSpy('fn', name => {
                return Message.builder()
                    .addHeader('X-Test', 'true')
                    .payload(`Hello ${name}!`)
                    .build();
            }).and.callThrough();
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(headers.getValues('X-Test')).toEqual(['true']);
                expect(payload.toString()).toBe('Hello riff!');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(Message.builder().addHeader('Content-Type', 'text/plain').payload('riff').build().toRiffMessage());
            call.end();
        });

        it('can produce custom messages', done => {
            class AltMessage extends AbstractMessage {
                constructor(name) {
                    super();
                    this.name = name;
                }
                toRiffMessage() {
                    return {
                        headers: {
                            'x-test': { values: ['true'] },
                            'content-type': { values: ['text/plain'] }
                        },
                        payload: `Hello ${this.name}!`
                    }
                }
            }

            const fn = jasmine.createSpy('fn', name => { return new AltMessage(name); }).and.callThrough();
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(headers.getValues('X-Test')).toEqual(['true']);
                expect(payload.toString()).toBe('Hello riff!');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(Message.builder().addHeader('Content-Type', 'text/plain').payload('riff').build().toRiffMessage());
            call.end();
        });

    });

    describe('node-streams semantics', () => {
        it('recieves events', done => {
            const data = [1, 2, 3];
            const fnOnData = jasmine.createSpy('fnOnData');
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', fnOnData);
                input.on('end', () => {
                    output.end();
                });
            }).and.callThrough();
            fn.$interactionModel = 'node-streams';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(onData).toHaveBeenCalledTimes(0);
                expect(fnOnData).toHaveBeenCalledTimes(3);

                data.forEach((d, i) => {
                    expect(fnOnData.calls.argsFor(i)[0]).toBe(`riff ${d}`);
                });

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            data.forEach(d => {
                call.write(
                    Message.builder()
                        .addHeader('Content-Type', 'text/plain')
                        .payload(`riff ${d}`)
                        .build()
                        .toRiffMessage()
                );
            });
            call.end();
        });

        it('produces events', done => {
            const data = [1, 2, 3];
            const fnOnData = jasmine.createSpy('fnOnData');
            const fnOnEnd = jasmine.createSpy('fnOnEnd');
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', fnOnData);
                input.on('end', fnOnEnd)

                data.forEach(d => {
                    output.write(`riff ${d}`);
                });

                output.end();
            }).and.callThrough();
            fn.$interactionModel = 'node-streams';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(onData).toHaveBeenCalledTimes(3);
                expect(fnOnData).toHaveBeenCalledTimes(0);
                expect(fnOnEnd).toHaveBeenCalledTimes(1);

                data.forEach((d, i) => {
                    const { headers, payload } = parseMessage(onData.calls.argsFor(i)[0]);
                    expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                    expect(payload.toString()).toBe(`riff ${d}`);
                });

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
        });

        it('maps events', done => {
            const data = [1, 2, 3];
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', data => {
                    output.write(data.toUpperCase());
                });
                input.on('end', () => {
                    output.end();
                });
            }).and.callThrough();
            fn.$interactionModel = 'node-streams';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);

                expect(onData).toHaveBeenCalledTimes(3);
                data.forEach((d, i) => {
                    const { headers, payload } = parseMessage(onData.calls.argsFor(i)[0]);
                    expect(headers.getValue('Content-Type')).toEqual('text/plain');
                    expect(payload.toString()).toEqual(`RIFF ${d}`);
                });

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            data.forEach(d => {
                call.write(
                    Message.builder()
                        .addHeader('Content-Type', 'text/plain')
                        .payload(`riff ${d}`)
                        .build()
                        .toRiffMessage()
                );
            });
            call.end();
        });

        it('reduces events', done => {
            const data = [1, 2, 3];
            const fn = jasmine.createSpy('fn', (input, output) => {
                let sum = 0;
                input.on('data', data => {
                    sum += data;
                });
                input.on('end', () => {
                    output.write(sum);
                    output.end();
                });
            }).and.callThrough();
            fn.$interactionModel = 'node-streams';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(onData).toHaveBeenCalledTimes(1);

                const { headers, payload } = parseMessage(onData.calls.argsFor(0)[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(payload.toString()).toBe('6');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);

            data.forEach(d => {
                call.write(
                    Message.builder()
                        .addHeader('Content-Type', 'application/json')
                        .payload('' + d)
                        .build()
                        .toRiffMessage()
                );
            });
            call.end();
        });

        it('can override the default content-type', done => {
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', name => {
                    output.write({ greeting: `Hello ${name}!` });
                });
                input.on('end', () => {
                    output.end();
                });
            }).and.callThrough();
            fn.$defaultContentType = 'application/json';
            fn.$interactionModel = 'node-streams';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.argsFor(0)[0]);
                expect(headers.getValue('Content-Type')).toEqual('application/json');
                expect(JSON.parse(payload.toString())).toEqual({ greeting: 'Hello riff!' });

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(
                Message.builder()
                    .addHeader('Content-Type', 'text/plain')
                    .payload('riff')
                    .build()
                    .toRiffMessage()
            );
            call.end();
        });

        it('will error for an unkown input message content-type', done => {
            const fn = jasmine.createSpy('fn', (input, output) => input.pipe(output)).and.callThrough();
            fn.$defaultContentType = 'application/vnd.projectriff.bogus';
            fn.$interactionModel = 'node-streams';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers } = parseMessage(onData.calls.argsFor(0)[0]);
                expect(headers.getValue('Error')).toEqual('error-client-content-type-unsupported');
                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(
                Message.builder()
                    .addHeader('Content-Type', 'application/vnd.projectriff.bogus')
                    .payload('')
                    .build()
                    .toRiffMessage()
            );
            call.end();
        });

        it('will error for an unkown output message content-type', done => {
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', name => {
                    output.write({ greeting: `Hello ${name}!` });
                });
                input.on('end', () => {
                    output.end();
                });
            }).and.callThrough();
            fn.$defaultContentType = 'application/vnd.projectriff.bogus';
            fn.$interactionModel = 'node-streams';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers } = parseMessage(onData.calls.argsFor(0)[0]);
                expect(headers.getValue('Error')).toEqual('error-client-accept-type-unsupported');
                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(
                Message.builder()
                    .addHeader('Content-Type', 'text/plain')
                    .payload('riff')
                    .build()
                    .toRiffMessage()
            );
            call.end();
        });

        it('can work with payloads', done => {
            const data = [1, 2, 3];
            const fnOnData = jasmine.createSpy('fnOnData');
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', fnOnData);
                input.on('end', () => {
                    output.end();
                });
            }).and.callThrough();
            fn.$argumentType = 'payload';
            fn.$interactionModel = 'node-streams';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(onData).toHaveBeenCalledTimes(0);
                expect(fnOnData).toHaveBeenCalledTimes(3);

                data.forEach((d, i) => {
                    expect(fnOnData.calls.argsFor(i)[0]).toBe(`riff ${d}`);
                });

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            data.forEach(d => {
                call.write(
                    Message.builder()
                        .addHeader('Content-Type', 'text/plain')
                        .payload(`riff ${d}`)
                        .build()
                        .toRiffMessage()
                );
            });
            call.end();
        });

        it('can work with messages', done => {
            const data = [1, 2, 3];
            const fnOnData = jasmine.createSpy('fnOnData');
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', fnOnData);
                input.on('end', () => {
                    output.end();
                });
            }).and.callThrough();
            fn.$argumentType = 'message';
            fn.$interactionModel = 'node-streams';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(onData).toHaveBeenCalledTimes(0);
                expect(fnOnData).toHaveBeenCalledTimes(3);

                data.forEach((d, i) => {
                    const message = fnOnData.calls.argsFor(i)[0];
                    expect(message.headers.getValues('Content-Type')).toEqual(['text/plain']);
                    expect(message.payload).toBe(`riff ${d}`);
                });

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            data.forEach(d => {
                call.write(
                    Message.builder()
                        .addHeader('Content-Type', 'text/plain')
                        .payload(`riff ${d}`)
                        .build()
                        .toRiffMessage()
                );
            });
            call.end();
        });

        it('can work with headers', done => {
            const data = [1, 2, 3];
            const fnOnData = jasmine.createSpy('fnOnData');
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', fnOnData);
                input.on('end', () => {
                    output.end();
                });
            }).and.callThrough();
            fn.$argumentType = 'headers';
            fn.$interactionModel = 'node-streams';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(onData).toHaveBeenCalledTimes(0);
                expect(fnOnData).toHaveBeenCalledTimes(3);

                data.forEach((d, i) => {
                    const headers = fnOnData.calls.argsFor(i)[0];
                    expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                    expect(headers.getValues('X-Test')).toEqual([`${d}`]);
                });

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            data.forEach(d => {
                call.write(
                    Message.builder()
                        .addHeader('Content-Type', 'text/plain')
                        .addHeader('X-Test', d)
                        .payload(`riff ${d}`)
                        .build()
                        .toRiffMessage()
                );
            });
            call.end();
        });

        it('can produce messages', done => {
            const data = [1, 2, 3];
            const fnOnData = jasmine.createSpy('fnOnData');
            const fnOnEnd = jasmine.createSpy('fnOnEnd');
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', fnOnData);
                input.on('end', fnOnEnd)

                data.forEach(d => {
                    output.write(
                        Message.builder()
                            .addHeader('X-Test', d)
                            .payload(`riff ${d}`)
                            .build()
                    );
                });

                output.end();
            }).and.callThrough();
            fn.$interactionModel = 'node-streams';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(onData).toHaveBeenCalledTimes(3);
                expect(fnOnData).toHaveBeenCalledTimes(0);
                expect(fnOnEnd).toHaveBeenCalledTimes(1);

                data.forEach((d, i) => {
                    const { headers, payload } = parseMessage(onData.calls.argsFor(i)[0]);
                    expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                    expect(headers.getValues('X-Test')).toEqual([`${d}`]);
                    expect(payload.toString()).toBe(`riff ${d}`);
                });

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
        });

        it('can produce custom messages', done => {
            class AltMessage extends AbstractMessage {
                constructor(name) {
                    super();
                    this.name = name;
                }
                toRiffMessage() {
                    return {
                        headers: {
                            'X-Test': {
                                values: [`${this.name}`]
                            }
                        },
                        payload: `riff ${this.name}`
                    }
                }
            }

            const data = [1, 2, 3];
            const fnOnData = jasmine.createSpy('fnOnData');
            const fnOnEnd = jasmine.createSpy('fnOnEnd');
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', fnOnData);
                input.on('end', fnOnEnd)

                data.forEach(d => {
                    output.write(new AltMessage(d));
                });

                output.end();
            }).and.callThrough();
            fn.$interactionModel = 'node-streams';
            ({ client, server } = makeLocalServer(fn));

            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(onData).toHaveBeenCalledTimes(3);
                expect(fnOnData).toHaveBeenCalledTimes(0);
                expect(fnOnEnd).toHaveBeenCalledTimes(1);

                data.forEach((d, i) => {
                    const { headers, payload } = parseMessage(onData.calls.argsFor(i)[0]);
                    expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                    expect(headers.getValues('X-Test')).toEqual([`${d}`]);
                    expect(payload.toString()).toBe(`riff ${d}`);
                });

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
        });
    });

    describe('content negotiation', () => {
        let fn;

        beforeEach(() => {
            fn = jasmine.createSpy('fn', echo => echo).and.callThrough();
            ({ client, server } = makeLocalServer(fn));
        });

        it('should default to plain text', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(payload.toString()).toBe('riff');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(Message.builder().payload('riff').build().toRiffMessage());
            call.end();
        });

        it('should handle plain text', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(payload.toString()).toBe('riff');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(
                Message.builder()
                    .addHeader('Accept', 'text/plain')
                    .addHeader('Content-Type', 'text/plain')
                    .payload('riff')
                    .build()
                    .toRiffMessage()
            );
            call.end();
        });

        it('should handle json', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['application/json']);
                expect(payload.toString()).toBe('"riff"');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(
                Message.builder()
                    .addHeader('Accept', 'application/json')
                    .addHeader('Content-Type', 'application/json')
                    .payload('"riff"')
                    .build()
                    .toRiffMessage()
            );
            call.end();
        });

        it('should handle binary data', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith(Buffer.from([0x72, 0x69, 0x66, 0x66]));

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['application/octet-stream']);
                expect(payload).toEqual(Buffer.from([0x72, 0x69, 0x66, 0x66]));

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(
                Message.builder()
                    .addHeader('Accept', 'application/octet-stream')
                    .addHeader('Content-Type', 'application/octet-stream')
                    .payload(Buffer.from([0x72, 0x69, 0x66, 0x66]))
                    .build()
                    .toRiffMessage()
            );
            call.end();
        });

        it('should handle form urlencoded data', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith({ name: 'project riff', email: 'riff@example.com' });

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['application/x-www-form-urlencoded']);
                expect(payload).toEqual(Buffer.from('name=project%20riff&email=riff%40example.com'));

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(
                Message.builder()
                    .addHeader('Accept', 'application/x-www-form-urlencoded')
                    .addHeader('Content-Type', 'application/x-www-form-urlencoded')
                    .payload('name=project+riff&email=riff%40example.com')
                    .build()
                    .toRiffMessage()
            );
            call.end();
        });

        it('should handle a content-type charset', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(payload.toString()).toBe('riff');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(
                Message.builder()
                    .addHeader('Accept', 'text/plain')
                    .addHeader('Content-Type', 'text/plain; charset=utf-8')
                    .payload('riff')
                    .build()
                    .toRiffMessage()
            );
            call.end();
        });

        it('should handle compound accept types', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('Content-Type')).toEqual(['text/plain']);
                expect(payload.toString()).toBe('riff');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(
                Message.builder()
                    .addHeader('Accept', 'application/json;q=0.5, text/plain')
                    .addHeader('Content-Type', 'text/plain')
                    .payload('riff')
                    .build()
                    .toRiffMessage()
            );
            call.end();
        });

        it('should reject unsupported content types', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).not.toHaveBeenCalled();

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('error')).toEqual(['error-client-content-type-unsupported']);
                expect(payload).toEqual(Buffer.from([]));

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(
                Message.builder()
                    .addHeader('Content-Type', 'application/vnd.projectriff.bogus')
                    .payload('riff')
                    .build()
                    .toRiffMessage()
            );
            call.end();
        });

        it('should reject unsupported accept types', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).not.toHaveBeenCalled();

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = parseMessage(onData.calls.first().args[0]);
                expect(headers.getValues('error')).toEqual(['error-client-accept-type-unsupported']);
                expect(payload).toEqual(Buffer.from([]));

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write(
                Message.builder()
                    .addHeader('Accept', 'application/vnd.projectriff.bogus')
                    .payload('riff')
                    .build()
                    .toRiffMessage()
            );
            call.end();
        });
    });

});
