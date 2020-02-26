module.exports = () => {};
module.exports.$interactionModel = "node-streams";

module.exports.$init = jasmine.createSpy("$init");

module.exports.$destroy = async () => {
    return new Promise(resolve => {
        setTimeout(resolve, 500);
    });
};
