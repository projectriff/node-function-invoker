const fs = require("fs");
const { Console } = require("console");

const originalConsole = console;
const outputFilePath = "./tests.out";
const errorFilePath = "./tests.err";

class MutedConsoleReporter {
    constructor() {
        this.out = fs.createWriteStream(outputFilePath, {
            flags: "as",
            autoClose: true,
        });
        this.err = fs.createWriteStream(errorFilePath, {
            flags: "as",
            autoClose: true,
        });
        this.console = new Console({ stdout: this.out, stderr: this.err });
    }

    jasmineStarted() {
        fs.truncateSync(outputFilePath);
        fs.truncateSync(errorFilePath);
    }

    suiteStarted() {
        console = this.console;
    }

    specStarted(result) {
        this.out.write(`# ${result.fullName}\n`);
        this.err.write(`# ${result.fullName}\n`);
    }

    suiteDone() {
        console = originalConsole;
    }

    jasmineDone() {
        this.out.close();
        this.err.close();
    }
}

module.exports = MutedConsoleReporter;
