const { newMappingTransform } = require("./helpers/factories");
const promoteFunction = require("../lib/request-reply-promoter");
const { PassThrough, Readable } = require("stream");
const { Message } = require("@projectriff/message");

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
        source = Readable.from(
            data.map((payload) => Message.builder().payload(payload).build())
        );
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
});
