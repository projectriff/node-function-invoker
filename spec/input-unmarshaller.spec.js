const {newFixedSource, newInputFrame, newInputSignal} = require('./helpers/factories');
const InputUnmarshaller = require('../lib/interaction-models/streaming/input-unmarshaller');

describe('input unmarshaller =>', () => {
    let unmarshaller;
    let zeroIndexedInputs;
    let nonZeroIndexedInputs;
    let unsupportedInputs;
    const expectedPayloads = ['aha', 'take me on'];
    const expectedPayloadCount = expectedPayloads.length;

    beforeEach(() => {
        unmarshaller = new InputUnmarshaller(0, {objectMode: true});
        zeroIndexedInputs = newFixedSource([
            newInputSignal(newInputFrame(0, 'text/plain', expectedPayloads[0])),
            newInputSignal(newInputFrame(0, 'text/plain', expectedPayloads[1])),
        ]);
        nonZeroIndexedInputs = newFixedSource([
            newInputSignal(newInputFrame(2, 'text/plain', expectedPayloads[0])),
            newInputSignal(newInputFrame(3, 'text/plain', expectedPayloads[1])),
        ]);
        unsupportedInputs = newFixedSource([
            newInputSignal(newInputFrame(0, 'application/x-doom', expectedPayloads[0]))
        ]);
    });

    afterEach(() => {
        zeroIndexedInputs.destroy();
        nonZeroIndexedInputs.destroy();
        unsupportedInputs.destroy();
        unmarshaller.destroy();
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

        zeroIndexedInputs.pipe(unmarshaller);
    });

    it('discards the received input signals whose index are not matching', (done) => {
        unmarshaller.on('data', () => {
            done(new Error(`should not consume any elements`));
        });
        unmarshaller.on('end', () => {
            done();
        });

        nonZeroIndexedInputs.pipe(unmarshaller);
    });

    it('fails unmarshalling inputs with unsupported content-type', (done) => {
        unmarshaller.on('data', () => {
            done(new Error(`should not consume any elements`));
        });
        unmarshaller.on('error', (err) => {
            expect(err.type).toEqual('error-streaming-input-content-type-unsupported');
            expect(err.cause).toEqual('unsupported input #0\'s content-type application/x-doom');
            done();
        });

        unsupportedInputs.pipe(unmarshaller);
    });
});
