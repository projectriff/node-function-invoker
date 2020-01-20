const {Writable} = require('stream');
const validateArgumentTransformers = require('./argument-transformer-validator');
const RiffError = require('./riff-error');
const OutputMarshaller = require('./output-marshaller');
const logger = require('util').debuglog('riff');
const InputUnmarshaller = require('./input-unmarshaller');
const {guardWithTimeout} = require('./async');

const toObject = (parameters, streamNames) => {
    return parameters.reduce((result, stream, i) => {
        result[streamNames[i]] = stream;
        return result
    }, {$order: [...parameters]})
};

const validateTransformers = (transformers) => {
    if (typeof transformers === 'undefined') {
        return;
    }
    validateArgumentTransformers(transformers);
};

module.exports = class StreamingPipeline extends Writable {

    constructor(userFunction, destinationStream, options) {
        super(options);
        if (userFunction.$interactionModel !== 'node-streams') {
            throw new Error(`SteamingPipeline expects a function with "node-streams" interaction model, but was "${userFunction.$interactionModel}" instead`);
        }

        validateTransformers(userFunction['$argumentTransformers']);
        this._options = options;
        this._hookTimeoutInMs = options['hookTimeoutInMs'] || 10000;
        this._userFunction = userFunction;
        this._destinationStream = destinationStream;
        this._startReceived = false;
        this._functionInputs = [];
        this._functionOutputs = [];
        this._finishedOutputs = 0;
        this._streamMetadata = {};
        this._errored = false;
        this.on('error', (err) => {
            logger(`Error occurred - Ending streams and pipeline now: ${err.toString()}`);
            this._errored = true;
            this._endOutputs();
            this._destinationStream.end();
            this._endInputs();
            this.end();
        });
        this.on('finish', () => {
            logger('Pipeline ended - Ending input streams');
            if (!this._errored) {
                this._endInputs();
            }
        });
        this._invokeHooks();
        logger('Streaming pipeline initialized');
    }

    _invokeHooks() {
        if (typeof this._userFunction['$init'] === 'function') {
            logger(`Calling $init hook with a timeout of ${this._hookTimeoutInMs}ms `);
            guardWithTimeout(this._userFunction.$init, this._hookTimeoutInMs)
                .then(() => logger(`$init hook called`))
                .catch((err) => this.emit('error', err));
        }
        if (typeof this._userFunction['$destroy'] === 'function') {
            this._destinationStream.on('finish', () => {
                logger(`Calling $destroy hook with a timeout of ${this._hookTimeoutInMs}ms `);
                guardWithTimeout(this._userFunction.$destroy, this._hookTimeoutInMs)
                    .then(() => logger(`$destroy hook called`))
                    .catch((err) => this.emit('error', err));
            });
        }
    }

    _endInputs() {
        this._functionInputs.forEach((fi) => fi.end());
    }

    _endOutputs() {
        this._functionOutputs.forEach((fi) => fi.end());
    }

    _write(inputSignal, _, callback) {
        logger('Input signal received');
        if (!inputSignal || !inputSignal['hasStart'] || !inputSignal['hasData']) {
            callback(new RiffError(
                'error-streaming-input-invalid',
                `Invalid input type ${Object.prototype.toString.call(inputSignal)}`));
            return;
        }
        if (!inputSignal.hasStart() && !inputSignal.hasData()) {
            callback(new RiffError(
                'error-streaming-input-invalid',
                'Input is neither a start nor a data signal'));
            return;
        }

        if (inputSignal.hasStart()) {
            const startSignal = inputSignal.getStart();
            const outputContentTypes = startSignal.getExpectedcontenttypesList();
            const inputStreamNames = startSignal.getInputnamesList();
            const outputStreamNames = startSignal.getOutputnamesList();
            if (this._startReceived) {
                callback(new RiffError(
                    'error-streaming-too-many-starts',
                    'Start signal has already been received. ' +
                    `Rejecting start signal with: output content types: [${outputContentTypes}], ` +
                    `input names: [${inputStreamNames}], ` +
                    `output names: [${outputStreamNames}]`));

                return;
            }
            this._streamMetadata.inputs = inputStreamNames;
            this._streamMetadata.outputs = outputStreamNames;
            const actualOutputCount = outputContentTypes.length;
            const expectedOutputCount = this._streamMetadata.outputs.length;
            if (actualOutputCount !== expectedOutputCount) {
                callback(new RiffError(
                    'error-streaming-invalid-output-count',
                    `Invalid output count ${actualOutputCount}: function has only ${expectedOutputCount} output(s)`));
                return;
            }
            logger(`Start signal with: output content types: ${outputContentTypes}, ` +
                `input names: [${this._streamMetadata.inputs}], ` +
                `output names: [${this._streamMetadata.outputs}]`);

            const inputCount = this._streamMetadata.inputs.length;
            let transformers = this._userFunction['$argumentTransformers'] || Array(inputCount);
            if (transformers.length !== inputCount) {
                const transformerCount = transformers.length;
                logger(`Wrong number of argument transformers: ${transformerCount} instead of ${inputCount}`);
                callback(new RiffError(
                    'error-argument-transformer',
                    `Function must declare exactly ${inputCount} argument transformer(s). Found ${transformerCount}`));
                return false;
            }
            this._wireInputs(transformers);
            this._wireOutputs(outputContentTypes);
            this._invoke(callback);
            this._startReceived = true;
            logger('Ready to process data');
        } else {
            if (!this._startReceived) {
                callback(new RiffError(
                    'error-streaming-missing-start',
                    'Start signal has not been received or processed yet. Rejecting data signal'));
                return;
            }
            const inputIndex = inputSignal.getData().getArgindex();
            const inputUnmarshaller = this._functionInputs[inputIndex];
            inputUnmarshaller.write(inputSignal);
            callback();
        }
    }

    _wireInputs(transformers) {
        const inputCount = transformers.length;
        logger(`Wiring ${inputCount} input stream(s)`);
        for (let i = 0; i < inputCount; i++) {
            const unmarshaller = new InputUnmarshaller(this._options, transformers[i]);
            unmarshaller.on('error', (err) => {
                logger(`Error from unmarshaller: ${err.toString()}`);
                this.emit('error', err);
            });
            this._functionInputs[i] = unmarshaller;
        }
    }

    _wireOutputs(outputContentTypes) {
        const outputCount = outputContentTypes.length;
        logger(`Wiring ${outputCount} output stream(s)`);
        for (let i = 0; i < outputCount; i++) {
            const marshaller = new OutputMarshaller(i, outputContentTypes[i], this._options);
            marshaller.pipe(this._destinationStream, {end: false});
            marshaller.on('error', (err) => {
                logger(`Error from marshaller: ${err.toString()}`);
                this.emit('error', err);
            });
            marshaller.on('finish', () => {
                this._finishedOutputs++;
                if (this._finishedOutputs === this._functionOutputs.length) {
                    logger('Last output stream closing: ending destination stream');
                    this._destinationStream.end();
                }
            });
            this._functionOutputs[i] = marshaller;
        }
    }

    _invoke(callback) {
        try {
            const inputStreams = toObject(this._functionInputs, this._streamMetadata.inputs);
            const outputStreams = toObject(this._functionOutputs, this._streamMetadata.outputs);
            this._userFunction.apply(null, [inputStreams, outputStreams]);
        } catch (err) {
            callback(new RiffError('streaming-function-runtime-error', err));
            return;
        }
        callback();
    }
};
