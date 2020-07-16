const { TextEncoder } = require("util");
const StreamingPipeline = require("../lib/streaming-pipeline");
const { finished, PassThrough, Readable, Transform } = require("stream");
const {
    newInputFrame,
    newInputSignal,
    newMappingTransform,
    newStartFrame,
    newStartSignal,
} = require("./helpers/factories");
const grpc = require("@grpc/grpc-js");

describe("streaming pipeline =>", () => {
    const textEncoder = new TextEncoder();
    let destinationStream;
    let streamingPipeline;
    let fixedSource;

    beforeEach(() => {
        destinationStream = new PassThrough({ objectMode: true });
        destinationStream.call = {};
        destinationStream.call.sendError = jasmine.createSpy("sendError");
    });

    afterEach(() => {
        destinationStream.destroy();
        destinationStream.call.sendError.calls.reset();
    });

    describe("with a reliable function =>", () => {
        const userFunction = (inputStreams, outputStreams) => {
            const inputStream = inputStreams.$order[0];
            const outputStream = outputStreams.$order[0];
            inputStream
                .pipe(newMappingTransform((arg) => arg + 42))
                .pipe(outputStream);
        };
        userFunction.$interactionModel = "node-streams";

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(
                userFunction,
                destinationStream
            );
        });

        afterEach(() => {
            fixedSource.destroy();
            streamingPipeline.destroy();
        });

        describe("with malformed input signals =>", () => {
            beforeEach(() => {
                fixedSource = Readable.from(["not a signal"]);
            });

            it("cancels the invocation", (done) => {
                destinationStream.on("data", () => {
                    done(new Error("should not receive any data"));
                });
                let destinationErrored = false;
                destinationStream.on("error", (err) => {
                    destinationErrored = true;
                    expect(err).toEqual({
                        code: grpc.status.UNKNOWN,
                        details:
                            "Invoker: Protocol Violation: Invalid input signal type [object String]",
                    });
                });
                finished(streamingPipeline, (err) => {
                    expect(err.type).toEqual(
                        "error-streaming-invalid-input-signal"
                    );
                    expect(err.cause).toEqual(
                        "Invalid input signal type [object String]"
                    );
                    expect(destinationErrored).toBeTruthy(
                        "destination stream should emit propagated error"
                    );
                    done();
                });
                fixedSource.pipe(streamingPipeline, { end: false });
            });
        });

        describe("with an incomplete input signal =>", () => {
            beforeEach(() => {
                fixedSource = Readable.from([newInputSignal(null)]);
            });

            it("cancels the invocation", (done) => {
                destinationStream.on("data", () => {
                    done(new Error("should not receive any data"));
                });
                let destinationErrored = false;
                destinationStream.on("error", (err) => {
                    destinationErrored = true;
                    expect(err).toEqual({
                        code: grpc.status.UNKNOWN,
                        details:
                            "Invoker: Protocol Violation: Input is neither a start nor a data signal",
                    });
                });
                finished(streamingPipeline, (err) => {
                    expect(err.type).toEqual(
                        "error-streaming-invalid-input-signal"
                    );
                    expect(err.cause).toEqual(
                        "Input is neither a start nor a data signal"
                    );
                    expect(destinationErrored).toBeTruthy(
                        "destination stream should emit propagated error"
                    );
                    done();
                });
                fixedSource.pipe(streamingPipeline, { end: false });
            });
        });

        describe("with too many start signals =>", () => {
            beforeEach(() => {
                fixedSource = Readable.from([
                    newStartSignal(
                        newStartFrame(["text/plain"], ["input"], ["output"])
                    ),
                    newStartSignal(
                        newStartFrame(
                            ["application/x-doom"],
                            ["input"],
                            ["output"]
                        )
                    ),
                ]);
            });

            it("cancels the invocation", (done) => {
                destinationStream.on("data", () => {
                    done(new Error("should not receive any data"));
                });

                let destinationErrored = false;
                destinationStream.on("error", (err) => {
                    destinationErrored = true;
                    expect(err).toEqual({
                        code: grpc.status.UNKNOWN,
                        details:
                            "Invoker: Protocol Violation: Start signal has already been received. Rejecting start signal " +
                            "with: output content types: [application/x-doom], input names: [input], output names: [output]",
                    });
                });
                finished(streamingPipeline, (err) => {
                    expect(err.type).toEqual(
                        "error-streaming-too-many-start-signals"
                    );
                    expect(err.cause).toEqual(
                        "Start signal has already been received. Rejecting start signal with: " +
                            "output content types: [application/x-doom], input names: [input], output names: [output]"
                    );
                    expect(destinationErrored).toBeTruthy(
                        "destination stream should emit propagated error"
                    );
                    done();
                });
                fixedSource.pipe(streamingPipeline, { end: false });
            });
        });

        describe("with a start signal with too many output content types =>", () => {
            beforeEach(() => {
                fixedSource = Readable.from([
                    newStartSignal(
                        newStartFrame(
                            ["text/plain", "text/sgml", "text/yaml"],
                            ["input"],
                            ["output"]
                        )
                    ),
                ]);
            });

            it("cancels the invocation", (done) => {
                destinationStream.on("data", () => {
                    done(new Error("should not receive any data"));
                });
                let destinationErrored = false;
                destinationStream.on("error", (err) => {
                    destinationErrored = true;
                    expect(err).toEqual({
                        code: grpc.status.UNKNOWN,
                        details:
                            "Invoker: Protocol Violation: Invalid output count 3: function has only 1 output(s)",
                    });
                });
                finished(streamingPipeline, (err) => {
                    expect(err.type).toEqual(
                        "error-streaming-invalid-output-count"
                    );
                    expect(err.cause).toEqual(
                        "Invalid output count 3: function has only 1 output(s)"
                    );
                    expect(destinationErrored).toBeTruthy(
                        "destination stream should emit propagated error"
                    );
                    done();
                });
                fixedSource.pipe(streamingPipeline, { end: false });
            });
        });

        describe("with no start signal to start with =>", () => {
            beforeEach(() => {
                fixedSource = Readable.from([
                    newInputSignal(
                        newInputFrame(
                            42,
                            "application/x-doom",
                            textEncoder.encode("??")
                        )
                    ),
                ]);
            });

            it("cancels the invocation", (done) => {
                destinationStream.on("data", () => {
                    done(new Error("should not receive any data"));
                });
                let destinationErrored = false;
                destinationStream.on("error", (err) => {
                    destinationErrored = true;
                    expect(err).toEqual({
                        code: grpc.status.UNKNOWN,
                        details:
                            "Invoker: Protocol Violation: Start signal has not been received or processed yet. Rejecting data signal",
                    });
                });
                finished(streamingPipeline, (err) => {
                    expect(err.type).toEqual(
                        "error-streaming-missing-start-signal"
                    );
                    expect(err.cause).toEqual(
                        "Start signal has not been received or processed yet. Rejecting data signal"
                    );
                    expect(destinationErrored).toBeTruthy(
                        "destination stream should emit propagated error"
                    );
                    done();
                });
                fixedSource.pipe(streamingPipeline, { end: false });
            });
        });
    });

    describe("with an unsupported output MIME type =>", () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams.$order[0].pipe(outputStreams.$order[0]);
        };
        userFunction.$interactionModel = "node-streams";

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(
                userFunction,
                destinationStream
            );
            fixedSource = Readable.from([
                newStartSignal(
                    newStartFrame(["text/zglorbf"], ["in"], ["out"])
                ),
                newInputSignal(
                    newInputFrame(
                        0,
                        "application/json",
                        textEncoder.encode("42")
                    )
                ),
            ]);
        });

        it("cancels the invocation", (done) => {
            destinationStream.on("data", () => {
                done(new Error("should not receive any data"));
            });
            let destinationErrored = false;
            destinationStream.on("error", (err) => {
                destinationErrored = true;
                expect(err).toEqual({
                    code: grpc.status.INVALID_ARGUMENT,
                    details: `Invoker: Not Acceptable: Unsupported content-type 'text/zglorbf' for output #0`,
                });
            });
            finished(streamingPipeline, (err) => {
                expect(err.type).toEqual(
                    "error-output-content-type-unsupported"
                );
                expect(err.cause).toEqual(
                    `Unsupported content-type 'text/zglorbf' for output #0`
                );
                expect(destinationErrored).toBeTruthy(
                    "destination stream should emit propagated error"
                );
                done();
            });
            fixedSource.pipe(streamingPipeline, { end: false });
        });
    });

    describe("with an unsupported input MIME type =>", () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams.$order[0].pipe(outputStreams.$order[0]);
        };
        userFunction.$interactionModel = "node-streams";

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(
                userFunction,
                destinationStream
            );
            fixedSource = Readable.from([
                newStartSignal(newStartFrame(["text/plain"], ["in"], ["out"])),
                newInputSignal(
                    newInputFrame(
                        0,
                        "application/jackson-five",
                        textEncoder.encode("1234")
                    )
                ),
            ]);
        });

        it("cancels the invocation", (done) => {
            destinationStream.on("data", () => {
                done(new Error("should not receive any data"));
            });
            let destinationErrored = false;
            destinationStream.on("error", (err) => {
                destinationErrored = true;
                expect(err).toEqual({
                    code: grpc.status.INVALID_ARGUMENT,
                    details: `Invoker: Unsupported Media Type: Unsupported content-type 'application/jackson-five' for input #0`,
                });
            });
            finished(streamingPipeline, (err) => {
                expect(err.type).toEqual(
                    "error-input-content-type-unsupported"
                );
                expect(err.cause).toEqual(
                    `Unsupported content-type 'application/jackson-five' for input #0`
                );
                expect(destinationErrored).toBeTruthy(
                    "destination stream should emit propagated error"
                );
                done();
            });
            fixedSource.pipe(streamingPipeline, { end: false });
        });
    });

    describe("with a function throwing at invocation time =>", () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams["in"].pipe(outputStreams["out"]);
            null.nope();
        };
        userFunction.$interactionModel = "node-streams";

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(
                userFunction,
                destinationStream
            );
            fixedSource = Readable.from([
                newStartSignal(newStartFrame(["text/plain"], ["in"], ["out"])),
            ]);
        });

        afterEach(() => {
            fixedSource.destroy();
            streamingPipeline.destroy();
        });

        it("cancels the invocation", (done) => {
            destinationStream.on("data", () => {
                done(new Error("should not receive any data"));
            });
            let destinationErrored = false;
            destinationStream.on("error", (err) => {
                destinationErrored = true;
                expect(err).toEqual({
                    code: grpc.status.UNKNOWN,
                    details:
                        "Invoker: Unexpected Invocation Error: Cannot read property 'nope' of null",
                });
            });
            finished(streamingPipeline, (err) => {
                expect(err.type).toEqual("streaming-function-runtime-error");
                expect(err.cause.message).toEqual(
                    `Cannot read property 'nope' of null`
                );
                expect(destinationErrored).toBeTruthy(
                    "destination stream should emit propagated error"
                );
                done();
            });
            fixedSource.pipe(streamingPipeline, { end: false });
        });
    });

    describe("with an unmarshallable input =>", () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams.$order[0].pipe(outputStreams.$order[0]);
        };
        userFunction.$interactionModel = "node-streams";

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(
                userFunction,
                destinationStream
            );
            fixedSource = Readable.from([
                newStartSignal(newStartFrame(["text/plain"], ["in"], ["out"])),
                newInputSignal(
                    newInputFrame(
                        0,
                        "application/json",
                        textEncoder.encode("invalid-json")
                    )
                ),
            ]);
        });

        it("emits the error", (done) => {
            destinationStream.on("data", () => {
                done(new Error("should not receive any data"));
            });
            let destinationErrored = false;
            destinationStream.on("error", (err) => {
                destinationErrored = true;
                expect(err).toEqual({
                    code: grpc.status.INVALID_ARGUMENT,
                    details:
                        "Invoker: Bad Request: SyntaxError: Unexpected token i in JSON at position 0",
                });
            });
            finished(streamingPipeline, (err) => {
                expect(err.type).toEqual("error-input-invalid");
                expect(err.cause.message).toEqual(
                    "Unexpected token i in JSON at position 0"
                );
                expect(destinationErrored).toBeTruthy(
                    "destination stream should emit propagated error"
                );
                done();
            });
            fixedSource.pipe(streamingPipeline, { end: false });
        });
    });

    describe("with a function throwing when receiving data =>", () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams.$order[0]
                .pipe(
                    new SimpleTransform(() => {
                        throw new Error("Function failed");
                    })
                )
                .pipe(outputStreams.$order[0]);
        };
        userFunction.$interactionModel = "node-streams";

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(
                userFunction,
                destinationStream
            );
            fixedSource = Readable.from([
                newStartSignal(newStartFrame(["text/plain"], ["in"], ["out"])),
                newInputSignal(
                    newInputFrame(
                        0,
                        "application/json",
                        textEncoder.encode("42")
                    )
                ),
            ]);
        });

        afterEach(() => {
            fixedSource.destroy();
            streamingPipeline.destroy();
        });

        it("emits the error", (done) => {
            destinationStream.on("data", () => {
                done(new Error("should not receive any data"));
            });
            let destinationErrored = false;
            destinationStream.on("error", (err) => {
                destinationErrored = true;
                expect(err).toEqual({
                    code: grpc.status.UNKNOWN,
                    details: "Invoker: Unexpected Error: Function failed",
                });
            });
            finished(streamingPipeline, (err) => {
                expect(err.message).toEqual("Function failed");
                expect(destinationErrored).toBeTruthy(
                    "destination stream should emit propagated error"
                );
                done();
            });
            fixedSource.pipe(streamingPipeline, { end: false });
        });
    });

    describe("with a function producing unmarshallable outputs =>", () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams.$order[0]
                .pipe(new SimpleTransform((x) => Symbol(x)))
                .pipe(outputStreams.$order[0]);
        };
        userFunction.$interactionModel = "node-streams";

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(
                userFunction,
                destinationStream
            );
            fixedSource = Readable.from([
                newStartSignal(newStartFrame(["text/plain"], ["in"], ["out"])),
                newInputSignal(
                    newInputFrame(
                        0,
                        "application/json",
                        textEncoder.encode("42")
                    )
                ),
            ]);
        });

        afterEach(() => {
            fixedSource.destroy();
            streamingPipeline.destroy();
        });

        it("emits the error", (done) => {
            destinationStream.on("data", () => {
                done(new Error("should not receive any data"));
            });
            let destinationErrored = false;
            destinationStream.on("error", (err) => {
                destinationErrored = true;
                expect(err).toEqual({
                    code: grpc.status.UNKNOWN,
                    details:
                        "Invoker: Unexpected Error: TypeError: Cannot convert a Symbol value to a string",
                });
            });
            finished(streamingPipeline, (err) => {
                expect(err.type).toEqual("error-output-invalid");
                expect(err.cause.message).toEqual(
                    "Cannot convert a Symbol value to a string"
                );
                expect(destinationErrored).toBeTruthy(
                    "destination stream should emit propagated error"
                );
                done();
            });
            fixedSource.pipe(streamingPipeline, { end: false });
        });
    });

    describe("with a request-reply function =>", () => {
        it("throws an error when constructing", () => {
            const userFunction = () => 42;
            userFunction.$interactionModel = "request-reply";
            expect(
                () => new StreamingPipeline(userFunction, destinationStream)
            ).toThrow(
                new Error(
                    `SteamingPipeline expects a function with "node-streams" interaction model, but was "request-reply" instead`
                )
            );
        });
    });

    describe("with an $argumentType set => ", () => {
        it("throws an error when constructing", () => {
            const userFunction = () => 42;
            userFunction.$interactionModel = "node-streams";
            userFunction.$argumentType = "payload";
            expect(
                () => new StreamingPipeline(userFunction, destinationStream)
            ).toThrow(
                new Error(
                    `Streaming functions cannot be configured with $argumentType`
                )
            );
        });
    });
});

class SimpleTransform extends Transform {
    constructor(fn) {
        super({ objectMode: true });
        this.fn = fn;
    }

    _transform(chunk, _, callback) {
        callback(null, this.fn(chunk));
    }
}
