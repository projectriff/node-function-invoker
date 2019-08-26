const {newFixedSource, newMappingTransform} = require('./helpers/factories');
const promoteFunction = require('../lib/function-promoter');
const {PassThrough} = require('stream');

describe('function promoter =>', () => {
    const data = [1, 2, 4];
    const userFunction = (x) => x ** 2;
    const streamingUserFunction = (inputs, outputs) => {
        const inputStream = inputs["0"];
        const outputStream = outputs["0"];
        inputStream
            .pipe(newMappingTransform(userFunction))
            .pipe(outputStream);
    };
    streamingUserFunction.$interactionModel = 'node-streams';
    streamingUserFunction.$arity = 2;
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
        expect(result['$arity']).toEqual(2, 'promoted functions should have an arity of 2');
        result({"0": source}, {"0": streamingOutput});
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
        result({"0": source}, {"0": streamingOutput});
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
        const someFunction = require('./helpers/lifecycle/invalid-lifecycle-request-reply-function');

        const promotedFunction = promoteFunction(someFunction);

        expect(someFunction['$init']).toBeTruthy();
        expect(someFunction['$destroy']).toBeTruthy();
        expect(promotedFunction['$init']).toBeUndefined();
        expect(promotedFunction['$destroy']).toBeUndefined();
    });

    it('adapts the argument transformer', () => {
        const someFunction = require('./helpers/lifecycle/invalid-lifecycle-request-reply-function');

        const promotedFunction = promoteFunction(someFunction);

        expect(someFunction['$init']).toBeTruthy();
        expect(someFunction['$destroy']).toBeTruthy();
        expect(promotedFunction['$init']).toBeUndefined();
        expect(promotedFunction['$destroy']).toBeUndefined();
    });
});
