const request = require('supertest');

describe('app', () => {
    const makeApp = require('../lib/app');
    let app;

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
});
