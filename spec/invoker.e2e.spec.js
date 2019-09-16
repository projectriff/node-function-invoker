const {TextEncoder} = require('util');
const startInvoker = require('../lib/invoker');
const outputSignalCustomEqual = require('./helpers/output-signal-custom-equality');
const newClient = require('./helpers/grpc-client');
const {
    newInputFrame,
    newInputSignal,
    newOutputFrame,
    newOutputSignal,
    newStartFrame,
    newStartSignal
} = require('./helpers/factories');

describe('invoker =>', () => {
    const textEncoder = new TextEncoder();
    let server;
    let address;
    let client;

    afterEach((done) => {
        server.tryShutdown(done);
        client.close();
    });

    [
        {interactionType: 'streaming', functionUri: '../samples/streaming-square/streaming-square.js'},
        {interactionType: 'request-reply', functionUri: '../samples/request-reply-square/square.js'},
    ].forEach((testCase) => {

        describe(`with a ${testCase.interactionType} square function =>`, () => {

            beforeEach(() => {
                jasmine.addCustomEqualityTester(outputSignalCustomEqual);
                ({server, address} = tryStartInvoker(testCase.functionUri));
                client = newClient(address);
            });

            it('successfully invokes the function', (done) => {
                const inputs = [
                    newStartSignal(newStartFrame(['application/json'])),
                    newInputSignal(newInputFrame(0, 'application/json', textEncoder.encode('2'))),
                    newInputSignal(newInputFrame(0, 'application/json', textEncoder.encode('3')))
                ];
                const expectedOutputs = [
                    newOutputSignal(newOutputFrame(0, 'application/json', textEncoder.encode('4'))),
                    newOutputSignal(newOutputFrame(0, 'application/json', textEncoder.encode('9')))
                ];
                const expectedOutputCount = expectedOutputs.length;

                const call = client.invoke();

                let seenOutputIndex = 0;
                call.on('data', (outputSignal) => {
                    expect(seenOutputIndex).toBeLessThan(expectedOutputCount,
                        `expected only ${expectedOutputCount} elements, received at least ${seenOutputIndex}`);
                    expect(outputSignal).toEqual(expectedOutputs[seenOutputIndex++]);
                });
                call.on('end', () => {
                    expect(seenOutputIndex).toEqual(expectedOutputs.length,
                        `expected to receive exactly ${expectedOutputCount}, received ${seenOutputIndex}`);
                    done();
                });

                inputs.forEach((input) => {
                    call.write(input);
                });
                call.end();
            });
        });
    });

    describe('with an async request-reply cube function =>', () => {

        beforeEach(() => {
            jasmine.addCustomEqualityTester(outputSignalCustomEqual);
            ({server, address} = tryStartInvoker('../samples/request-reply-async-cube/async-cube.js'));
            client = newClient(address);
        });

        it('successfully invokes the function', (done) => {
            const inputs = [
                newStartSignal(newStartFrame(['application/json'])),
                newInputSignal(newInputFrame(0, 'text/plain', textEncoder.encode('2'))),
                newInputSignal(newInputFrame(0, 'text/plain', textEncoder.encode('3')))
            ];
            const expectedOutputs = [
                newOutputSignal(newOutputFrame(0, 'application/json', textEncoder.encode('8'))),
                newOutputSignal(newOutputFrame(0, 'application/json', textEncoder.encode('27')))
            ];
            const expectedOutputCount = expectedOutputs.length;

            const call = client.invoke();

            let seenOutputIndex = 0;
            call.on('data', (outputSignal) => {
                expect(seenOutputIndex).toBeLessThan(expectedOutputCount,
                    `expected only ${expectedOutputCount} elements, received at least ${seenOutputIndex}`);
                expect(outputSignal).toEqual(expectedOutputs[seenOutputIndex++]);
            });
            call.on('end', () => {
                expect(seenOutputIndex).toEqual(expectedOutputs.length,
                    `expected to receive exactly ${expectedOutputCount}, received ${seenOutputIndex}`);
                done();
            });

            inputs.forEach((input) => {
                call.write(input);
            });
            call.end();
        });
    });
});

const tryStartInvoker = (functionUri) => {
    let lastError;
    const triedPorts = [];
    for (let i = 0; i < 5; i++) {
        const port = randomPort();
        triedPorts.push(port);
        try {
            return {server: startInvoker(functionUri, port), address: `localhost:${port}`};
        } catch (err) {
            lastError = err;
        }
    }
    throw new Error(`An error occurred when starting the server. Tried: ${triedPorts.join(", ")}. Last error was: ${lastError}`)
};

const randomPort = () => {
    return 1024 + Math.floor(Math.random() * Math.floor(64511));
};
