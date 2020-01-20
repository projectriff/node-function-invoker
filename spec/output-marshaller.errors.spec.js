const {newFixedSource} = require('./helpers/factories');
const OutputMarshaller = require('../lib/output-marshaller');

describe('erroring output marshaller =>', () => {

    it('fails to instantiate if the output index is invalid', () => {
        try {
            new OutputMarshaller(-1, 'text/plain', {});
            fail('instantiation should fail');
        } catch (err) {
            expect(err.type).toEqual('error-output-index-invalid');
            expect(err.cause).toEqual('invalid output index: -1');
        }
    });

    it('fails to instantiate if the content type is not supported', () => {
        try {
            new OutputMarshaller(0, 'text/nope', {});
            fail('instantiation should fail');
        } catch (err) {
            expect(err.type).toEqual('error-output-content-type-unsupported');
            expect(err.cause).toEqual('unrecognized output #0\'s content-type text/nope');
        }
    });

    ['application/json', 'application/cloudevents+json'].forEach((mediaType) => {
        describe(`with invalid payloads for ${mediaType} =>`, () => {

            let marshaller;
            let outputPayloadSource;

            beforeEach(() => {
                marshaller = new OutputMarshaller(0, mediaType, {objectMode: true});
                outputPayloadSource = newFixedSource([Symbol(42)]);
            });

            afterEach(() => {
                outputPayloadSource.destroy();
                marshaller.destroy();
            });

            it('emits an error', (done) => {
                marshaller.on('data', () => {
                    done(new Error('should not receive data'));
                });
                marshaller.on('error', (err) => {
                    expect(err.type).toEqual('error-output-invalid');
                    expect(err.cause.name).toEqual('Error');
                    expect(err.cause.message).toEqual('Could not marshall Symbol(42) to JSON');
                    done();
                });

                outputPayloadSource.pipe(marshaller);
            });
        })
    });
});
