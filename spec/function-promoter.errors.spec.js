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
});
