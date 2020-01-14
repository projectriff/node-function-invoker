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

/*
 * The streaming pipeline is a Writable stream and is expected to be piped to, from a Readable "source" stream of
 * input signals.
 *
 * It sets up the creates the corresponding streaming user function's input and output streams and invokes the user
 * function upon start signal reception.
 *
 * It forwards input signals from the "source" to the matching input stream.
 * It forwards output signals from the output streams to the destination stream.
 * The user function is a black box that is given two arguments: the input streams and the output streams.
 *
 * <pre>
 *          |
 *          |
 *          |             |->(input 1)-|                      |-> (output 1) -|
 * (source)--->(pipeline)-|->(input 2)-|-?->(user function)-?-|-> (output 2) -|->(destination)
 *          |             | ...       -|                      | ...          -|
 *          |             |->(input n)-|                      |-> (output m) -|
 *          |
 * </pre>
 *
 * The pipeline closes itself after the last input stream ends.
 * The destination is closed by the pipeline after the last output stream ends.
 *
 * References:
 *  - ./lib/riff-rpc.proto
 *  - https://github.com/projectriff/invoker-specification/
 *  - https://nodejs.org/docs/latest/api/stream.html
 */
module.exports = class StreamingPipeline extends Writable {

    constructor(userFunction, destinationStream, options) {
        super(Object.assign(options, {autoDestroy: true})); // automatically closes upon error
        if (userFunction.$interactionModel !== 'node-streams') {
            throw new Error(`SteamingPipeline expects a function with "node-streams" interaction model, but was "${userFunction.$interactionModel}" instead`);
        }

        validateTransformers(userFunction['$argumentTransformers']);
        this._options = options;
        this._hookTimeoutInMs = options['hookTimeoutInMs'] || 10000;
        this._userFunction = userFunction;
        this._destinationStream = destinationStream;
        this._startProcessed = false;
        this._functionInputs = [];
        this._finishedInputs = 0;
        this._functionOutputs = [];
        this._finishedOutputs = 0;
        this._streamMetadata = {};
        this._errored = false;
        this.on('error', () => {
            this._errored = true;
            this._endInputs();
        });
        this.on('finish', () => {
            if (!this._errored) {
                this._endInputs();
            }
        });
        this._invokeHooks();
        logger('Streaming pipeline initialized');
    }

    _write(inputSignal, _, callback) {
        logger('Input signal received');
        if (!inputSignal || !inputSignal['hasStart'] || !inputSignal['hasData']) {
            callback(new RiffError(
                'error-streaming-input-invalid',
                `invalid input type ${Object.prototype.toString.call(inputSignal)}`));
            return;
        }
        if (!inputSignal.hasStart() && !inputSignal.hasData()) {
            callback(new RiffError(
                'error-streaming-input-invalid',
                'input is neither a start nor a data signal'));
            return;
        }

        if (inputSignal.hasStart()) {
            const startSignal = inputSignal.getStart();
            const outputContentTypes = startSignal.getExpectedcontenttypesList();
            const inputStreamNames = startSignal.getInputnamesList();
            const outputStreamNames = startSignal.getOutputnamesList();
            if (this._startProcessed) {
                callback(new RiffError(
                    'error-streaming-too-many-starts',
                    'start signal has already been received. ' +
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
                    `invalid output count ${actualOutputCount}: function has only ${expectedOutputCount} output(s)`));
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
            this._startProcessed = true;
            logger('Ready to process data');
        } else {
            if (!this._startProcessed) {
                callback(new RiffError(
                    'error-streaming-missing-start',
                    'start signal has not been received or processed yet. Rejecting data signal'));
                return;
            }
            const inputIndex = inputSignal.getData().getArgindex();
            const inputUnmarshaller = this._functionInputs[inputIndex];
            inputUnmarshaller.write(inputSignal);
            callback();
        }
    }

    _invokeHooks() {
        const hookResolve = (hookName) => {
            return () => {
                logger(`${hookName} hook called`)
            }
        };
        const emitErrorOnReject = (err) => {
            this.emit('error', err)
        };
        if (typeof this._userFunction['$init'] === 'function') {
            logger(`Calling $init hook with a max timeout of ${this._hookTimeoutInMs}ms `);
            guardWithTimeout(this._userFunction.$init, this._hookTimeoutInMs)
                .then(hookResolve('$init'))
                .catch(emitErrorOnReject);
        }
        if (typeof this._userFunction['$destroy'] === 'function') {
            this._destinationStream.on('finish', () => {
                logger(`Calling $destroy hook with a max timeout of ${this._hookTimeoutInMs}ms `);
                guardWithTimeout(this._userFunction.$destroy, this._hookTimeoutInMs)
                    .then(hookResolve('$destroy'))
                    .catch(emitErrorOnReject);
            });
        }
    }

    /*
     * Instantiate n input unmarshallers (where n := number of function input streams).
     * They are the user function input streams.
     *
     * The streaming pipeline ends itself when the last unmarshaller ends.
     */
    _wireInputs(transformers) {
        const inputCount = transformers.length;
        logger(`Wiring ${inputCount} input stream(s)`);
        for (let i = 0; i < inputCount; i++) {
            const unmarshaller = new InputUnmarshaller(this._options, transformers[i]);
            unmarshaller.on('error', (err) => {
                logger(`error from unmarshaller: ${err.toString()}`);
                this.emit('error', err);
            });
            // TODO: revisit why this is still needed
            unmarshaller.on('end', () => {
                this._finishedInputs++;
                if (this._finishedInputs === this._functionInputs.length) {
                    logger('Last input stream closing: ending pipeline now');
                    this._functionInputs = [];
                    this.end();
                }
            });
            this._functionInputs[i] = unmarshaller;
        }
    }

    /*
     * Instantiate m output unmarshallers (where m := number of function output streams).
     * They are the function output streams.
     *
     * The destination stream is ended when the last unmarshaller ends.
     */
    _wireOutputs(outputContentTypes) {
        const outputCount = outputContentTypes.length;
        logger(`Wiring ${outputCount} output stream(s)`);
        for (let i = 0; i < outputCount; i++) {
            const marshaller = new OutputMarshaller(i, outputContentTypes[i], this._options);
            marshaller.pipe(this._destinationStream, {end: false});
            marshaller.on('error', (err) => {
                logger(`error from marshaller: ${err.toString()}`);
                this.emit('error', err);
            });
            marshaller.on('finish', () => {
                this._finishedOutputs++;
                if (this._finishedOutputs === this._functionOutputs.length) {
                    logger('Last output stream closing: ending destination stream');
                    this._functionOutputs = [];
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
            callback();
        } catch (err) {
            callback(new RiffError('streaming-function-runtime-error', err));
        }
    }

    _endInputs() {
        this._functionInputs.forEach((fi) => fi.emit('end'));
    }
};
