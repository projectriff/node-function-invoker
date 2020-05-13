const { determineContentTypes } = require("../lib/content-negotiation");

describe("content negotiation =>", () => {
    describe("determine content-type =>", () => {
        it("defaults to plain text", async () => {
            const detected = determineContentTypes(undefined, undefined);

            expect(detected.contentType).toBe("text/plain");
            expect(detected.accept).toBe("text/plain");
        });
        it("defaults missing accept to content type", async () => {
            const detected = determineContentTypes(
                "application/cloudevents+json",
                undefined
            );

            expect(detected.contentType).toBe("application/cloudevents+json");
            expect(detected.accept).toBe("application/cloudevents+json");
        });
        it("defaults wildcard accept to json", async () => {
            const detected = determineContentTypes(
                "application/cloudevents+json",
                "*/*"
            );

            expect(detected.contentType).toBe("application/cloudevents+json");
            expect(detected.accept).toBe("application/json");
        });
    });
});
