const promoteFunction = require("../lib/request-reply-promoter");

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
});
