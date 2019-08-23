const {newFixedSource, newInputFrame, newInputSignal} = require('./helpers/factories');
const InputUnmarshaller = require('../lib/input-unmarshaller');

describe('input unmarshaller =>', () => {
    let unmarshaller;

    beforeEach(() => {
        unmarshaller = new InputUnmarshaller({objectMode: true});
    });

    afterEach(() => {
        unmarshaller.destroy();
    });

    describe('with text/plain data =>', () => {
        let inputs;
        const expectedPayloads = ['aha', 'take me on'];
        const expectedPayloadCount = expectedPayloads.length;

        beforeEach(() => {
            inputs = newFixedSource([
                newInputSignal(newInputFrame(0, 'text/plain', expectedPayloads[0])),
                newInputSignal(newInputFrame(0, 'text/plain', expectedPayloads[1])),
            ]);
        });

        afterEach(() => {
            inputs.destroy();
        });

        it('transforms and forwards the received input signals', (done) => {
            let index = 0;
            unmarshaller.on('data', (chunk) => {
                if (index === expectedPayloadCount) {
                    done(new Error(`should not consume more than ${expectedPayloadCount} elements, about to consume ${index}th one`));
                }
                expect(chunk).toEqual(expectedPayloads[index++]);
            });
            unmarshaller.on('end', () => {
                done();
            });

            inputs.pipe(unmarshaller);
        });
    });

    ['application/json', 'application/cloudevents+json'].forEach((mediaType) => {
        describe(`with ${mediaType} data =>`, () => {
            let inputs;
            const inputPayloads = ['"and the answer obviously is: "', 42];
            const expectedPayloads = ['and the answer obviously is: ', 42];
            const expectedPayloadCount = expectedPayloads.length;

            beforeEach(() => {
                inputs = newFixedSource([
                    newInputSignal(newInputFrame(0, 'application/json', inputPayloads[0])),
                    newInputSignal(newInputFrame(0, 'application/json', expectedPayloads[1])),
                ]);
            });

            afterEach(() => {
                inputs.destroy();
            });

            it('transforms and forwards the received input signals', (done) => {
                let index = 0;
                unmarshaller.on('data', (chunk) => {
                    if (index === expectedPayloadCount) {
                        done(new Error(`should not consume more than ${expectedPayloadCount} elements, about to consume ${index}th one`));
                    }
                    expect(chunk).toEqual(expectedPayloads[index++]);
                });
                unmarshaller.on('end', () => {
                    done();
                });

                inputs.pipe(unmarshaller);
            });
        });
    });

});
