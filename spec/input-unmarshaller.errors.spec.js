const { TextEncoder } = require("util");
const { newInputFrame, newInputSignal } = require("./helpers/factories");
const InputUnmarshaller = require("../lib/input-unmarshaller");
const { finished, Readable } = require("stream");

describe("input unmarshaller =>", () => {
    const textEncoder = new TextEncoder();

    let unmarshaller;

    beforeEach(() => {
        unmarshaller = new InputUnmarshaller();
    });

    afterEach(() => {
        unmarshaller.destroy();
    });

    describe("with unsupported content-types =>", () => {
        let unsupportedMediaTypeInputs;

        beforeEach(() => {
            unsupportedMediaTypeInputs = Readable.from([
                newInputSignal(
                    newInputFrame(
                        0,
                        "application/x-doom",
                        textEncoder.encode("???")
                    )
                ),
            ]);
        });

        afterEach(() => {
            unsupportedMediaTypeInputs.destroy();
        });

        it("emits an error", (done) => {
            unmarshaller.on("data", () => {
                done(new Error(`should not consume any elements`));
            });
            finished(unmarshaller, (err) => {
                expect(err.type).toEqual(
                    "error-input-content-type-unsupported"
                );
                expect(err.cause).toEqual(
                    `Unsupported content-type 'application/x-doom' for input #0`
                );
                done();
            });

            unsupportedMediaTypeInputs.pipe(unmarshaller, { end: false });
        });
    });

    describe("with an invalid content-type =>", () => {
        let unsupportedMediaTypeInputs;

        beforeEach(() => {
            unsupportedMediaTypeInputs = Readable.from([
                newInputSignal(
                    newInputFrame(
                        0,
                        "!![]not a valid content type[]!!",
                        textEncoder.encode("???")
                    )
                ),
            ]);
        });

        afterEach(() => {
            unsupportedMediaTypeInputs.destroy();
        });

        it("emits an error", (done) => {
            unmarshaller.on("data", () => {
                done(new Error(`should not consume any elements`));
            });
            finished(unmarshaller, (err) => {
                expect(err.type).toEqual("error-input-content-type-invalid");
                expect(err.cause).toEqual(
                    `Invalid content-type '!![]not a valid content type[]!!' for input #0`
                );
                done();
            });

            unsupportedMediaTypeInputs.pipe(unmarshaller, { end: false });
        });
    });

    ["application/json", "application/cloudevents+json"].forEach(
        (mediaType) => {
            describe(`with invalid payloads for ${mediaType} =>`, () => {
                let invalidInputs;

                beforeEach(() => {
                    invalidInputs = Readable.from([
                        newInputSignal(
                            newInputFrame(
                                0,
                                mediaType,
                                textEncoder.encode("invalid payload")
                            )
                        ),
                    ]);
                });

                afterEach(() => {
                    invalidInputs.destroy();
                });

                it("emits an error", (done) => {
                    unmarshaller.on("data", () => {
                        done(new Error(`should not consume any elements`));
                    });
                    finished(unmarshaller, (err) => {
                        expect(err.type).toEqual("error-input-invalid");
                        expect(err.cause.name).toEqual("SyntaxError");
                        expect(err.cause.message).toEqual(
                            "Unexpected token i in JSON at position 0"
                        );
                        done();
                    });

                    invalidInputs.pipe(unmarshaller, { end: false });
                });
            });
        }
    );

    ["US_ASCII", "UTF-7"].forEach((charset) => {
        describe(`with charset ${charset} (invalid for JSON) =>`, () => {
            let invalidInputs;

            beforeEach(() => {
                invalidInputs = Readable.from([
                    newInputSignal(
                        newInputFrame(
                            0,
                            `application/json;charset=${charset}`,
                            textEncoder.encode("true")
                        )
                    ),
                ]);
            });

            afterEach(() => {
                invalidInputs.destroy();
            });

            it("emits an error", (done) => {
                unmarshaller.on("data", () => {
                    done(new Error(`should not consume any elements`));
                });
                finished(unmarshaller, (err) => {
                    expect(err.type).toEqual("error-input-invalid");
                    expect(err.cause.name).toEqual("Error");
                    expect(err.cause.message).toEqual(
                        `Expected one of the following charsets: utf-8, utf-16, utf-16le, utf-16be, but was given: ${charset}`
                    );
                    done();
                });

                invalidInputs.pipe(unmarshaller, { end: false });
            });
        });
    });
});
