module.exports = (firstOutputSignal, secondOutputSignal) => {

    if (!firstOutputSignal.getStart && !firstOutputSignal.getData &&
        !secondOutputSignal.getStart && !secondOutputSignal.getData) {
        // pass on to other equality tester
        return undefined;
    }

    if (xor(firstOutputSignal.getStart, secondOutputSignal.getStart)) {
        return false;
    }
    if (xor(firstOutputSignal.getData, secondOutputSignal.getData)) {
        return false;
    }

    if (firstOutputSignal.getStart) {
        const firstContentTypes = firstOutputSignal.getStart().getExpectedcontenttypesList();
        const secondContentTypes = secondOutputSignal.getStart().getExpectedcontenttypesList();
        return firstContentTypes === secondContentTypes;
    }

    const firstData = firstOutputSignal.getData();
    const secondData = secondOutputSignal.getData();

    return firstData.getResultindex() === secondData.getResultindex() &&
        arrayEqual(firstData.getHeadersMap().toArray(), secondData.getHeadersMap().toArray()) &&
        firstData.getContenttype() === secondData.getContenttype() &&
        typedArrayEqual(firstData.getPayload(), secondData.getPayload());
};

const xor = (expr1, expr2) => {
    return expr1 && !expr2 || !expr1 && expr2;
};

const arrayEqual = (array1, array2) => {
    if (array1.length !== array2.length) {
        return false;
    }
    for (let i = 0; i < array1.length; i++) {
        const item1 = array1[i];
        const item2 = array2[i];
        if (Array.isArray(item1) && Array.isArray(item2)) {
            if (!arrayEqual(item1, item2)) {
                return false;
            }
        } else if (item1 !== item2) {
            return false;
        }
    }
    return true;
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
