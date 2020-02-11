const {newFixedSource} = require('./helpers/factories');
const OutputMarshaller = require('../lib/output-marshaller');

describe('output marshaller =>', () => {

    ['application/json', 'application/cloudevents+json'].forEach((mediaType) => {
        describe(`with invalid payloads for ${mediaType} =>`, () => {

            let marshaller;
            let outputPayloadSource;

            beforeEach(() => {
                marshaller = new OutputMarshaller(0, mediaType);
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
