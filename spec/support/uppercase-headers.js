module.exports = headers => {
    return headers.getValue('content-type').toUpperCase();
};
module.exports.$argumentType = 'headers';
