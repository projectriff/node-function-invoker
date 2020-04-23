const MappingTransform = require("../lib/mapping-transform");
const { finished } = require("stream");
const { Message } = require("@projectriff/message");

describe("MappingTransform =>", () => {
    let mappingTransform;

    afterEach(() => {
        mappingTransform.destroy();
    });

    describe("when dealing with synchronous functions =>", () => {
        beforeEach(() => {
            mappingTransform = new MappingTransform((x) => x.foo());
        });

        it("intercepts runtime errors and sends error events", (done) => {
            mappingTransform.on("data", () => {
                done(
                    new Error(
                        "should not receive any data as the computation failed"
                    )
                );
            });
            finished(mappingTransform, (err) => {
                expect(err.type).toEqual(
                    "request-reply-function-runtime-error"
                );
                expect(err.cause.name).toEqual("TypeError");
                expect(err.cause.message).toEqual("x.foo is not a function");
                done();
            });
            mappingTransform.write(Message.builder().payload({}).build());
        });
    });

    describe("when dealing with asynchronous functions =>", () => {
        beforeEach(() => {
            mappingTransform = new MappingTransform(async (x) => x.foo());
        });

        it("intercepts async runtime errors and sends error events", (done) => {
            mappingTransform.on("data", () => {
                done(
                    new Error(
                        "should not receive any data as the computation failed"
                    )
                );
            });
            finished(mappingTransform, (err) => {
                expect(err.type).toEqual(
                    "request-reply-function-runtime-error"
                );
                expect(err.cause.name).toEqual("TypeError");
                expect(err.cause.message).toEqual("x.foo is not a function");
                done();
            });
            mappingTransform.write(Message.builder().payload({}).build());
        });
    });

    describe("when dealing with promise-based functions =>", () => {
        beforeEach(() => {
            mappingTransform = new MappingTransform((x) =>
                Promise.resolve(x.foo())
            );
        });

        it("intercepts async runtime errors and sends error events", (done) => {
            mappingTransform.on("data", () => {
                done(
                    new Error(
                        "should not receive any data as the computation failed"
                    )
                );
            });
            finished(mappingTransform, (err) => {
                expect(err.type).toEqual(
                    "request-reply-function-runtime-error"
                );
                expect(err.cause.name).toEqual("TypeError");
                expect(err.cause.message).toEqual("x.foo is not a function");
                done();
            });
            mappingTransform.write(Message.builder().payload({}).build());
        });
    });

    describe("when dealing with invalid argument type =>", () => {
        beforeEach(() => {
            const fn = (x) => x;
            fn.$argumentType = "invalid-type";
            mappingTransform = new MappingTransform(fn);
        });

        it("intercepts async runtime errors and sends error events", (done) => {
            mappingTransform.on("data", () => {
                done(
                    new Error(
                        "should not receive any data as the computation failed"
                    )
                );
            });
            finished(mappingTransform, (err) => {
                expect(err.type).toEqual(
                    "request-reply-function-runtime-error"
                );
                expect(err.cause.name).toEqual("Error");
                expect(err.cause.message).toEqual(
                    "unknown $argumentType: invalid-type"
                );
                done();
            });
            mappingTransform.write(Message.builder().payload({}).build());
        });
    });
});
