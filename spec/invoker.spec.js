const { TextEncoder } = require("util");
const tryStartInvoker = require("./helpers/try-start-invoker");
const outputSignalCustomEqual = require("./helpers/output-signal-custom-equality");
const newClient = require("./helpers/grpc-client");
const {
    newInputFrame,
    newInputSignal,
    newOutputFrame,
    newOutputSignal,
    newStartFrame,
    newStartSignal,
} = require("./helpers/factories");
const DeferredPromiseWrapper = require("./helpers/deferred-promise");

describe("invoker =>", () => {
    const textEncoder = new TextEncoder();
    let shutdownTrigger;
    let shutdownPromise;
    let client;

    beforeEach(() => {
        shutdownTrigger = new DeferredPromiseWrapper();
    });

    [
        {
            interactionType: "streaming",
            functionUri: "../spec/helpers/functions/streaming-square.js",
        },
        {
            interactionType: "request-reply",
            functionUri: "../spec/helpers/functions/request-reply-square.js",
        },
    ].forEach((testCase) => {
        describe(`with a ${testCase.interactionType} square function =>`, () => {
            beforeEach(async () => {
                jasmine.addCustomEqualityTester(outputSignalCustomEqual);
                const {
                    address,
                    shutdownPromise: shutdown,
                } = await tryStartInvoker(
                    testCase.functionUri,
                    shutdownTrigger.getPromise()
                );
                shutdownPromise = shutdown;
                client = newClient(address);
            });

            it("successfully invokes the function", (done) => {
                const inputs = [
                    newStartSignal(
                        newStartFrame(
                            ["application/json"],
                            ["numbers"],
                            ["squares"]
                        )
                    ),
                    newInputSignal(
                        newInputFrame(
                            0,
                            "application/json",
                            textEncoder.encode("2")
                        )
                    ),
                    newInputSignal(
                        newInputFrame(
                            0,
                            "application/json",
                            textEncoder.encode("3")
                        )
                    ),
                ];
                const expectedOutputs = [
                    newOutputSignal(
                        newOutputFrame(
                            0,
                            "application/json",
                            textEncoder.encode("4")
                        )
                    ),
                    newOutputSignal(
                        newOutputFrame(
                            0,
                            "application/json",
                            textEncoder.encode("9")
                        )
                    ),
                ];
                const expectedOutputCount = expectedOutputs.length;

                const call = client.invoke();

                let seenOutputIndex = 0;
                call.on("data", (outputSignal) => {
                    expect(seenOutputIndex).toBeLessThan(
                        expectedOutputCount,
                        `expected only ${expectedOutputCount} elements, received at least ${seenOutputIndex}`
                    );
                    expect(outputSignal).toEqual(
                        expectedOutputs[seenOutputIndex++]
                    );
                });
                call.on("end", () => {
                    expect(seenOutputIndex).toEqual(
                        expectedOutputs.length,
                        `expected to receive exactly ${expectedOutputCount}, received ${seenOutputIndex}`
                    );
                    done();
                });

                inputs.forEach((input) => {
                    call.write(input);
                });
                call.end();
            });
        });
    });

    describe("with an async request-reply cube function =>", () => {
        beforeEach(async () => {
            jasmine.addCustomEqualityTester(outputSignalCustomEqual);
            const {
                address,
                shutdownPromise: shutdown,
            } = await tryStartInvoker(
                "../spec/helpers/functions/request-reply-async-cube.js",
                shutdownTrigger.getPromise()
            );
            client = newClient(address);
            shutdownPromise = shutdown;
        });

        it("successfully invokes the function", (done) => {
            const inputs = [
                newStartSignal(
                    newStartFrame(["application/json"], ["numbers"], ["cubes"])
                ),
                newInputSignal(
                    newInputFrame(0, "text/plain", textEncoder.encode("2"))
                ),
                newInputSignal(
                    newInputFrame(0, "text/plain", textEncoder.encode("3"))
                ),
            ];
            const expectedOutputs = [
                newOutputSignal(
                    newOutputFrame(
                        0,
                        "application/json",
                        textEncoder.encode("8")
                    )
                ),
                newOutputSignal(
                    newOutputFrame(
                        0,
                        "application/json",
                        textEncoder.encode("27")
                    )
                ),
            ];
            const expectedOutputCount = expectedOutputs.length;

            const call = client.invoke();

            let seenOutputIndex = 0;
            call.on("data", (outputSignal) => {
                expect(seenOutputIndex).toBeLessThan(
                    expectedOutputCount,
                    `expected only ${expectedOutputCount} elements, received at least ${seenOutputIndex}`
                );
                expect(outputSignal).toEqual(
                    expectedOutputs[seenOutputIndex++]
                );
            });
            call.on("end", () => {
                expect(seenOutputIndex).toEqual(
                    expectedOutputs.length,
                    `expected to receive exactly ${expectedOutputCount}, received ${seenOutputIndex}`
                );
                done();
            });

            inputs.forEach((input) => {
                call.write(input);
            });
            call.end();
        });
    });

    describe("with a request-reply function =>", () => {
        beforeEach(async () => {
            jasmine.addCustomEqualityTester(outputSignalCustomEqual);
            const {
                address,
                shutdownPromise: shutdown,
            } = await tryStartInvoker(
                "../spec/helpers/functions/request-reply-async-cube.js",
                shutdownTrigger.getPromise()
            );
            client = newClient(address);
            shutdownPromise = shutdown;
        });

        it("successfully invokes the function several times", (done) => {
            const inputs = [
                newStartSignal(
                    newStartFrame(["application/json"], ["numbers"], ["cubes"])
                ),
                newInputSignal(
                    newInputFrame(0, "text/plain", textEncoder.encode("2"))
                ),
            ];
            const expectedOutputs = [
                newOutputSignal(
                    newOutputFrame(
                        0,
                        "application/json",
                        textEncoder.encode("8")
                    )
                ),
            ];
            const expectedOutputCount = expectedOutputs.length;

            [1, 2].forEach((callNumber) => {
                const call = client.invoke();

                let seenOutputIndex = 0;
                call.on("data", (outputSignal) => {
                    expect(seenOutputIndex).toBeLessThan(
                        expectedOutputCount,
                        `[call #${callNumber}] expected only ${expectedOutputCount} elements, received at least ${seenOutputIndex}`
                    );
                    expect(outputSignal).toEqual(
                        expectedOutputs[seenOutputIndex++]
                    );
                });
                call.on("end", () => {
                    expect(seenOutputIndex).toEqual(
                        expectedOutputs.length,
                        `[call #${callNumber}] expected to receive exactly ${expectedOutputCount}, received ${seenOutputIndex}`
                    );
                    done();
                });

                inputs.forEach((input) => {
                    call.write(input);
                });
                call.end();
            });
        });
    });

    describe("with a function implementing hooks =>", () => {
        let userFunction;

        beforeEach(async () => {
            const {
                userFunction: userFn,
                shutdownPromise: shutdown,
            } = await tryStartInvoker(
                "../spec/helpers/hooks/simple-lifecycle-streaming-function",
                shutdownTrigger.getPromise()
            );

            userFunction = userFn;
            shutdownPromise = shutdown;
        });

        afterEach(() => {
            userFunction.$init.calls.reset();
            userFunction.$destroy.calls.reset();
        });

        it("invokes the $init hook only once when the process starts", () => {
            expect(userFunction.$init).toHaveBeenCalledTimes(1);
        });

        it("invokes the $destroy hook only once when the server shuts down", (done) => {
            shutdownPromise.then(() => {
                expect(userFunction.$destroy).toHaveBeenCalledTimes(1);
                done();
            });
            shutdownTrigger.resolveNow();
        });
    });
});
