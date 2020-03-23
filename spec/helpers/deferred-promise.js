module.exports = class DeferredPromiseWrapper {
    constructor() {
        this._promise = new Promise((resolve) => {
            this._resolve = resolve;
        });
    }

    getPromise() {
        return this._promise;
    }

    resolveNow() {
        this._resolve();
    }
};
