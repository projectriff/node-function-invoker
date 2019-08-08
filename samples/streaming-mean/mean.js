const stats = require('simple-statistics');
const miss = require('mississippi');

module.exports = (input, output) => {
    let n = 0;
    let mean = 0;
    const meanStream = miss.through.obj((newValue, _, callback) => {
        mean = stats.addToMean(mean, n++, newValue);
        callback(null, mean);
    });
    input.pipe(meanStream).pipe(output);
};
module.exports.$interactionModel = 'node-streams';
