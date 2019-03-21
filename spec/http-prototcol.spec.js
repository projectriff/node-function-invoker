/*
 * Copyright 2018 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { Message, AbstractMessage } = require('@projectriff/message');
const makeServer = require('../lib/protocols/http');
const argumentTransformers = require('../lib/argument-transformers');
const interactionModels = require('../lib/interaction-models');
const request = require('supertest');

function makeLocalServer(fn) {
    const argumentTransformer = argumentTransformers[fn.$argumentType || 'payload'];
    const interactionModel = interactionModels[fn.$interactionModel || 'request-reply'];
    return makeServer(fn, interactionModel, argumentTransformer);
}

describe('http', () => {
    let uninstall;

    beforeEach(() => {
        uninstall = Message.install();
    });
    afterEach(() => {
        if (uninstall) {
            uninstall();
            uninstall = null;
        }
    });

    describe('request-reply semantics', () => {

        it('handles sync functions', done => {
            const fn = jasmine.createSpy('fn', name => `Hello ${name}!`).and.callThrough();
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toBe('Hello riff!');

                    done();
                });
        });

        it('handles promised functions', done => {
            const fn = jasmine.createSpy('fn', name => Promise.resolve(`Hello ${name}!`)).and.callThrough();
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toBe('Hello riff!');

                    done();
                });
        });

        it('handles async functions', done => {
            const fn = jasmine.createSpy('fn', async name => `Hello ${name}!`).and.callThrough();
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toBe('Hello riff!');

                    done();
                });
        });

        it('handles thrown errors', done => {
            const fn = jasmine.createSpy('fn', () => { throw new Error('I always throw'); }).and.callThrough();
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBe('error-server-function-invocation');
                    expect(res.text).toMatch('Error: I always throw\n   ');

                    done();
                });
        });

        it('handles rejected promises', done => {
            const fn = jasmine.createSpy('fn', () => Promise.reject(new Error('I always reject'))).and.callThrough();
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBe('error-server-function-invocation');
                    expect(res.text).toMatch('Error: I always reject\n    ');

                    done();
                });
        });

        it('handles thrown non-errors', done => {
            const fn = jasmine.createSpy('fn', () => { throw 'an error, but not an Error'; }).and.callThrough();
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBe('error-server-function-invocation');
                    expect(res.text).toBe('an error, but not an Error');

                    done();
                });
        });

        it('correlates responses', done => {
            const fn = jasmine.createSpy('fn', echo => echo).and.callThrough();
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .set('correlationId', '12345')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['correlationid']).toEqual('12345');
                    expect(res.text).toBe('riff');

                    done();
                });
        });

        it('can operate on payloads', done => {
            const fn = jasmine.createSpy('fn', name => `Hello ${name}!`).and.callThrough();
            fn.$argumentType = 'payload';
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.text).toBe('Hello riff!');

                    done();
                });
        });

        it('can operate on messages', done => {
            const fn = jasmine.createSpy('fn', ({ headers, payload }) => `Hello ${payload}! Via ${headers.getValue('X-Request-Header')}`).and.callThrough();
            fn.$argumentType = 'message';
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('X-Request-Header', 'text/plain')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    const message = fn.calls.first().args[0];
                    expect(message.payload).toBe('riff');
                    expect(message.headers.getValue('X-Request-Header')).toBe('text/plain');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.text).toBe('Hello riff! Via text/plain');

                    done();
                });
        });

        it('can operate on headers', done => {
            const fn = jasmine.createSpy('fn', headers => `Via ${headers.getValue('X-Request-Header')}`).and.callThrough();
            fn.$argumentType = 'headers';
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('X-Request-Header', 'text/plain')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    const headers = fn.calls.first().args[0];
                    expect(headers.getValue('X-Request-Header')).toBe('text/plain');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.text).toBe('Via text/plain');

                    done();
                });
        });

        it('can produce messages', done => {
            const fn = jasmine.createSpy('fn', name => {
                return Message.builder()
                    .addHeader('X-Test', 'true')
                    .payload(`Hello ${name}!`)
                    .build();
            }).and.callThrough();
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['x-test']).toMatch('true');
                    expect(res.text).toBe('Hello riff!');

                    done();
                });
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
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['x-test']).toMatch('true');
                    expect(res.text).toBe('Hello riff!');

                    done();
                });
        });

    });

    describe('node-streams semantics', () => {

        it('maps events', done => {
            let fnOnData;
            const fn = jasmine.createSpy('fn', (input, output) => {
                fnOnData = jasmine.createSpy('fnOnData', echo => {
                    output.write(echo);
                }).and.callThrough();
                input.on('data', fnOnData);
                input.on('end', () => {
                    output.end();
                });
            }).and.callThrough();
            fn.$interactionModel = 'node-streams';
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fnOnData).toHaveBeenCalledTimes(1);
                    expect(fnOnData).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.text).toBe('riff');

                    done();
                });
        });

        it('reduces a single event', done => {
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
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'application/json')
                .send('1')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.text).toBe('1');

                    done();
                });
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
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);

                    expect(res.headers['content-type']).toMatch('application/json');
                    expect(res.body).toEqual({ greeting: 'Hello riff!' });

                    done();
                });
        });

        it('will error for an unkown input message content-type', done => {
            const fn = jasmine.createSpy('fn', (input, output) => input.pipe(output)).and.callThrough();
            fn.$defaultContentType = 'application/vnd.projectriff.bogus';
            fn.$interactionModel = 'node-streams';
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'application/vnd.projectriff.bogus')
                .send('')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toMatch('error-client-content-type-unsupported');
                    expect(res.text).toEqual('');

                    done();
                });
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
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toMatch('error-client-accept-type-unsupported');
                    expect(res.text).toEqual('');

                    done();
                });
        });

        it('can work with payloads', done => {
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', data => {
                    output.write(data);
                });
                input.on('end', () => {
                    output.end();
                });
            }).and.callThrough();
            fn.$argumentType = 'payload';
            fn.$interactionModel = 'node-streams';
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toEqual('riff');

                    done();
                });
        });

        it('can work with messages', done => {
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', message => {
                    output.write(message.payload);
                });
                input.on('end', () => {
                    output.end();
                });
            }).and.callThrough();
            fn.$argumentType = 'message';
            fn.$interactionModel = 'node-streams';
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toEqual('riff');

                    done();
                });
        });

        it('can work with headers', done => {
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', headers => {
                    output.write(`riff ${headers.getValue('X-Test')}`);
                });
                input.on('end', () => {
                    output.end();
                });
            }).and.callThrough();
            fn.$argumentType = 'headers';
            fn.$interactionModel = 'node-streams';
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .set('X-Test', '1')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toEqual('riff 1');

                    done();
                });
        });

        it('can produce messages', done => {
            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', data => {
                    output.write(
                        Message.builder()
                            .addHeader('X-Test', data)
                            .payload(`riff ${data}`)
                            .build()
                    );
                });
                input.on('end', () => output.end());
            }).and.callThrough();
            fn.$interactionModel = 'node-streams';
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('1')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['x-test']).toBe('1');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toEqual('riff 1');

                    done();
                });
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

            const fn = jasmine.createSpy('fn', (input, output) => {
                input.on('data', data => {
                    output.write(new AltMessage(data));
                });
                input.on('end', () => output.end());
            }).and.callThrough();
            fn.$interactionModel = 'node-streams';
            const app = makeLocalServer(fn);

            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('1')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['x-test']).toBe('1');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toEqual('riff 1');

                    done();
                });
        });
    });

    describe('content negotiation', () => {
        let fn, app;

        beforeEach(() => {
            fn = jasmine.createSpy('fn', echo => echo).and.callThrough();
            app = makeLocalServer(fn);
        });

        it('should default to plain text', done => {
            request(app)
                .post('/')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toEqual('riff');

                    done();
                });
        });

        it('should handle plain text', done => {
            request(app)
                .post('/')
                .set('Accept', 'text/plain')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toEqual('riff');

                    done();
                });
        });

        it('should handle json', done => {
            request(app)
                .post('/')
                .set('Accept', 'application/json')
                .set('Content-Type', 'application/json')
                .send('"riff"')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('application/json');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toEqual('"riff"');

                    done();
                });
        });

        it('should handle binary data', done => {
            request(app)
                .post('/')
                .set('Accept', 'application/octet-stream')
                .set('Content-Type', 'application/octet-stream')
                .send(Buffer.from([0x72, 0x69, 0x66, 0x66]))
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith(Buffer.from([0x72, 0x69, 0x66, 0x66]));

                    expect(res.headers['content-type']).toMatch('application/octet-stream');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.body).toEqual(Buffer.from([0x72, 0x69, 0x66, 0x66]));

                    done();
                });
        });

        it('should handle form urlencoded data', done => {
            request(app)
                .post('/')
                .set('Accept', 'application/x-www-form-urlencoded')
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .send('name=project+riff&email=riff%40example.com')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith({ name: 'project riff', email: 'riff@example.com' });

                    expect(res.headers['content-type']).toMatch('application/x-www-form-urlencoded');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toEqual('name=project%20riff&email=riff%40example.com');

                    done();
                });
        });

        it('should handle a content-type charset', done => {
            request(app)
                .post('/')
                .set('Accept', 'text/plain')
                .set('Content-Type', 'text/plain; charset=utf-8')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toEqual('riff');

                    done();
                });
        });

        it('should handle compound accept types', done => {
            request(app)
                .post('/')
                .set('Accept', 'application/json;q=0.5, text/plain')
                .set('Content-Type', 'text/plain')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).toHaveBeenCalledTimes(1);
                    expect(fn).toHaveBeenCalledWith('riff');

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBeUndefined();
                    expect(res.text).toEqual('riff');

                    done();
                });
        });

        it('should reject unsupported content types', done => {
            request(app)
                .post('/')
                .set('Content-Type', 'application/vnd.projectriff.bogus')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).not.toHaveBeenCalled();

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBe('error-client-content-type-unsupported');
                    expect(res.text).toEqual('');

                    done();
                });
        });

        it('should reject unsupported accept types', done => {
            request(app)
                .post('/')
                .set('Accept', 'application/vnd.projectriff.bogus')
                .send('riff')
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;

                    expect(fn).not.toHaveBeenCalled();

                    expect(res.headers['content-type']).toMatch('text/plain');
                    expect(res.headers['error']).toBe('error-client-accept-type-unsupported');
                    expect(res.text).toEqual('');

                    done();
                });
        });
    });

});
