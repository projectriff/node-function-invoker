const {newFixedSource, newOutputFrame, newOutputSignal} = require('./helpers/factories');
const OutputMarshaller = require('../lib/interaction-models/streaming/output-marshaller');

describe('output marshaller =>', () => {
    let marshaller;
    let outputPayloadSource;
    const outputPayloads = [42, "forty-two"];
    const expectedResults = [42, '"forty-two"'];
    const expectedIndex = 0;
    const expectedContentType = 'application/json';
    const expectedPayloadCount = expectedResults.length;

    beforeEach(() => {
        marshaller = new OutputMarshaller(expectedIndex, expectedContentType, {objectMode: true});
        outputPayloadSource = newFixedSource(outputPayloads);
    });

    afterEach(() => {
        outputPayloadSource.destroy();
        marshaller.destroy();
    });

    it('marshalls the given outputs', (done) => {
        let index = 0;
        marshaller.on('data', (chunk) => {
            if (index === outputPayloads.length) {
                done(new Error(`should not consume more than ${expectedPayloadCount} elements, about to consume ${index}th one`));
            }
            const expectedFrame = newOutputFrame(expectedIndex, expectedContentType, expectedResults[index++]);
            const expectedSignal = newOutputSignal(expectedFrame);
            expect(chunk).toEqual(expectedSignal);
        });
        marshaller.on('end', () => {
            done();
        });

        outputPayloadSource.pipe(marshaller);
    });

    it('fails to instantiate if the output index is invalid', () => {
        try {
            new OutputMarshaller(-1, 'text/plain', {});
            fail('instantiation should fail');
        } catch(err) {
            expect(err.type).toEqual('error-streaming-output-index-invalid');
            expect(err.cause).toEqual('invalid output index: -1');
        }
    });

    it('fails to instantiate if the content type is not supported', () => {
        try {
            new OutputMarshaller(0, 'text/nope', {});
            fail('instantiation should fail');
        } catch(err) {
            expect(err.type).toEqual('error-streaming-output-content-type-unsupported');
            expect(err.cause).toEqual('unrecognized output #0\'s content-type text/nope');
        }
    });
});
