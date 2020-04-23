const { TextEncoder } = require("util");
const { Readable } = require("stream");
const { newInputFrame, newInputSignal } = require("./helpers/factories");
const { Message } = require("@projectriff/message");
const InputUnmarshaller = require("../lib/input-unmarshaller");

describe("input unmarshaller =>", () => {
    const textEncoder = new TextEncoder();

    let unmarshaller;

    beforeEach(() => {
        unmarshaller = new InputUnmarshaller();
    });

    afterEach(() => {
        unmarshaller.destroy();
    });

    describe("with text/plain data =>", () => {
        let inputs;
        const expectedPayloads = ["aha", "take me on"];
        const expectedPayloadCount = expectedPayloads.length;

        beforeEach(() => {
            inputs = Readable.from([
                newInputSignal(
                    newInputFrame(
                        0,
                        "text/plain",
                        textEncoder.encode(expectedPayloads[0])
                    )
                ),
                newInputSignal(
                    newInputFrame(
                        0,
                        "text/plain",
                        textEncoder.encode(expectedPayloads[1])
                    )
                ),
            ]);
        });

        afterEach(() => {
            inputs.destroy();
        });

        it("transforms and forwards the received input signals", (done) => {
            let index = 0;
            unmarshaller.on("data", (chunk) => {
                if (index === expectedPayloadCount) {
                    done(
                        new Error(
                            `should not consume more than ${expectedPayloadCount} elements, about to consume ${index}th one`
                        )
                    );
                }
                expect(chunk.payload).toEqual(expectedPayloads[index++]);
            });
            unmarshaller.on("end", () => {
                done();
            });

            inputs.pipe(unmarshaller);
        });
    });

    ["application/json", "application/cloudevents+json"].forEach(
        (mediaType) => {
            describe(`with ${mediaType} data (and default charset) =>`, () => {
                let inputs;
                const inputPayloads = ['"and the answer obviously is: "', 42];
                const expectedPayloads = ["and the answer obviously is: ", 42];
                const expectedPayloadCount = expectedPayloads.length;

                beforeEach(() => {
                    inputs = Readable.from([
                        newInputSignal(
                            newInputFrame(
                                0,
                                mediaType,
                                textEncoder.encode(inputPayloads[0])
                            )
                        ),
                        newInputSignal(
                            newInputFrame(
                                0,
                                mediaType,
                                textEncoder.encode(inputPayloads[1])
                            )
                        ),
                    ]);
                });

                afterEach(() => {
                    inputs.destroy();
                });

                it("transforms and forwards the received input signals", (done) => {
                    let index = 0;
                    unmarshaller.on("data", (chunk) => {
                        if (index === expectedPayloadCount) {
                            done(
                                new Error(
                                    `should not consume more than ${expectedPayloadCount} elements, about to consume ${index}th one`
                                )
                            );
                        }
                        expect(chunk.payload).toEqual(
                            expectedPayloads[index++]
                        );
                    });
                    unmarshaller.on("end", () => {
                        done();
                    });

                    inputs.pipe(unmarshaller);
                });
            });

            const quoteBytesLittleEndian = [0x22, 0]; // "
            const euroBytesLittleEndian = [0xac, 0x20]; // €
            [
                { charset: "UTF-16" },
                { charset: "UTF-16LE" },
                {
                    charset: "UTF-16BE",
                    bytesTransform: (bytes) => bytes.slice().reverse(),
                },
            ].forEach(
                ({
                    charset: utf16Charset,
                    bytesTransform: transform = (bytes) => bytes,
                }) => {
                    describe(`with ${mediaType} data (${utf16Charset} charset) =>`, () => {
                        const input = Buffer.from([
                            // "€"
                            ...transform(quoteBytesLittleEndian),
                            ...transform(euroBytesLittleEndian),
                            ...transform(quoteBytesLittleEndian),
                        ]);
                        const expectedPayload = "€";

                        beforeEach(() => {
                            inputs = Readable.from([
                                newInputSignal(
                                    newInputFrame(
                                        0,
                                        `${mediaType};charset=${utf16Charset}`,
                                        input
                                    )
                                ),
                            ]);
                        });

                        afterEach(() => {
                            inputs.destroy();
                        });

                        it("transforms and forwards the received input signals", (done) => {
                            let processed = false;
                            unmarshaller.on("data", (chunk) => {
                                expect(processed).toBeFalsy(
                                    `should not consume more than 1 element`
                                );
                                processed = true;
                                expect(chunk.payload).toEqual(expectedPayload);
                            });
                            unmarshaller.on("end", () => {
                                done();
                            });

                            inputs.pipe(unmarshaller);
                        });
                    });
                }
            );
        }
    );
});
