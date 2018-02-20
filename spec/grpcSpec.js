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

const { FunctionInvokerClient, MessageBuilder, MessageHeaders } = require('@projectriff/function-proto');
const grpc = require('grpc');
const makeServer = require('../lib/grpc');

const HOST = process.env.HOST || '127.0.0.1';
let port = 50051;

function makeLocalServer(fn) {
    const server = makeServer(fn);

    // TODO figure out why resuing the same port fails after three test cases
    const address = `${HOST}:${port++}`;

    server.bind(address, grpc.ServerCredentials.createInsecure());
    server.start();

    const client = new FunctionInvokerClient(address, grpc.credentials.createInsecure());

    return { client, server };
}

function parseMessage(message) {
    return {
        headers: MessageHeaders.fromObject(message.headers),
        payload: message.payload
    };
}

describe('grpc', () => {
    let client, server, fn;

    afterEach(done => {
        if (!server) return done();
        server.tryShutdown(done);
    });

    describe('function semantics', () => {
        it('handles sync functions', done => {
            fn = jasmine.createSpy('fn', name => `Hello ${name}!`).and.callThrough();
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
            call.write(new MessageBuilder().payload('riff').build());
            call.end();
        });

        it('handles promised functions', done => {
            fn = jasmine.createSpy('fn', name => Promise.resolve(`Hello ${name}!`)).and.callThrough();
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
            call.write(new MessageBuilder().payload('riff').build());
            call.end();
        });

        it('handles async functions', done => {
            fn = jasmine.createSpy('fn', async name => `Hello ${name}!`).and.callThrough();
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
            call.write(new MessageBuilder().payload('riff').build());
            call.end();
        });

        it('handles thrown errors', done => {
            fn = jasmine.createSpy('fn', () => { throw new Error('I always throw'); }).and.callThrough();
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
            call.write(new MessageBuilder().payload('riff').build());
            call.end();
        });

        it('handles rejected promises', done => {
            fn = jasmine.createSpy('fn', () => Promise.reject(new Error('I always reject'))).and.callThrough();
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
            call.write(new MessageBuilder().payload('riff').build());
            call.end();
        });

        it('handles thrown non-errors', done => {
            fn = jasmine.createSpy('fn', () => { throw 'an error, but not an Error'; }).and.callThrough();
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
            call.write(new MessageBuilder().payload('riff').build());
            call.end();
        });

        it('correlates responses', done => {
            fn = jasmine.createSpy('fn', echo => echo).and.callThrough();
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
                new MessageBuilder()
                    .addHeader('correlationId', '12345')
                    .payload('riff')
                    .build()
            );
            call.end();
        });
    });

    describe('content negotiation', () => {
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
            call.write(new MessageBuilder().payload('riff').build());
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
                new MessageBuilder()
                    .addHeader('Accept', 'text/plain')
                    .addHeader('Content-Type', 'text/plain')
                    .payload('riff')
                    .build()
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
                new MessageBuilder()
                    .addHeader('Accept', 'application/json')
                    .addHeader('Content-Type', 'application/json')
                    .payload('"riff"')
                    .build()
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
                new MessageBuilder()
                    .addHeader('Accept', 'application/octet-stream')
                    .addHeader('Content-Type', 'application/octet-stream')
                    .payload(Buffer.from([0x72, 0x69, 0x66, 0x66]))
                    .build()
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
                new MessageBuilder()
                    .addHeader('Accept', 'application/x-www-form-urlencoded')
                    .addHeader('Content-Type', 'application/x-www-form-urlencoded')
                    .payload('name=project+riff&email=riff%40example.com')
                    .build()
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
                new MessageBuilder()
                    .addHeader('Accept', 'text/plain')
                    .addHeader('Content-Type', 'text/plain; charset=utf-8')
                    .payload('riff')
                    .build()
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
                new MessageBuilder()
                    .addHeader('Accept', 'application/json;q=0.5, text/plain')
                    .addHeader('Content-Type', 'text/plain')
                    .payload('riff')
                    .build()
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
                new MessageBuilder()
                    .addHeader('Content-Type', 'application/vnd.projectriff.bogus')
                    .payload('riff')
                    .build()
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
                new MessageBuilder()
                    .addHeader('Accept', 'application/vnd.projectriff.bogus')
                    .payload('riff')
                    .build()
            );
            call.end();
        });
    });

});
