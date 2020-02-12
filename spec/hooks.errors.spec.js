const RiffError = require("../lib/riff-error");
const { guardWithTimeout } = require("../lib/hooks");

describe("hook utilities =>", () => {
    describe("timeout guard =>", () => {
        it("rejects wrongly typed hooks", async () => {
            await expectAsync(
                guardWithTimeout("not a valid hook", 100)
            ).toBeRejectedWith(
                new RiffError(
                    "error-invalid-hook",
                    "Hooks must be functions, found: string"
                )
            );
        });

        it("rejects asynchronously throwing hooks", async () => {
            const offTheHook = async () => {
                throw new Error("nope");
            };

            await expectAsync(
                guardWithTimeout(offTheHook, 100)
            ).toBeRejectedWithError(
                RiffError,
                "error-hook-runtime-error: Error: nope"
            );
        });

        it("rejects synchronously throwing hooks", async () => {
            const offTheHook = () => {
                throw new Error("nope");
            };

            await expectAsync(
                guardWithTimeout(offTheHook, 100)
            ).toBeRejectedWithError(
                RiffError,
                "error-hook-runtime-error: Error: nope"
            );
        });
    });
});
