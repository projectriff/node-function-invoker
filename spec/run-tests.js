const Jasmine = require("jasmine");
const MutedConsoleReporter = require("./reporters/muted-console-reporter");

const jasmine = new Jasmine();
jasmine.loadConfigFile("./spec/support/jasmine.json");
jasmine.addReporter(new MutedConsoleReporter());
jasmine.execute();
