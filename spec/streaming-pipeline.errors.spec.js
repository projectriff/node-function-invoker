const StreamingPipeline = require('../lib/streaming-pipeline');
const {PassThrough, Transform} = require('stream');
const {
    newFixedSource,
    newInputFrame,
    newInputSignal,
    newMappingTransform,
    newStartFrame,
    newStartSignal
} = require('./helpers/factories');

describe('streaming pipeline =>', () => {
    let destinationStream;
    let streamingPipeline;
    let fixedSource;

    beforeEach(() => {
        destinationStream = new PassThrough({objectMode: true});
    });

    afterEach(() => {
        fixedSource.destroy();
        streamingPipeline.destroy();
        destinationStream.destroy();
    });

    describe('with a reliable function =>', () => {
        const userFunction = (inputStream, outputStream) => {
            inputStream.pipe(newMappingTransform((arg) => arg + 42)).pipe(outputStream);
        };

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
        });

        describe('with badly-typed inputs =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource(["not a signal"]);
            });

            // TODO: assert pipeline ends
            it('emits an error', (done) => {
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-input-type-invalid');
                    expect(err.cause).toEqual('invalid input type [object String]');
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            });
        });

        describe('with a buggy input signal =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([newInputSignal(null)]);
            });

            // TODO: assert pipeline ends
            it('emits an error', (done) => {
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-input-type-unsupported');
                    expect(err.cause).toEqual('input is neither a start nor a data signal');
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            });
        });

        describe('with too many start signals =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/plain'])),
                    newStartSignal(newStartFrame(['application/x-doom']))
                ]);
            });

            // TODO: assert pipeline ends
            it('emits an error', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-too-many-starts');
                    expect(err.cause).toEqual(
                        'start signal has already been received. ' +
                        'Rejecting new start signal with content types [application/x-doom]'
                    );
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            })
        });

        describe('with a start signal with too many output content types =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/plain', 'text/sgml', 'text/yaml']))
                ]);
            });

            // TODO: assert pipeline ends
            it('emits an error', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-invalid-output-count');
                    expect(err.cause).toEqual(
                        'invalid output count 3: function has only 2 parameter(s)'
                    );
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            })
        });

        describe('with no start signal to start with =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([newInputSignal(
                    newInputFrame(42, 'application/x-doom', '??'))
                ]);
            });

            // TODO: assert pipeline ends
            it('emits an error', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-missing-start');
                    expect(err.cause).toEqual(
                        'start signal has not been received or processed yet. ' +
                        'Rejecting data signal'
                    );
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            })
        });
    });

    describe('with a failing-at-invocation-time function =>', () => {
        const userFunction = (inputStream, outputStream) => {
            inputStream.pipe(outputStream);
            null.nope();
        };

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain']))
            ]);
        });

        // TODO: assert pipeline ends
        it('ends the pipeline', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('streaming-function-runtime-error');
                expect(err.cause.message).toEqual(`Cannot read property 'nope' of null`);
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with an input that cannot be unmarshalled =>', () => {
        const userFunction = (inputStream, outputStream) => {
            inputStream.pipe(outputStream);
        };

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'])),
                newInputSignal(newInputFrame(0, 'application/json', 'invalid-json'))
            ]);
        });

        it('ends the pipeline', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            let errored = false;
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-input-invalid');
                expect(err.cause.message).toEqual('Unexpected token i in JSON at position 0');
                errored = true;
            });
            streamingPipeline.on('finish', () => {
                expect(errored).toBeTruthy('pipeline should have errored');
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with a function that fails when receiving data =>', () => {
        const userFunction = (inputStream, outputStream) => {
            inputStream.pipe(new SimpleTransform({objectMode: true}, () => {
                throw new Error('Function failed')
            })).pipe(outputStream);
        };

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'])),
                newInputSignal(newInputFrame(0, 'application/json', '42'))
            ]);
        });

        it('ends the pipeline', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            let errored = false;
            streamingPipeline.on('error', (err) => {
                expect(err.message).toEqual('Function failed');
                errored = true;
            });
            streamingPipeline.on('finish', () => {
                expect(errored).toBeTruthy('pipeline should have errored');
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with a function producing outputs that cannot be marshalled =>', () => {
        const userFunction = (inputStream, outputStream) => {
            inputStream.pipe(new SimpleTransform({objectMode: true}, (x) => Symbol(x))).pipe(outputStream);
        };

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'])),
                newInputSignal(newInputFrame(0, 'application/json', '42'))
            ]);
        });

        it('ends the pipeline', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            let errored = false;
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-output-invalid');
                expect(err.cause.message).toEqual('Cannot convert a Symbol value to a string');
                errored = true;
            });
            streamingPipeline.on('finish', () => {
                expect(errored).toBeTruthy('pipeline should have errored');
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });
});

class SimpleTransform extends Transform {
    constructor(options, fn) {
        super(options);
        this.fn = fn;
    }

    _transform(chunk, _, callback) {
        callback(null, this.fn(chunk));
    }
}
