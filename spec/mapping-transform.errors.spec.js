const MappingTransform = require('../lib/mapping-transform');

describe('erroring MappingTransform =>', () => {

    let mappingTransform;

    afterEach(() => {
        mappingTransform.destroy();
    });

    [
        {type: 'promise-based', impl: (x) => Promise.resolve(x.foo())},
        {type: 'synchronous', impl: (x) => x.foo()}
    ].forEach(fn =>
        describe(`when dealing with error-throwing ${fn.type} functions =>`, () => {
            beforeEach(() => {
                mappingTransform = new MappingTransform(fn.impl, {objectMode: true});
            });

            it('throws when an error occurs', () => {
                try {
                    mappingTransform.write({});
                    fail('should throw');
                } catch (err) {
                    expect(err.name).toEqual('TypeError');
                    expect(err.message).toEqual('x.foo is not a function');
                }
            });
        }));

    describe('when dealing with error-throwing asynchronous functions =>', () => {
        beforeEach(() => {
            mappingTransform = new MappingTransform(async (x) => x.foo(), {objectMode: true});
        });

        it('intercepts async runtime errors and sends error events', (done) => {
            mappingTransform.on('data', () => {
                done(new Error('should not receive any data as the computation failed'));
            });
            mappingTransform.on('error', (err) => {
                expect(err.type).toEqual('request-reply-function-runtime-error');
                expect(err.cause.name).toEqual('TypeError');
                expect(err.cause.message).toEqual('x.foo is not a function');
                done();
            });
            mappingTransform.write({});
        });
    });
});
