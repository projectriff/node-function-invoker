const RiffError = require('../lib/riff-error');
const {guardWithTimeout} = require('../lib/hooks');

describe('hook utilities =>', () => {

    describe('timeout guard =>', () => {
        const hookExecutionTimeMs = 100;

        it('successfully executes hooks', async () => {
            const fn = jasmine.createSpy('hook function');
            const hook = () => new Promise(resolve => setTimeout(() => {
                fn();
                resolve();
            }, hookExecutionTimeMs));

            await guardWithTimeout(hook, 2 * hookExecutionTimeMs);

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('accepts undefined hooks as well', async () => {
            await expectAsync(guardWithTimeout(undefined, 2 * hookExecutionTimeMs)).toBeResolved();
        });

        it('guards hooks against timeouts', async () => {
            const fn = jasmine.createSpy('hook function');
            const hook = () => new Promise(resolve => setTimeout(() => {
                fn();
                resolve();
            }, hookExecutionTimeMs));

            await expectAsync(guardWithTimeout(hook, hookExecutionTimeMs / 5))
                .toBeRejectedWithError(
                    RiffError,
                    'error-hook-timeout: The hook took too long to run (timeout: 20ms). Aborting now'
                );
        });
    });
});
