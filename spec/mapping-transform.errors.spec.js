const MappingTransform = require("../lib/mapping-transform");

describe("MappingTransform =>", () => {
    let mappingTransform;

    afterEach(() => {
        mappingTransform.destroy();
    });

    describe("when dealing with synchronous functions =>", () => {
        beforeEach(() => {
            mappingTransform = new MappingTransform(x => x.foo());
        });

        it("intercepts runtime errors and sends error events", done => {
            mappingTransform.on("data", () => {
                done(
                    new Error(
                        "should not receive any data as the computation failed"
                    )
                );
            });
            mappingTransform.on("error", err => {
                expect(err.type).toEqual(
                    "request-reply-function-runtime-error"
                );
                expect(err.cause.name).toEqual("TypeError");
                expect(err.cause.message).toEqual("x.foo is not a function");
                done();
            });
            mappingTransform.write({});
        });
    });

    describe("when dealing with asynchronous functions =>", () => {
        beforeEach(() => {
            mappingTransform = new MappingTransform(async x => x.foo());
        });

        it("intercepts async runtime errors and sends error events", done => {
            mappingTransform.on("data", () => {
                done(
                    new Error(
                        "should not receive any data as the computation failed"
                    )
                );
            });
            mappingTransform.on("error", err => {
                expect(err.type).toEqual(
                    "request-reply-function-runtime-error"
                );
                expect(err.cause.name).toEqual("TypeError");
                expect(err.cause.message).toEqual("x.foo is not a function");
                done();
            });
            mappingTransform.write({});
        });
    });

    describe("when dealing with promise-based functions =>", () => {
        beforeEach(() => {
            mappingTransform = new MappingTransform(x =>
                Promise.resolve(x.foo())
            );
        });

        it("intercepts async runtime errors and sends error events", done => {
            mappingTransform.on("data", () => {
                done(
                    new Error(
                        "should not receive any data as the computation failed"
                    )
                );
            });
            mappingTransform.on("error", err => {
                expect(err.type).toEqual(
                    "request-reply-function-runtime-error"
                );
                expect(err.cause.name).toEqual("TypeError");
                expect(err.cause.message).toEqual("x.foo is not a function");
                done();
            });
            mappingTransform.write({});
        });
    });
});
