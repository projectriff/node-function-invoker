module.exports = (outputSignal1, outputSignal2) => {
    if (!outputSignal1.data && !outputSignal2.data) {
        // pass on to other equality tester
        return undefined;
    }

    if (xor(outputSignal1.data, outputSignal2.data)) {
        return false;
    }

    const data1 = outputSignal1.data;
    const data2 = outputSignal2.data;

    return (
        data1.resultIndex === data2.resultIndex &&
        JSON.stringify(data1.headers || {}) ===
            JSON.stringify(data2.headers || {}) &&
        data1.contentType === data2.contentType &&
        typedArrayEqual(data1.payload, data2.payload)
    );
};

const xor = (expr1, expr2) => {
    return (expr1 && !expr2) || (!expr1 && expr2);
};

const typedArrayEqual = (array1, array2) => {
    if (array1.byteLength !== array2.byteLength) {
        return false;
    }
    for (let i = 0; i < array1.byteLength; i++) {
        if (array1[i] !== array2[i]) {
            return false;
        }
    }
    return true;
};
