const StreamingPipeline = require('../lib/streaming-pipeline');
const {PassThrough} = require('stream');

describe('streaming pipeline =>', () => {

    let streamingPipeline;
    let destinationStream;

    beforeEach(() => {
        destinationStream = new PassThrough({objectMode: true});
    });

    afterEach(() => {
        streamingPipeline.destroy();
        destinationStream.destroy();
    });

    describe('with a function implementing lifecycle hooks =>', () => {
        const userFunction = require('./helpers/lifecycle/simple-lifecycle-streaming-function');

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
        });

        it('invokes the $init hook when the pipeline is instantiated', () => {
            expect(userFunction.getCounter()).toEqual(0, 'counter should have been reset by $init hook');
        });

        it('invokes the $destroy hook when the destination stream ends', () => {
            destinationStream.end();
            expect(userFunction.getCounter()).toEqual(Number.MAX_SAFE_INTEGER, 'counter should have been changed by $destroy hook');
        });
    });
});
