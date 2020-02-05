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
const grpc = require('grpc');

describe('streaming pipeline =>', () => {
    const textEncoder = new TextEncoder();
    let destinationStream;
    let streamingPipeline;
    let fixedSource;

    beforeEach(() => {
        destinationStream = new PassThrough({objectMode: true});
        destinationStream.call = {};
        destinationStream.call.cancelWithStatus = jasmine.createSpy('cancelWithStatus');
    });

    afterEach(() => {
        destinationStream.destroy();
        destinationStream.call.cancelWithStatus.calls.reset();
    });

    describe('with a reliable function =>', () => {
        const userFunction = (inputStreams, outputStreams) => {
            const inputStream = inputStreams.$order[0];
            const outputStream = outputStreams.$order[0];
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

        describe('with malformed input signals =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource(["not a signal"]);
            });

            it('cancels the invocation', (done) => {
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-invalid-input-signal');
                    expect(err.cause).toEqual('Invalid input signal type [object String]');
                    expect(destinationStream.call.cancelWithStatus).toHaveBeenCalledWith(
                        grpc.status.UNKNOWN,
                        'Invoker: Protocol Violation: Invalid input signal type [object String]'
                    );
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            });
        });

        describe('with an incomplete input signal =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([newInputSignal(null)]);
            });

            it('cancels the invocation', (done) => {
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-invalid-input-signal');
                    expect(err.cause).toEqual('Input is neither a start nor a data signal');
                    expect(destinationStream.call.cancelWithStatus).toHaveBeenCalledWith(
                        grpc.status.UNKNOWN,
                        'Invoker: Protocol Violation: Input is neither a start nor a data signal'
                    );
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

            it('cancels the invocation', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-too-many-start-signals');
                    expect(err.cause).toEqual(
                        'Start signal has already been received. Rejecting start signal with: ' +
                        'output content types: [application/x-doom], input names: [input], output names: [output]'
                    );
                    expect(destinationStream.call.cancelWithStatus).toHaveBeenCalledWith(
                        grpc.status.UNKNOWN,
                        'Invoker: Protocol Violation: Start signal has already been received. Rejecting start signal ' +
                        'with: output content types: [application/x-doom], input names: [input], output names: [output]'
                    );
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

            it('cancels the invocation', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-invalid-output-count');
                    expect(err.cause).toEqual('Invalid output count 3: function has only 1 output(s)');
                    expect(destinationStream.call.cancelWithStatus).toHaveBeenCalledWith(
                        grpc.status.UNKNOWN,
                        "Invoker: Protocol Violation: Invalid output count 3: function has only 1 output(s)"
                    );
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

            it('cancels the invocation', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-missing-start-signal');
                    expect(err.cause).toEqual(
                        'Start signal has not been received or processed yet. Rejecting data signal'
                    );
                    expect(destinationStream.call.cancelWithStatus).toHaveBeenCalledWith(
                        grpc.status.UNKNOWN,
                        'Invoker: Protocol Violation: Start signal has not been received or processed yet. Rejecting data signal'
                    );
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            })
        });
    });

    describe('with an unsupported output MIME type =>', () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams.$order[0].pipe(outputStreams.$order[0]);
        };
        userFunction.$interactionModel = 'node-streams';

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/zglorbf'], ['in'], ['out'])),
                newInputSignal(newInputFrame(0, 'application/json', textEncoder.encode('42')))
            ]);
        });

        it('cancels the invocation', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-output-content-type-unsupported');
                expect(err.cause).toEqual(`Unsupported content-type 'text/zglorbf' for output #0`);
                expect(destinationStream.call.cancelWithStatus).toHaveBeenCalledWith(
                    grpc.status.INVALID_ARGUMENT,
                    `Invoker: Not Acceptable: Unsupported content-type 'text/zglorbf' for output #0`
                );
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with an unsupported input MIME type =>', () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams.$order[0].pipe(outputStreams.$order[0]);
        };
        userFunction.$interactionModel = 'node-streams';

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'], ['in'], ['out'])),
                newInputSignal(newInputFrame(0, 'application/jackson-five', textEncoder.encode('1234')))
            ]);
        });

        it('cancels the invocation', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-input-content-type-unsupported');
                expect(err.cause).toEqual(`Unsupported content-type 'application/jackson-five' for input #0`);
                expect(destinationStream.call.cancelWithStatus).toHaveBeenCalledWith(
                    grpc.status.INVALID_ARGUMENT,
                    `Invoker: Unsupported Media Type: Unsupported content-type 'application/jackson-five' for input #0`
                );
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with a function throwing at invocation time =>', () => {
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

        it('cancels the invocation', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('streaming-function-runtime-error');
                expect(err.cause.message).toEqual(`Cannot read property 'nope' of null`);
                expect(destinationStream.call.cancelWithStatus).toHaveBeenCalledWith(
                    grpc.status.UNKNOWN,
                    "Invoker: Unexpected Invocation Error: Cannot read property 'nope' of null"
                );
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with an unmarshallable input =>', () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams.$order[0].pipe(outputStreams.$order[0]);
        };
        userFunction.$interactionModel = 'node-streams';

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'], ['in'], ['out'])),
                newInputSignal(newInputFrame(0, 'application/json', textEncoder.encode('invalid-json')))
            ]);
        });

        it('emits the error', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-input-invalid');
                expect(err.cause.message).toEqual('Unexpected token i in JSON at position 0');
                expect(destinationStream.call.cancelWithStatus).toHaveBeenCalledWith(
                    grpc.status.UNKNOWN,
                    'Invoker: Unexpected Error: SyntaxError: Unexpected token i in JSON at position 0'
                );
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with a function throwing when receiving data =>', () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams.$order[0].pipe(new SimpleTransform({objectMode: true}, () => {
                throw new Error('Function failed')
            })).pipe(outputStreams.$order[0]);
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

        it('emits the error', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            streamingPipeline.on('error', (err) => {
                expect(err.message).toEqual('Function failed');
                expect(destinationStream.call.cancelWithStatus).toHaveBeenCalledWith(
                    grpc.status.UNKNOWN,
                    'Invoker: Unexpected Error: Function failed'
                );
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with a function producing unmarshallable outputs =>', () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams.$order[0].pipe(new SimpleTransform({objectMode: true}, (x) => Symbol(x)))
                .pipe(outputStreams.$order[0]);
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

        it('emits the error', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-output-invalid');
                expect(err.cause.message).toEqual('Cannot convert a Symbol value to a string');
                expect(destinationStream.call.cancelWithStatus).toHaveBeenCalledWith(
                    grpc.status.UNKNOWN,
                    'Invoker: Unexpected Error: TypeError: Cannot convert a Symbol value to a string'
                );
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

        it('emits an error', (done) => {
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

    describe('with a request-reply function =>', () => {

        it('throws an error when constructing', () => {
            const userFunction = () => 42;
            userFunction.$interactionModel = "request-reply";
            expect(() => new StreamingPipeline(userFunction, destinationStream, {objectMode: true}))
                .toThrow(new Error(`SteamingPipeline expects a function with "node-streams" interaction model, but was "request-reply" instead`));
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
