const { TextEncoder } = require("util");
const OutputMarshaller = require("../lib/output-marshaller");
const {
    newFixedSource,
    newOutputFrame,
    newOutputSignal,
    newRiffHeaders,
    newRiffMessage
} = require("./helpers/factories");

describe("output marshaller =>", () => {
    let marshaller;
    let source;

    ["application/json", "application/cloudevents+json"].forEach(mediaType => {
        const outputPayloads = [42, "forty-two"];
        const textEncoder = new TextEncoder();
        const expectedIndex = 0;
        const expectedPayloadCount = outputPayloads.length;

        describe(`with ${mediaType} data =>`, () => {
            beforeEach(() => {
                source = newFixedSource(outputPayloads);
                marshaller = new OutputMarshaller(expectedIndex, mediaType);
            });

            afterEach(() => {
                source.destroy();
                marshaller.destroy();
            });

            it("transforms and forwards the received outputs", done => {
                let index = 0;
                marshaller.on("data", chunk => {
                    expect(index).toBeLessThan(
                        outputPayloads.length,
                        `should not consume more than ${expectedPayloadCount} elements, about to consume ${index}th one`
                    );
                    const expectedFrame = newOutputFrame(
                        expectedIndex,
                        mediaType,
                        textEncoder.encode(
                            JSON.stringify(outputPayloads[index])
                        )
                    );
                    const expectedSignal = newOutputSignal(expectedFrame);
                    expect(chunk).toEqual(expectedSignal);
                    index++;
                });
                marshaller.on("end", () => {
                    expect(index).toEqual(
                        outputPayloads.length,
                        `should have consumed ${outputPayloads.length} element(s), consumed ${index}`
                    );
                    done();
                });

                source.pipe(marshaller);
            });
        });
    });

    describe("with riff message data =>", () => {
        const payload = "42";
        const textEncoder = new TextEncoder();
        const mediaType = "text/plain";

        beforeEach(() => {
            const messageHeaders = newRiffHeaders()
                .addHeader("Content-Type", "text/csv", "ignored")
                .addHeader("X-Custom-Header", "custom value");
            source = newFixedSource([newRiffMessage(messageHeaders, payload)]);
            marshaller = new OutputMarshaller(0, mediaType);
        });

        afterEach(() => {
            source.destroy();
            marshaller.destroy();
        });

        it("properly marshalls them", done => {
            let index = 0;
            marshaller.on("data", chunk => {
                expect(index).toBeLessThan(
                    1,
                    `should not consume more than 1 element, about to consume ${index}th one`
                );
                const expectedFrame = newOutputFrame(
                    0,
                    mediaType,
                    textEncoder.encode(payload),
                    [
                        ["Content-Type", "text/csv"],
                        ["X-Custom-Header", "custom value"]
                    ]
                );
                const expectedSignal = newOutputSignal(expectedFrame);
                expect(chunk).toEqual(expectedSignal);
                index++;
            });
            marshaller.on("end", () => {
                expect(index).toEqual(
                    1,
                    `should have consumed 1 element, consumed ${index}`
                );
                done();
            });

            source.pipe(marshaller);
        });
    });
});
