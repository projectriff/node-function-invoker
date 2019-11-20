const stats = require('simple-statistics');
const miss = require('mississippi');

module.exports = (inputs, outputs) => {
    let n = 0;
    let mean = 0;
    const meanStream = miss.through.obj((newValue, _, callback) => {
        mean = stats.addToMean(mean, n++, newValue);
        callback(null, mean);
    });
    inputs.$order[0].pipe(meanStream).pipe(outputs.$order[0]);
};
module.exports.$interactionModel = 'node-streams';
