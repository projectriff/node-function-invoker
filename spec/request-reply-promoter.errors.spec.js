const promoteFunction = require("../lib/request-reply-promoter");
const { PassThrough } = require("stream");

describe("function promoter =>", () => {
    describe("when the called function throws => ", () => {
        const userFunction = (x) => {
            throw new Error("nope");
        };

        it("propagates the error back to the input stream", (done) => {
            const streamingUserFunction = promoteFunction(userFunction);
            const input = new PassThrough({ objectMode: true });
            const output = new PassThrough({ objectMode: true });

            input.on("error", (err) => {
                expect(err.type).toEqual(
                    "request-reply-function-runtime-error"
                );
                expect(err.cause).toEqual(new Error("nope"));
                done();
            });
            output.on("error", (err) => {
                done(
                    new Error(
                        `Expected output to not receive any error, got: ${err}`
                    )
                );
            });

            streamingUserFunction({ $order: [input] }, { $order: [output] });
            input.write("irrelevant value");
        });
    });
});
