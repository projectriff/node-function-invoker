const StreamingPipeline = require('../lib/streaming-pipeline');
const {PassThrough} = require('stream');
const {
    newFixedSource,
    newInputFrame,
    newInputSignal,
    newMappingTransform,
    newOutputFrame,
    newOutputSignal,
    newStartFrame,
    newStartSignal
} = require('./helpers/factories');

describe('streaming pipeline =>', () => {
    let destinationStream;
    let streamingPipeline;
    let fixedSource;

    beforeEach(() => {
        destinationStream = new PassThrough({objectMode: true});
    });

    afterEach(() => {
        fixedSource.destroy();
        streamingPipeline.destroy();
        destinationStream.destroy();
    });

    describe('with a reliable function =>', () => {
        const userFunction = (inputStream, outputStream) => {
            inputStream.pipe(newMappingTransform((arg) => arg + 42)).pipe(outputStream);
        };

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
        });

        describe('with valid input signals =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/plain'])),
                    newInputSignal(newInputFrame(
                        0,
                        'application/json',
                        '"the ultimate answer to life the universe and everything is: "'
                    ))
                ]);
            });

            it('invokes the function and send the outputs', (done) => {
                streamingPipeline.on('error', (err) => {
                    done(err);
                });
                let dataReceived = false;
                destinationStream.on('data', (chunk) => {
                    expect(dataReceived).toBeFalsy('expected to receive data only once');
                    expect(chunk).toEqual(
                        newOutputSignal(newOutputFrame(
                            0,
                            'text/plain',
                            'the ultimate answer to life the universe and everything is: 42'
                        ))
                    );
                    dataReceived = true;
                });
                destinationStream.on('finish', () => {
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            });
        });

        describe('with a closed input stream =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame([]))
                ]);
            });

            // when the source ends (such as an internal call like `this.push(null)`), the piped destination will have its 'end' method called
            // see https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
            it('will end input streams when the piped source ends', (done) => {
                let inputEnded = false;
                const userFunction = (inputStream) => {
                    inputStream.on('end', () => {
                        inputEnded = true;
                    })
                };
                streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
                streamingPipeline.on('finish', () => {
                    expect(inputEnded).toBeTruthy('input stream should have been ended');
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            })
        });

        describe('with an immediately closing output stream =>', () => {
            const data = ['1', '4', '9'];
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/plain', 'text/plain'])),
                    ...(data.map((payload) => newInputSignal(newInputFrame(0, 'text/plain', payload))))
                ]);
            });

            it('the other output stream can still emit to the destination stream', (done) => {
                const userFunction = (inputStream, outputStream1, outputStream2) => {
                    outputStream1.end();
                    inputStream.pipe(outputStream2);
                };

                let receivedOutputSignalCount = 0;
                destinationStream.on('data', (outputSignal) => {
                    expect(receivedOutputSignalCount).toBeLessThan(data.length, `expected to see only ${data.length}, already seen ${receivedOutputSignalCount + 1}th`);
                    expect(outputSignal).toEqual(newOutputSignal(newOutputFrame(1, 'text/plain', data[receivedOutputSignalCount])));
                    receivedOutputSignalCount++;
                });
                destinationStream.on('finish', () => {
                    expect(receivedOutputSignalCount).toEqual(data.length, `expected to see only ${data.length}, seen ${receivedOutputSignalCount}`);
                    done();
                });
                streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
                fixedSource.pipe(streamingPipeline);
            })
        });
    });
});
