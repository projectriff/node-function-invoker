module.exports = (inputStream, outputStream) => {
    inputStream.pipe(outputStream);
};

module.exports.$destroy = async () => {
    return new Promise(resolve => {
        setTimeout(resolve, 500);
    });
};
