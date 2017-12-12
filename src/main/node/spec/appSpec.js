const request = require('supertest');

describe('app', () => {
    const makeApp = require('../lib/app');
    let app;

    beforeEach(() => {
        app = makeApp(x => x ** 2);
    });

    describe('when plain text is accepted', () => {
        it('should respond with plain text', () => {
            return request(app)
                .post('/')
                .accept('text/plain')
                .type('text/plain')
                .send('3')
                .expect(200)
                .expect('content-type', /plain/)
                .expect(res => {
                    expect(res.text).toBe('9');
                });
        });

        it('should respond with plain text, even when sending another context type', () => {
            return request(app)
                .post('/')
                .accept('text/plain')
                .type('application/json')
                .send(3)
                .expect(200)
                .expect('content-type', /plain/)
                .expect(res => {
                    expect(res.text).toBe('9');
                });
        });
    });

    describe('when JSON is accepted', () => {
        it('should respond with JSON', () => {
            return request(app)
                .post('/')
                .accept('application/json')
                .type('application/json')
                .send(3)
                .expect(200)
                .expect('content-type', /json/)
                .expect(res => {
                    expect(res.text).toBe('9');
                });
        });

        it('should respond with JSON, even when sending another content type', () => {
            return request(app)
                .post('/')
                .accept('application/json')
                .type('text/plain')
                .send('3')
                .expect(200)
                .expect('content-type', /json/)
                .expect(res => {
                    expect(res.text).toBe('9');
                });
        });
    });
});
