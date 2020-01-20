const StreamingPipeline = require('../lib/streaming-pipeline');
const {PassThrough} = require('stream');

describe('erroring streaming pipeline with hooks =>', () => {

    let streamingPipeline;
    let destinationStream;

    beforeEach(() => {
        destinationStream = new PassThrough({objectMode: true});
    });

    afterEach(() => {
        streamingPipeline.destroy();
        destinationStream.destroy();
    });

    describe('with a function with a too slow $init =>', () => {
        const userFunction = require('./helpers/hooks/slow-init-hook-streaming-function');

        it('emits an error', (done) => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {
                objectMode: true,
                hookTimeoutInMs: 100
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-hook-timeout');
                expect(err.cause).toEqual('The hook took too long to run. Aborting now');
                done();
            });
        });
    });

    describe('with a function with a too slow $destroy =>', () => {
        const userFunction = require('./helpers/hooks/slow-destroy-hook-streaming-function');

        it('emits an error', (done) => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {
                objectMode: true,
                hookTimeoutInMs: 100
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-hook-timeout');
                expect(err.cause).toEqual('The hook took too long to run. Aborting now');
                done();
            });
            destinationStream.end();
        });
    });

    describe('with a function with a failing $init =>', () => {
        const userFunction = require('./helpers/hooks/failing-init-hook-streaming-function');

        it('emits an error', (done) => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {
                objectMode: true,
                hookTimeoutInMs: 100
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-hook-runtime-error');
                expect(err.cause.message).toEqual('oopsie');
                done();
            });
        });
    });

    describe('with a function with a failing $destroy =>', () => {
        const userFunction = require('./helpers/hooks/failing-destroy-hook-streaming-function');

        it('emits an error', (done) => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {
                objectMode: true,
                hookTimeoutInMs: 100
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-hook-runtime-error');
                expect(err.cause.message).toEqual('oopsie');
                done();
            });
            destinationStream.end();
        });
    });
});
