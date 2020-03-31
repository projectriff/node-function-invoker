const promoteFunction = require("../lib/request-reply-promoter");
const { PassThrough } = require("stream");

describe("function promoter =>", () => {
    describe("when called with functions with an argument transformer => ", () => {
        it("rejects invalid argument transformers", () => {
            try {
                const someFunction = require("./helpers/transformers/invalid-argument-transformers-request-reply-function");
                promoteFunction(someFunction);
                fail("should fail");
            } catch (err) {
                expect(err.type).toEqual("error-argument-transformer");
                expect(err.cause).toEqual(
                    "Argument transformers must be declared in an array. Found: string"
                );
            }
        });

        it("rejects too many declared argument transformers", () => {
            try {
                const someFunction = require("./helpers/transformers/invalid-argument-transformer-count-request-reply-function");
                promoteFunction(someFunction);
                fail("should fail");
            } catch (err) {
                expect(err.type).toEqual("error-argument-transformer");
                expect(err.cause).toEqual(
                    "Request-reply function must declare exactly 1 argument transformer. Found 2"
                );
            }
        });
    });

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
