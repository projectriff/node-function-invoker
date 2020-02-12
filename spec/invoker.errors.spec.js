const startInvoker = require("../lib/invoker");
const tryStartInvoker = require("./helpers/try-start-invoker");
const RiffError = require("../lib/riff-error");
const grpc = require("grpc");
const DeferredPromiseWrapper = require("./helpers/deferred-promise");

describe("invoker =>", () => {
    describe("with a function with a too slow $init =>", () => {
        it("shuts down the server", async () => {
            const fnUri =
                "../spec/helpers/hooks/slow-init-hook-streaming-function";
            spyOn(grpc.Server.prototype, "forceShutdown");
            const shutdownSignal = new DeferredPromiseWrapper();

            // do not use tryStartInvoker as $init purposefully fails here
            const startupPromise = startInvoker(
                fnUri,
                { $initTimeoutMs: 90 },
                shutdownSignal.getPromise()
            );

            await expectAsync(startupPromise).toBeRejectedWithError(
                RiffError,
                "error-hook-timeout: The hook took too long to run (timeout: 90ms). Aborting now"
            );
            expect(grpc.Server.prototype.forceShutdown).toHaveBeenCalledTimes(
                1
            );
            expect(require(fnUri).$destroy).toHaveBeenCalledTimes(1);
        });
    });

    describe("with a function with a too slow $destroy =>", () => {
        it("fails the shutdown", async () => {
            const shutdownTrigger = new DeferredPromiseWrapper();

            const {
                userFunction,
                shutdownPromise
            } = await tryStartInvoker(
                "../spec/helpers/hooks/slow-destroy-hook-streaming-function",
                shutdownTrigger.getPromise(),
                { $destroyTimeoutMs: 100 }
            );

            shutdownTrigger.resolveNow();

            expect(userFunction.$init).toHaveBeenCalledTimes(1);
            return expectAsync(shutdownPromise).toBeRejectedWithError(
                RiffError,
                "error-hook-timeout: The hook took too long to run (timeout: 100ms). Aborting now"
            );
        });
    });

    describe("with a server that fails to shut down gracefully =>", () => {
        it("fails the shutdown", async () => {
            spyOn(grpc.Server.prototype, "tryShutdown").and.throwError(
                "tryShutdown KO"
            );
            const shutdownTrigger = new DeferredPromiseWrapper();

            const { userFunction, shutdownPromise } = await tryStartInvoker(
                "../spec/helpers/hooks/another-simple-lifecycle-streaming-function",
                shutdownTrigger.getPromise()
            );

            shutdownTrigger.resolveNow();

            await expectAsync(shutdownPromise).toBeRejectedWith(
                new Error("tryShutdown KO")
            );
            expect(userFunction.$init).toHaveBeenCalledTimes(1);
            expect(userFunction.$destroy).toHaveBeenCalledTimes(1);
        });
    });
});
