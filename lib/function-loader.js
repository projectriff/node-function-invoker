module.exports = (uri) => {
    if (typeof uri === 'undefined' || uri === '') {
        throw 'uri is not set or empty. Aborting function loading.'
    }

    return (fn => {
        if (fn.__esModule && typeof fn.default === 'function') {
            // transpiled ES Module interop
            // see https://2ality.com/2017/01/babel-esm-spec-mode.html
            return fn.default;
        }
        return fn;
    })(require(uri));
};
