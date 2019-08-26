const promoteFunction = require('../lib/function-promoter');

describe('function promoter =>', () => {

    it('rejects invalid request-reply functions', () => {
        try {
            promoteFunction((x, y) => x + y);
            fail('should fail')
        } catch (err) {
            expect(err.type).toEqual('error-promoting-function');
            expect(err.cause).toEqual('Request-reply function must have exactly 1 argument, 2 found')
        }
    });

    describe('when called with functions with invalid hooks hooks => ', () => {
        it('rejects invalid init hook', () => {
            try {
                const someFunction = require('./helpers/hooks/invalid-init-hook-request-reply-function');
                promoteFunction(someFunction);
                fail('should fail')
            } catch (err) {
                expect(err.type).toEqual('error-promoting-function');
                expect(err.cause).toEqual('Request-reply function init hook must be a function. Found: number')
            }
        });

        it('rejects invalid destroy hook', () => {
            try {
                const someFunction = require('./helpers/hooks/invalid-destroy-hook-request-reply-function');
                promoteFunction(someFunction);
                fail('should fail')
            } catch (err) {
                expect(err.type).toEqual('error-promoting-function');
                expect(err.cause).toEqual('Request-reply function destroy hook must be a function. Found: object')
            }
        });
    });

    describe('when called with functions with an argument transformer => ', () => {
        it('rejects invalid argument transformers', () => {
            try {
                const someFunction = require('./helpers/transformers/invalid-argument-transformers-request-reply-function');
                promoteFunction(someFunction);
                fail('should fail')
            } catch (err) {
                expect(err.type).toEqual('error-argument-transformer');
                expect(err.cause).toEqual('Argument transformers must be declared in an array. Found: string')
            }
        });

        it('rejects argument transformers with invalid arity', () => {
            try {
                const someFunction = require('./helpers/transformers/invalid-argument-transformer-count-request-reply-function');
                promoteFunction(someFunction);
                fail('should fail')
            } catch (err) {
                expect(err.type).toEqual('error-argument-transformer');
                expect(err.cause).toEqual('Request-reply function must declare exactly 1 argument transformer. Found 2')
            }
        });
    });
});
