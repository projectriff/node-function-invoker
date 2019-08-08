const {newFixedSource, newMappingTransform} = require('./helpers/factories');
const promoteFunction = require('../lib/function-promoter');
const {PassThrough} = require('stream');

describe('function promoter =>', () => {
    const data = [1, 2, 4];
    const userFunction = (x) => x ** 2;
    const streamingUserFunction = (input, output) => input.pipe(newMappingTransform(userFunction)).pipe(output);
    streamingUserFunction.$interactionModel = 'node-streams';
    let streamingOutput;
    const expectedResults = data.map(userFunction);
    let source;

    beforeEach(() => {
        source = newFixedSource(data);
        streamingOutput = new PassThrough({objectMode: true});
    });

    afterEach(() => {
        source.destroy();
        streamingOutput.destroy();
    });

    it('promotes request-reply functions to streaming', (done) => {
        let index = 0;
        streamingOutput.on('data', (chunk) => {
            expect(index).toBeLessThan(expectedResults.length, `expected only ${expectedResults.length} element(s)`);
            expect(chunk).toEqual(expectedResults[index++])
        });
        streamingOutput.on('end', () => {
            done()
        });

        const result = promoteFunction(userFunction);
        result(source, streamingOutput);
    });

    it('returns streaming functions as-is', (done) => {
        let index = 0;
        streamingOutput.on('data', (chunk) => {
            expect(index).toBeLessThan(expectedResults.length, `expected only ${expectedResults.length} element(s)`);
            expect(chunk).toEqual(expectedResults[index++])
        });
        streamingOutput.on('end', () => {
            done()
        });

        const result = promoteFunction(streamingUserFunction);
        result(source, streamingOutput);
    });

    it('preserves lifecycle hooks if any are set', () => {
        const someFunction = require('./helpers/lifecycle/simple-lifecycle-request-reply-function');

        const promotedFunction = promoteFunction(someFunction);

        expect(someFunction['$init']).toBeTruthy();
        expect(someFunction['$destroy']).toBeTruthy();
        expect(promotedFunction['$init']).toEqual(someFunction['$init']);
        expect(promotedFunction['$destroy']).toEqual(someFunction['$destroy']);
    });

    it('discards invalid hooks if any are set', () => {
        const someFunction = require('./helpers/lifecycle/invalid-lifecycle-function');

        const promotedFunction = promoteFunction(someFunction);

        expect(someFunction['$init']).toBeTruthy();
        expect(someFunction['$destroy']).toBeTruthy();
        expect(promotedFunction['$init']).toBeUndefined();
        expect(promotedFunction['$destroy']).toBeUndefined();
    });
});
