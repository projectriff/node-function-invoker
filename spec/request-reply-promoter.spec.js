const { newFixedSource, newMappingTransform } = require("./helpers/factories");
const promoteFunction = require("../lib/request-reply-promoter");
const { PassThrough } = require("stream");

describe("function promoter =>", () => {
    const data = [1, 2, 4];
    const userFunction = (x) => x ** 2;
    const streamingUserFunction = (inputs, outputs) => {
        const inputStream = inputs.$order[0];
        const outputStream = outputs.$order[0];
        inputStream.pipe(newMappingTransform(userFunction)).pipe(outputStream);
    };
    streamingUserFunction.$interactionModel = "node-streams";

    let streamingOutput;
    const expectedResults = data.map(userFunction);
    let source;

    beforeEach(() => {
        source = newFixedSource(data);
        streamingOutput = new PassThrough({ objectMode: true });
    });

    afterEach(() => {
        source.destroy();
        streamingOutput.destroy();
    });

    it("promotes request-reply functions to streaming", (done) => {
        let index = 0;
        streamingOutput.on("data", (chunk) => {
            expect(index).toBeLessThan(
                expectedResults.length,
                `expected only ${expectedResults.length} element(s)`
            );
            expect(chunk).toEqual(expectedResults[index++]);
        });
        streamingOutput.on("end", () => {
            done();
        });

        const result = promoteFunction(userFunction);
        result({ $order: [source] }, { $order: [streamingOutput] });
    });

    it("returns streaming functions as-is", (done) => {
        let index = 0;
        streamingOutput.on("data", (chunk) => {
            expect(index).toBeLessThan(
                expectedResults.length,
                `expected only ${expectedResults.length} element(s)`
            );
            expect(chunk).toEqual(expectedResults[index++]);
        });
        streamingOutput.on("end", () => {
            done();
        });

        const result = promoteFunction(streamingUserFunction);
        result({ $order: [source] }, { $order: [streamingOutput] });
    });

    describe("when called with functions with an argument transformer => ", () => {
        it("adapts the argument transformer", () => {
            const someFunction = require("./helpers/transformers/valid-argument-transformers-request-reply-function");

            const promotedFunction = promoteFunction(someFunction);

            const originalTransformer = someFunction["$argumentTransformers"];
            expect(originalTransformer).toBeTruthy();
            expect(promotedFunction["$argumentTransformers"]).toEqual(
                originalTransformer
            );
        });
    });

    describe("when called with functions with an invalid number of argument transformers => ", () => {
        it("adapts the argument transformer", () => {
            const someFunction = require("./helpers/transformers/valid-argument-transformers-request-reply-function");

            const promotedFunction = promoteFunction(someFunction);

            const originalTransformer = someFunction["$argumentTransformers"];
            expect(originalTransformer).toBeTruthy();
            expect(promotedFunction["$argumentTransformers"]).toEqual(
                originalTransformer
            );
        });
    });
});
