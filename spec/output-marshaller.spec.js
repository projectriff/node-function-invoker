const {TextEncoder} = require('util');
const OutputMarshaller = require('../lib/output-marshaller');
const {newFixedSource, newOutputFrame, newOutputSignal} = require('./helpers/factories');

describe('output marshaller =>', () => {

    let marshaller;
    let source;
    const outputPayloads = [42, "forty-two"];
    const textEncoder = new TextEncoder();

    beforeEach(() => {
        source = newFixedSource(outputPayloads);
    });

    afterEach(() => {
        source.destroy();
    });

    ['application/json', 'application/cloudevents+json'].forEach((mediaType) => {
        const expectedIndex = 0;
        const expectedPayloadCount = outputPayloads.length;

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
                    const expectedFrame = newOutputFrame(expectedIndex, mediaType, textEncoder.encode(JSON.stringify(outputPayloads[index])));
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
