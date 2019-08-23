const {newFixedSource, newOutputFrame, newOutputSignal} = require('./helpers/factories');
const OutputMarshaller = require('../lib/output-marshaller');

describe('output marshaller =>', () => {

    let marshaller;
    let source;
    const outputPayloads = [42, "forty-two"];

    beforeEach(() => {
        source = newFixedSource(outputPayloads);
    });

    afterEach(() => {
        source.destroy();
    });

    ['application/json', 'application/cloudevents+json'].forEach((mediaType) => {
        const expectedIndex = 0;
        const expectedResults = [42, '"forty-two"'];
        const expectedPayloadCount = expectedResults.length;

        describe(`with ${mediaType} data =>`, () => {
            beforeEach(() => {
                marshaller = new OutputMarshaller(expectedIndex, mediaType, {objectMode: true});
            });

            afterEach(() => {
                marshaller.destroy();
            });

            it('transforms and forwards the received outputs', (done) => {
                let index = 0;
                marshaller.on('data', (chunk) => {
                    expect(index).toBeLessThan(outputPayloads.length, `should not consume more than ${expectedPayloadCount} elements, about to consume ${index}th one`);
                    const expectedFrame = newOutputFrame(expectedIndex, mediaType, expectedResults[index]);
                    const expectedSignal = newOutputSignal(expectedFrame);
                    expect(chunk).toEqual(expectedSignal);
                    index++;
                });
                marshaller.on('end', () => {
                    done();
                });

                source.pipe(marshaller);
            });
        });
    });
});
