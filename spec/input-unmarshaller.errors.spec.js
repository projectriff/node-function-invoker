const {newFixedSource, newInputFrame, newInputSignal} = require('./helpers/factories');
const InputUnmarshaller = require('../lib/input-unmarshaller');

describe('input unmarshaller =>', () => {

    describe('with the default argument transformer =>', () => {
        let unmarshaller;

        beforeEach(() => {
            unmarshaller = new InputUnmarshaller({objectMode: true});
        });

        afterEach(() => {
            unmarshaller.destroy();
        });

        describe('with unsupported content-types =>', () => {

            let unsupportedMediaTypeInputs;

            beforeEach(() => {
                unsupportedMediaTypeInputs = newFixedSource([
                    newInputSignal(newInputFrame(0, 'application/x-doom', '???'))
                ]);
            });

            afterEach(() => {
                unsupportedMediaTypeInputs.destroy();
            });

            it('emits an error', (done) => {
                unmarshaller.on('data', () => {
                    done(new Error(`should not consume any elements`));
                });
                unmarshaller.on('error', (err) => {
                    expect(err.type).toEqual('error-input-content-type-unsupported');
                    expect(err.cause).toEqual('unsupported input #0\'s content-type application/x-doom');
                    done();
                });

                unsupportedMediaTypeInputs.pipe(unmarshaller);
            });
        });

        ['application/json', 'application/cloudevents+json'].forEach((mediaType) => {
            describe(`with invalid payloads for ${mediaType} =>`, () => {

                let invalidInputs;

                beforeEach(() => {
                    invalidInputs = newFixedSource([
                        newInputSignal(newInputFrame(0, mediaType, 'invalid payload'))
                    ]);
                });

                afterEach(() => {
                    invalidInputs.destroy();
                });

                it('emits an error', (done) => {
                    unmarshaller.on('data', () => {
                        done(new Error(`should not consume any elements`));
                    });
                    unmarshaller.on('error', (err) => {
                        expect(err.type).toEqual('error-input-invalid');
                        expect(err.cause.name).toEqual('SyntaxError');
                        expect(err.cause.message).toEqual('Unexpected token i in JSON at position 0');
                        done();
                    });

                    invalidInputs.pipe(unmarshaller);
                });
            });
        });
    });


    describe('with a failing argument transformer =>', () => {
        let unmarshaller;
        let inputs;

        beforeEach(() => {
            unmarshaller = new InputUnmarshaller({objectMode: true}, (message) => {
                throw new Error(message.payload + ' ko');
            });
            inputs = newFixedSource([
                newInputSignal(newInputFrame(0, 'application/json', '42'))
            ]);
        });

        afterEach(() => {
            inputs.destroy();
            unmarshaller.destroy();
        });

        it('emits an error', (done) => {
            unmarshaller.on('data', () => {
                done(new Error(`should not consume any elements`));
            });
            unmarshaller.on('error', (err) => {
                expect(err.type).toEqual('error-argument-transformer');
                expect(err.cause.name).toEqual('Error');
                expect(err.cause.message).toEqual('42 ko');
                done();
            });

            inputs.pipe(unmarshaller);
        });
    });
});
