const MappingTransform = require("../lib/mapping-transform");

describe("MappingTransform =>", () => {
    let mappingTransform;

    afterEach(() => {
        mappingTransform.destroy();
    });

    describe("when dealing with non-streaming synchronous functions =>", () => {
        beforeEach(() => {
            const synchronousFunction = x => x.foo();
            mappingTransform = new MappingTransform(synchronousFunction);
        });

        it("maps them to streaming transform", done => {
            mappingTransform.on("data", chunk => {
                expect(chunk).toEqual(42);
                done();
            });
            mappingTransform.write({ foo: () => 42 });
        });
    });

    describe("when dealing with non-streaming asynchronous functions =>", () => {
        beforeEach(() => {
            const asynchronousFunction = async x => x.foo();
            mappingTransform = new MappingTransform(asynchronousFunction);
        });

        it("maps them to streaming transform", done => {
            mappingTransform.on("data", chunk => {
                expect(chunk).toEqual(42);
                done();
            });
            mappingTransform.write({ foo: () => 42 });
        });
    });

    describe("when dealing with non-streaming promise-based functions =>", () => {
        beforeEach(() => {
            const asynchronousFunction = x => Promise.resolve(x.foo());
            mappingTransform = new MappingTransform(asynchronousFunction);
        });

        it("maps them to streaming transform", done => {
            mappingTransform.on("data", chunk => {
                expect(chunk).toEqual(42);
                done();
            });
            mappingTransform.write({ foo: () => 42 });
        });
    });
});
