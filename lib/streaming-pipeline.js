const {Writable} = require('stream');
const validateArgumentTransformers = require('./argument-transformer-validator');
const RiffError = require('./riff-error');
const OutputMarshaller = require('./output-marshaller');
const logger = require('util').debuglog('riff');
const InputUnmarshaller = require('./input-unmarshaller');
const {guardWithTimeout} = require('./async');

const toObject = (parameters) => {
    const result = {};
    for (let i = 0; i < parameters.length; i++) {
        result[`${i}`] = parameters[i];
    }
    return result;
};

const validateArity = (arity) => {
    if (typeof arity === 'undefined') {
        throw new RiffError('error-function-arity', 'Cannot determine function arity. Aborting now');
    }
    if (typeof arity !== 'number' || Math.floor(arity) !== arity || arity <= 0) {
        throw new RiffError('error-function-arity', `Function arity must be an integer >= 1, received: ${arity}. Aborting now`);
    }
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
        if(userFunction.$interactionModel !== 'node-streams') {
            throw new Error(`SteamingPipeline expects a function with "node-streams" interaction model, but was "${userFunction.$interactionModel}" instead`);
        }

        const arity = userFunction['$arity'];
        validateArity(arity);
        validateTransformers(userFunction['$argumentTransformers']);
        this._options = options;
        this._hookTimeoutInMs = options['hookTimeoutInMs'] || 10000;
        this._userFunction = userFunction;
        this._destinationStream = destinationStream;
        this._startReceived = false;
        this._functionInputs = [];
        this._functionOutputs = [];
        this._finishedOutputs = 0;
        this.on('finish', () => {
            logger('Ending input streams');
            this._endInputs();
        });
        this.on('error', () => {
            logger('Error occurred - ending pipeline now');
            this.end();
        });
        this._invokeHooks();
        logger('Streaming pipeline initialized');
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
                    .then(hookResolve('$init'))
                    .catch(emitErrorOnReject);
            });
        }
    }

    _endInputs() {
        this._functionInputs.forEach((fi) => fi.emit('end'));
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
            const outputContentTypes = inputSignal.getStart().getExpectedcontenttypesList();
            if (this._startReceived) {
                callback(new RiffError(
                    'error-streaming-too-many-starts',
                    `start signal has already been received. Rejecting new start signal with content types [${outputContentTypes.join()}]`));
                return;
            }
            const outputCount = outputContentTypes.length;
            if (outputCount > this.parameterCount) {
                callback(new RiffError(
                    'error-streaming-invalid-output-count',
                    `invalid output count ${outputCount}: function has only ${this.parameterCount} parameter(s)`));
                return;
            }
            logger(`Start signal received: ${outputContentTypes}`);
            const inputCount = this.parameterCount - outputContentTypes.length;
            let transformers = this._userFunction['$argumentTransformers'] || Array(inputCount);
            if (transformers.length !== inputCount) {
                const transformerCount = transformers.length;
                logger(`Wrong number of argument transformers: ${transformerCount} instead of ${inputCount}`);
                callback(new RiffError(
                    'error-argument-transformer',
                    `Function must declare exactly ${inputCount} argument transformer(s). Found ${transformerCount}`));
                return false;
            }
            this._wireInputs(inputCount, transformers);
            this._wireOutputs(outputContentTypes);
            this._invoke(callback);
            this._startReceived = true;
            logger('Ready to process data');
        } else {
            if (!this._startReceived) {
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

    get parameterCount() {
        return this._userFunction.$arity;
    }

    _wireInputs(inputCount, transformers) {
        logger(`Wiring ${inputCount} input stream(s)`);
        for (let i = 0; i < inputCount; i++) {
            const inputUnmarshaller = new InputUnmarshaller(this._options, transformers[i]);
            inputUnmarshaller.on('error', (err) => {
                logger('Error from unmarshaller');
                this.emit('error', err);
            });
            this._functionInputs[i] = inputUnmarshaller;
        }
    }

    _wireOutputs(outputContentTypes) {
        const outputCount = outputContentTypes.length;
        logger(`Wiring ${outputCount} output stream(s)`);
        for (let i = 0; i < outputCount; i++) {
            const marshaller = new OutputMarshaller(i, outputContentTypes[i], this._options);
            marshaller.pipe(this._destinationStream, {end: false});
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
            const inputStreams = toObject(this._functionInputs);
            const outputStreams = toObject(this._functionOutputs);
            this._userFunction.apply(null, [inputStreams, outputStreams]);
            callback();
        } catch (err) {
            callback(new RiffError('streaming-function-runtime-error', err));
        }
    }
};
