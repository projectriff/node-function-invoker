const request = require('supertest');

describe('http', () => {
    const makeApp = require('../lib/http');
    let app;

    describe('when functions throw', () => {
        beforeEach(() => {
            app = makeApp(() => { throw new Error(); });
        });

        it('should respond with a 500', () => {
            return request(app)
                .post('/')
                .expect(500);
        });
    });

    describe('when async functions are invoked', () => {
        beforeEach(() => {
            app = makeApp(async name => `Hello ${name}!`);
        });

        it('should respond with the result', () => {
            return request(app)
                .post('/')
                .accept('text/plain')
                .type('text/plain')
                .send('riff')
                .expect(200)
                .expect('content-type', /plain/)
                .expect(res => {
                    expect(res.text).toBe('Hello riff!');
                });
        });
    });

    describe('when functions return a Promise', () => {
        beforeEach(() => {
            app = makeApp(name => {
                return new Promise(resolve => {
                    resolve(`Hello ${name}!`);
                });
            });
        });

        it('should respond with the result', () => {
            return request(app)
                .post('/')
                .accept('text/plain')
                .type('text/plain')
                .send('riff')
                .expect(200)
                .expect('content-type', /plain/)
                .expect(res => {
                    expect(res.text).toBe('Hello riff!');
                });
        });
    });

    describe('when plain text is accepted', () => {
        beforeEach(() => {
            app = makeApp(name => `Hello ${name}!`);
        });

        it('should respond with plain text', () => {
            return request(app)
                .post('/')
                .accept('text/plain')
                .type('text/plain')
                .send('riff')
                .expect(200)
                .expect('content-type', /plain/)
                .expect(res => {
                    expect(res.text).toBe('Hello riff!');
                });
        });

        it('should respond with plain text, even when sending another context type', () => {
            return request(app)
                .post('/')
                .accept('text/plain')
                .type('application/json')
                .send('"riff"')
                .expect(200)
                .expect('content-type', /plain/)
                .expect(res => {
                    expect(res.text).toBe('Hello riff!');
                });
        });
    });

    describe('when JSON is accepted', () => {
        beforeEach(() => {
            app = makeApp(({ fahrenheit })  => ({ celsius: (fahrenheit - 32) * 5/9 }));
        });

        it('should respond with JSON', () => {
            return request(app)
                .post('/')
                .accept('application/json')
                .type('application/json')
                .send({ fahrenheit: 212 })
                .expect(200)
                .expect('content-type', /json/)
                .expect(res => {
                    expect(res.body.celsius).toBe(100)
                });
        });

        it('should respond with JSON, even when sending another content type', () => {
            return request(app)
                .post('/')
                .accept('application/json')
                .type('application/x-www-form-urlencoded')
                .send('fahrenheit=212')
                .expect(200)
                .expect('content-type', /json/)
                .expect(res => {
                    expect(res.body.celsius).toBe(100)
                });
        });
    });

    describe('when nothing is accepted', () => {
        beforeEach(() => {
            app = makeApp(name => `Hello ${name}!`);
        });

        it('should respond with a 406', () => {
            return request(app)
                .post('/')
                .accept('application/vnd.projectriff.bogus')
                .type('text/plain')
                .send('riff')
                .expect(406)
                .expect('content-type', /plain/)
                .expect(res => {
                    expect(res.text).toBe('Hello riff!');
                });
        });
    });
});
