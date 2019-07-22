const {PassThrough} = require('stream');
const {
    newFixedSource,
    newInputFrame,
    newInputSignal,
    newOutputFrame,
    newOutputSignal,
    newStartFrame,
    newStartSignal
} = require('./helpers/factories');
const RiffFacade = require('../lib/interaction-models/streaming/riff-facade');

describe('riff facade =>', () => {

    const userFunction = (inputStream, outputStream) => {
        inputStream.on('data', (arg) => {
            outputStream.write(arg + 42);
        });
    };
    let destinationStream;
    let riffFacade;
    let fixedSource;

    beforeEach(() => {
        destinationStream = new PassThrough({objectMode: true});
        riffFacade = new RiffFacade(userFunction, destinationStream, {objectMode: true});
    });

    afterEach(() => {
        fixedSource.destroy();
        riffFacade.destroy();
        destinationStream.destroy();
    });

    describe('with valid inputs', () => {
        beforeEach(() => {
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'])),
                newInputSignal(newInputFrame(
                    0,
                    'application/json',
                    '"the ultimate answer to life the universe and everything is: "'
                ))
            ]);
        });

        it('invokes the function and send the outputs', (done) => {
            let outputReceived = false;
            riffFacade.on('error', (err) => {
                done(err);
            });
            destinationStream.on('data', (chunk) => {
                if (outputReceived) {
                    done(new Error(`expected only 1 output, but also received ${chunk}`));
                    return
                }
                outputReceived = true;
                expect(chunk).toEqual(
                    newOutputSignal(newOutputFrame(
                        0,
                        'text/plain',
                        'the ultimate answer to life the universe and everything is: 42'
                    ))
                );
                done();
            });
            fixedSource.pipe(riffFacade);
        });
    });

    describe('with badly-typed inputs =>', () => {
        beforeEach(() => {
            fixedSource = newFixedSource(["not a signal"]);
        });

        it('emits an error', (done) => {
            riffFacade.on('error', (err) => {
                expect(err.type).toEqual('error-streaming-input-type-invalid');
                expect(err.cause).toEqual('invalid input type [object String]');
                done();
            });
            fixedSource.pipe(riffFacade);
        });
    });

    describe('with a buggy input signal =>', () => {
        beforeEach(() => {
            fixedSource = newFixedSource([newInputSignal(null)]);
        });

        it('emits an error', (done) => {
            riffFacade.on('error', (err) => {
                expect(err.type).toEqual('error-streaming-input-type-unsupported');
                expect(err.cause).toEqual('input is neither a start nor a data signal');
                done();
            });
            fixedSource.pipe(riffFacade);
        });
    });

    describe('with too many start signals =>', () => {
        beforeEach(() => {
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'])),
                newStartSignal(newStartFrame(['application/x-doom']))
            ]);
        });

        it('emits an error', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            riffFacade.on('error', (err) => {
                expect(err.type).toEqual('error-streaming-too-many-starts');
                expect(err.cause).toEqual(
                    'start signal has already been received. ' +
                    'Rejecting new start signal with content types [application/x-doom]'
                );
                done();
            });
            fixedSource.pipe(riffFacade);
        })
    });

    describe('with a start signal with too many output content types =>', () => {
        beforeEach(() => {
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain', 'text/sgml', 'text/yaml']))
            ]);
        });

        it('emits an error', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            riffFacade.on('error', (err) => {
                expect(err.type).toEqual('error-streaming-invalid-output-count');
                expect(err.cause).toEqual(
                    'invalid output count 3: function has only 2 parameter(s)'
                );
                done();
            });
            fixedSource.pipe(riffFacade);
        })
    });

    describe('with no start signal to start with =>', () => {
        beforeEach(() => {
            fixedSource = newFixedSource([newInputSignal(
                newInputFrame(42, 'application/x-doom', '??'))
            ]);
        });

        it('emits an error', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            riffFacade.on('error', (err) => {
                expect(err.type).toEqual('error-streaming-missing-start');
                expect(err.cause).toEqual(
                    'start signal has not been received or processed yet. ' +
                    'Rejecting data signal'
                );
                done();
            });
            fixedSource.pipe(riffFacade);
        })
    });
});
