const {TextEncoder} = require('util');
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
    const textEncoder = new TextEncoder();
    let destinationStream;
    let streamingPipeline;
    let fixedSource;

    beforeEach(() => {
        destinationStream = new PassThrough({objectMode: true});
    });

    afterEach(() => {
        destinationStream.destroy();
    });

    describe('with a reliable function =>', () => {
        const userFunction = (inputStreams, outputStreams) => {
            const inputStream = inputStreams["0"];
            const outputStream = outputStreams["0"];
            inputStream.pipe(newMappingTransform((arg) => arg + 42)).pipe(outputStream);
        };
        userFunction.$interactionModel = 'node-streams';

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
        });

        afterEach(() => {
            fixedSource.destroy();
            streamingPipeline.destroy();
        });

        describe('with badly-typed inputs =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource(["not a signal"]);
            });

            it('emits an error', (done) => {
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-input-invalid');
                    expect(err.cause).toEqual('invalid input type [object String]');
                });
                streamingPipeline.on('finish', () => {
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            });
        });

        describe('with a buggy input signal =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([newInputSignal(null)]);
            });

            it('emits an error', (done) => {
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-input-invalid');
                    expect(err.cause).toEqual('input is neither a start nor a data signal');
                });
                streamingPipeline.on('finish', () => {
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            });
        });

        describe('with too many start signals =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/plain'], ['input'], ['output'])),
                    newStartSignal(newStartFrame(['application/x-doom'], ['input'], ['output']))
                ]);
            });

            it('emits an error', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-too-many-starts');
                    expect(err.cause).toEqual(
                        'start signal has already been received. ' +
                        'Rejecting start signal with: ' +
                        'output content types: [application/x-doom], ' +
                        'input names: [input], ' +
                        'output names: [output]'
                    );
                });
                streamingPipeline.on('finish', () => {
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            })
        });

        describe('with a start signal with too many output content types =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(
                        ['text/plain', 'text/sgml', 'text/yaml'], ['input'], ['output']))
                ]);
            });

            it('emits an error', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-invalid-output-count');
                    expect(err.cause).toEqual(
                        'invalid output count 3: function has only 1 output(s)'
                    );
                });
                streamingPipeline.on('finish', () => {
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            })
        });

        describe('with no start signal to start with =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([newInputSignal(
                    newInputFrame(42, 'application/x-doom', textEncoder.encode('??')))
                ]);
            });

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
                });
                streamingPipeline.on('finish', () => {
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            })
        });
    });

    describe('with a failing-at-invocation-time function =>', () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams["in"].pipe(outputStreams["out"]);
            null.nope();
        };
        userFunction.$interactionModel = 'node-streams';

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'], ['in'], ['out']))
            ]);
        });

        afterEach(() => {
            fixedSource.destroy();
            streamingPipeline.destroy();
        });

        it('ends the pipeline', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('streaming-function-runtime-error');
                expect(err.cause.message).toEqual(`Cannot read property 'nope' of null`);
            });
            streamingPipeline.on('finish', () => {
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with an input that cannot be unmarshalled =>', () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams["0"].pipe(outputStreams["0"]);
        };
        userFunction.$interactionModel = 'node-streams';

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'], ['in'], ['out'])),
                newInputSignal(newInputFrame(0, 'application/json', textEncoder.encode('invalid-json')))
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
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams["0"].pipe(new SimpleTransform({objectMode: true}, () => {
                throw new Error('Function failed')
            })).pipe(outputStreams["0"]);
        };
        userFunction.$interactionModel = 'node-streams';

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'], ['in'], ['out'])),
                newInputSignal(newInputFrame(0, 'application/json', textEncoder.encode('42')))
            ]);
        });

        afterEach(() => {
            fixedSource.destroy();
            streamingPipeline.destroy();
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
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams["0"].pipe(new SimpleTransform({objectMode: true}, (x) => Symbol(x))).pipe(outputStreams["0"]);
        };
        userFunction.$interactionModel = 'node-streams';

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'], ['in'], ['out'])),
                newInputSignal(newInputFrame(0, 'application/json', textEncoder.encode('42')))
            ]);
        });

        afterEach(() => {
            fixedSource.destroy();
            streamingPipeline.destroy();
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

    describe('with a function with incorrect argument transformers =>', () => {
        it('rejects the function with an invalid declaration of transformers ', () => {
            try {
                const userFunction = require('./helpers/transformers/invalid-argument-transformers-streaming-function');
                new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
                fail('should fail');
            } catch (err) {
                expect(err.type).toEqual('error-argument-transformer');
                expect(err.cause).toEqual('Argument transformers must be declared in an array. Found: string')
            }
        });

        it('rejects the function with an invalid transformer ', () => {
            try {
                const userFunction = require('./helpers/transformers/invalid-argument-transformer-streaming-function');
                new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
                fail('should fail');
            } catch (err) {
                expect(err.type).toEqual('error-argument-transformer');
                expect(err.cause).toEqual('Argument transformer #2 must be a function. Found: number')
            }
        });

        it('rejects the function with a transformer with a wrong arity', () => {
            try {
                const userFunction = require('./helpers/transformers/wrong-arity-argument-transformers-streaming-function');
                new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
                fail('should fail');
            } catch (err) {
                expect(err.type).toEqual('error-argument-transformer');
                expect(err.cause).toEqual('Argument transformer #2 must be a single-parameter function. Found: 0 parameter(s)')
            }
        });
    });

    describe('with an invalid count of argument transformers =>', () => {
        const userFunction = require('./helpers/transformers/invalid-argument-transformer-count-streaming-function');

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'], ['in1', 'in2'], ['out']))
            ]);
        });

        afterEach(() => {
            fixedSource.destroy();
            streamingPipeline.destroy();
        });

        it('ends the pipeline', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-argument-transformer');
                expect(err.cause).toEqual('Function must declare exactly 2 argument transformer(s). Found 1');
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with a request-reply function', () => {
        it('throws an error when constructing', () => {
            const userFunction = () => 42;
            userFunction.$interactionModel = "request-reply";
            userFunction.$arity = 1;
            const construct = () => new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            expect(construct).toThrow(new Error(`SteamingPipeline expects a function with "node-streams" interaction model, but was "request-reply" instead`));
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
