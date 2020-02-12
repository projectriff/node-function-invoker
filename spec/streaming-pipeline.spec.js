const { TextEncoder } = require("util");
const StreamingPipeline = require("../lib/streaming-pipeline");
const { PassThrough } = require("stream");
const {
    newFixedSource,
    newInputFrame,
    newInputSignal,
    newMappingTransform,
    newOutputFrame,
    newOutputSignal,
    newStartFrame,
    newStartSignal
} = require("./helpers/factories");

describe("streaming pipeline =>", () => {
    const textEncoder = new TextEncoder();
    let destinationStream;
    let streamingPipeline;
    let fixedSource;

    beforeEach(() => {
        destinationStream = new PassThrough({ objectMode: true });
    });

    afterEach(() => {
        fixedSource.destroy();
        streamingPipeline.destroy();
        destinationStream.destroy();
    });

    describe("with a reliable function =>", () => {
        const userFunction = (inputStreams, outputStreams) => {
            inputStreams["input1"]
                .pipe(newMappingTransform(arg => arg + 42))
                .pipe(outputStreams["output1"]);
        };
        userFunction.$interactionModel = "node-streams";

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(
                userFunction,
                destinationStream
            );
        });

        describe("with valid input signals =>", () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(
                        newStartFrame(["text/plain"], ["input1"], ["output1"])
                    ),
                    newInputSignal(
                        newInputFrame(
                            0,
                            "application/json",
                            textEncoder.encode(
                                '"the ultimate answer to life the universe and everything is: "'
                            )
                        )
                    )
                ]);
            });

            it("invokes the function and send the outputs", done => {
                streamingPipeline.on("error", err => {
                    done(err);
                });
                let dataReceived = false;
                destinationStream.on("data", chunk => {
                    expect(dataReceived).toBeFalsy(
                        "expected to receive data only once"
                    );
                    expect(chunk).toEqual(
                        newOutputSignal(
                            newOutputFrame(
                                0,
                                "text/plain",
                                textEncoder.encode(
                                    "the ultimate answer to life the universe and everything is: 42"
                                )
                            )
                        )
                    );
                    dataReceived = true;
                });
                destinationStream.on("finish", () => {
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            });
        });

        describe("with a closed input stream =>", () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame([], ["ignored"], []))
                ]);
            });

            // when the source ends (such as an internal call like `this.push(null)`), the piped destination will have its 'end' method called
            // see https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
            it("will end input streams when the piped source ends", done => {
                let inputEnded = false;
                const userFunction = inputStreams => {
                    inputStreams.$order[0].on("end", () => {
                        inputEnded = true;
                    });
                };
                userFunction.$interactionModel = "node-streams";

                streamingPipeline = new StreamingPipeline(
                    userFunction,
                    destinationStream
                );
                streamingPipeline.on("finish", () => {
                    expect(inputEnded).toBeTruthy(
                        "input stream should have been ended"
                    );
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            });
        });

        describe("with an immediately closing output stream =>", () => {
            const data = ["1", "4", "9"];
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(
                        newStartFrame(
                            ["text/plain", "text/plain"],
                            ["input"],
                            ["output1", "output2"]
                        )
                    ),
                    ...data.map(payload =>
                        newInputSignal(
                            newInputFrame(
                                0,
                                "text/plain",
                                textEncoder.encode(payload)
                            )
                        )
                    )
                ]);
            });

            it("the other output stream can still emit to the destination stream", done => {
                const userFunction = (inputStreams, outputStreams) => {
                    outputStreams.$order[0].end();
                    inputStreams["input"].pipe(outputStreams["output2"]);
                };
                userFunction.$interactionModel = "node-streams";

                let receivedOutputSignalCount = 0;
                destinationStream.on("data", outputSignal => {
                    expect(receivedOutputSignalCount).toBeLessThan(
                        data.length,
                        `expected to see only ${
                            data.length
                        }, already seen ${receivedOutputSignalCount + 1}th`
                    );
                    expect(outputSignal).toEqual(
                        newOutputSignal(
                            newOutputFrame(
                                1,
                                "text/plain",
                                textEncoder.encode(
                                    data[receivedOutputSignalCount]
                                )
                            )
                        )
                    );
                    receivedOutputSignalCount++;
                });
                destinationStream.on("finish", () => {
                    expect(receivedOutputSignalCount).toEqual(
                        data.length,
                        `expected to see only ${data.length}, seen ${receivedOutputSignalCount}`
                    );
                    done();
                });
                streamingPipeline = new StreamingPipeline(
                    userFunction,
                    destinationStream
                );
                fixedSource.pipe(streamingPipeline);
            });
        });
    });
});
