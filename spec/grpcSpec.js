const grpc = require('grpc');
const makeServer = require('../lib/grpc');

let port = 50051;
let correlationId = 0;

function makeLocalServer(fn) {
    const server = makeServer(fn);

    // TODO figure out why resuing the same port fails after three test cases
    const address = `localhost:${port++}`;

    server.bind(address, grpc.ServerCredentials.createInsecure());
    server.start();

    const client = new makeServer.proto.function.MessageFunction(
        address, grpc.credentials.createInsecure());

    return { client, server };
}

function headerValue(value) {
    return {
        values: [value]
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
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers['Content-Type']).toEqual(headerValue('text/plain'));
                expect(payload.toString()).toBe('Hello riff!');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {},
                payload: Buffer.from('riff')
            });
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
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers['Content-Type']).toEqual(headerValue('text/plain'));
                expect(payload.toString()).toBe('Hello riff!');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {},
                payload: Buffer.from('riff')
            });
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
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers['Content-Type']).toEqual(headerValue('text/plain'));
                expect(payload.toString()).toBe('Hello riff!');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {},
                payload: Buffer.from('riff')
            });
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
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers.error).toEqual(headerValue('error-server-function-invocation'));
                // TODO define error payload
                expect(payload.toString()).toMatch('Error: I always throw\n   ');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {},
                payload: Buffer.from('riff')
            });
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
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers.error).toEqual(headerValue('error-server-function-invocation'));
                // TODO define error payload
                expect(payload.toString()).toMatch('Error: I always reject\n    ');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {},
                payload: Buffer.from('riff')
            });
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
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers.error).toEqual(headerValue('error-server-function-invocation'));
                // TODO define error payload
                expect(payload.toString()).toBe('an error, but not an Error');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {},
                payload: Buffer.from('riff')
            });
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
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers.correlationId).toEqual(headerValue('12345'));
                expect(payload.toString()).toEqual('riff');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {
                    correlationId: headerValue('12345')
                },
                payload: Buffer.from('riff')
            });
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
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers['Content-Type']).toEqual(headerValue('text/plain'));
                expect(payload.toString()).toBe('riff');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {},
                payload: Buffer.from('riff')
            });
            call.end();
        });

        it('should handle plain text', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers['Content-Type']).toEqual(headerValue('text/plain'));
                expect(payload.toString()).toBe('riff');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {
                    'Content-Type': headerValue('text/plain'),
                    Accept: headerValue('text/plain')
                },
                payload: Buffer.from('riff')
            });
            call.end();
        });

        it('should handle json', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith('riff');

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers['Content-Type']).toEqual(headerValue('application/json'));
                expect(payload.toString()).toBe('"riff"');

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {
                    'Content-Type': headerValue('application/json'),
                    Accept: headerValue('application/json')
                },
                payload: Buffer.from('"riff"')
            });
            call.end();
        });

        it('should handle binary data', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith(Buffer.from([0x72, 0x69, 0x66, 0x66]));

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers['Content-Type']).toEqual(headerValue('application/octet-stream'));
                expect(payload).toEqual(Buffer.from([0x72, 0x69, 0x66, 0x66]));

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {
                    'Content-Type': headerValue('application/octet-stream'),
                    Accept: headerValue('application/octet-stream')
                },
                payload: Buffer.from([0x72, 0x69, 0x66, 0x66])
            });
            call.end();
        });

        it('should handle form urlencoded data', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith({ name: 'project riff', email: 'riff@example.com' });

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers['Content-Type']).toEqual(headerValue('application/x-www-form-urlencoded'));
                expect(payload).toEqual(Buffer.from('name=project%20riff&email=riff%40example.com'));

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {
                    'Content-Type': headerValue('application/x-www-form-urlencoded'),
                    Accept: headerValue('application/x-www-form-urlencoded')
                },
                payload: Buffer.from('name=project+riff&email=riff%40example.com')
            });
            call.end();
        });

        it('should reject unsupported content types', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).not.toHaveBeenCalled();

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers.error).toEqual(headerValue('error-client-content-type-unsupported'));
                expect(payload).toEqual(Buffer.from([]));

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {
                    'Content-Type': headerValue('application/vnd.projectriff.bogus')
                },
                payload: Buffer.from('riff')
            });
            call.end();
        });

        it('should reject unsupported accept types', done => {
            const call = client.call();
            const onData = jasmine.createSpy('onData');
            const onEnd = () => {
                expect(fn).not.toHaveBeenCalled();

                expect(onData).toHaveBeenCalledTimes(1);
                const { headers, payload } = onData.calls.first().args[0];
                expect(headers.error).toEqual(headerValue('error-client-accept-type-unsupported'));
                expect(payload).toEqual(Buffer.from([]));

                done();
            };
            call.on('data', onData);
            call.on('end', onEnd);
            call.write({
                headers: {
                    Accept: headerValue('application/vnd.projectriff.bogus')
                },
                payload: Buffer.from('riff')
            });
            call.end();
        });
    });

});
