const {newFixedSource, newInputFrame, newInputSignal} = require('./helpers/factories');
const InputUnmarshaller = require('../lib/input-unmarshaller');

describe('input unmarshaller =>', () => {
    let unmarshaller;
    let unsupportedInputs;
    let invalidInputs;

    beforeEach(() => {
        unmarshaller = new InputUnmarshaller({objectMode: true});
        unsupportedInputs = newFixedSource([
            newInputSignal(newInputFrame(0, 'application/x-doom', '???'))
        ]);
        invalidInputs = newFixedSource([
            newInputSignal(newInputFrame(0, 'application/json', 'invalid JSON'))
        ]);
    });

    afterEach(() => {
        unsupportedInputs.destroy();
        invalidInputs.destroy();
        unmarshaller.destroy();
    });

    it('emits an error when unmarshalling inputs with unsupported content-type', (done) => {
        unmarshaller.on('data', () => {
            done(new Error(`should not consume any elements`));
        });
        unmarshaller.on('error', (err) => {
            expect(err.type).toEqual('error-input-content-type-unsupported');
            expect(err.cause).toEqual('unsupported input #0\'s content-type application/x-doom');
            done();
        });

        unsupportedInputs.pipe(unmarshaller);
    });

    it('emits an error when unmarshalling invalid inputs', (done) => {
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
