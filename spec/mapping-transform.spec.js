const MappingTransform = require("../lib/mapping-transform");
const { Message } = require("@projectriff/message");

describe("MappingTransform =>", () => {
    let mappingTransform;

    afterEach(() => {
        mappingTransform.destroy();
    });

    describe("when dealing with non-streaming synchronous functions =>", () => {
        beforeEach(() => {
            const synchronousFunction = (x) => x.foo();
            mappingTransform = new MappingTransform(synchronousFunction);
        });

        it("maps them to streaming transform", (done) => {
            mappingTransform.on("data", (chunk) => {
                expect(chunk).toEqual(42);
                done();
            });
            mappingTransform.write(
                Message.builder()
                    .payload({ foo: () => 42 })
                    .build()
            );
        });
    });

    describe("when dealing with non-streaming asynchronous functions =>", () => {
        beforeEach(() => {
            const asynchronousFunction = async (x) => x.foo();
            mappingTransform = new MappingTransform(asynchronousFunction);
        });

        it("maps them to streaming transform", (done) => {
            mappingTransform.on("data", (chunk) => {
                expect(chunk).toEqual(42);
                done();
            });
            mappingTransform.write(
                Message.builder()
                    .payload({ foo: () => 42 })
                    .build()
            );
        });
    });

    describe("when dealing with non-streaming promise-based functions =>", () => {
        beforeEach(() => {
            const asynchronousFunction = (x) => Promise.resolve(x.foo());
            mappingTransform = new MappingTransform(asynchronousFunction);
        });

        it("maps them to streaming transform", (done) => {
            mappingTransform.on("data", (chunk) => {
                expect(chunk).toEqual(42);
                done();
            });
            mappingTransform.write(
                Message.builder()
                    .payload({ foo: () => 42 })
                    .build()
            );
        });
    });

    describe("when dealing with headers argument type =>", () => {
        beforeEach(() => {
            const fn = (headers) => headers.getValue("X-Square") ** 2;
            fn.$argumentType = "headers";
            mappingTransform = new MappingTransform(fn);
        });

        it("maps them to streaming transform", (done) => {
            mappingTransform.on("data", (chunk) => {
                expect(chunk).toEqual(9);
                done();
            });
            mappingTransform.write(
                Message.builder().addHeader("X-Square", 3).build()
            );
        });
    });

    describe("when dealing with message argument type =>", () => {
        beforeEach(() => {
            const fn = (msg) => msg.headers.getValue("X-Sum") + msg.payload;
            fn.$argumentType = "message";
            mappingTransform = new MappingTransform(fn);
        });

        it("maps them to streaming transform", (done) => {
            mappingTransform.on("data", (chunk) => {
                expect(chunk).toEqual(5);
                done();
            });
            mappingTransform.write(
                Message.builder().addHeader("X-Sum", 3).payload(2).build()
            );
        });
    });
});
