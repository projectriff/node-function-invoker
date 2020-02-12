module.exports = () => {};
module.exports.$interactionModel = "node-streams";

module.exports.$init = async () => {
    return new Promise(resolve => {
        setTimeout(resolve, 500);
    });
};

module.exports.$destroy = jasmine.createSpy("$destroy");
