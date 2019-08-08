module.exports = (inputStream, outputStream) => {
    inputStream.pipe(outputStream);
};

module.exports.$init = async () => {
    return new Promise(() => {
        throw new Error('oopsie');
    });
};
