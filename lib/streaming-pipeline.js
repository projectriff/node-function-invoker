const {Writable} = require('stream');
const validateArgumentTransformers = require('./argument-transformer-validator');
const RiffError = require('./riff-error');
const OutputMarshaller = require('./output-marshaller');
const logger = require('util').debuglog('riff');
const InputUnmarshaller = require('./input-unmarshaller');
const {guardWithTimeout} = require('./async');
const grpc = require('grpc');
const {canMarshall, determineContentTypes} = require('./content-negotiation');

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

    constructor(userFunction, grpcStream, options) {
        super(options);
        if (userFunction.$interactionModel !== 'node-streams') {
            throw new Error(`SteamingPipeline expects a function with "node-streams" interaction model, but was "${userFunction.$interactionModel}" instead`);
        }

        validateTransformers(userFunction['$argumentTransformers']);
        this._options = options;
        this._hookTimeoutInMs = options['hookTimeoutInMs'] || 10000;
        this._userFunction = userFunction;
        this._destinationStream = grpcStream;
        this._startReceived = false;
        this._functionInputs = [];
        this._functionOutputs = [];
        this._finishedOutputs = 0;
        this._streamMetadata = {};
        this.on('finish', () => {
            logger('Ending input streams');
            this._endInputs();
        });
        this.on('error', (err) => {
            logger('Error occurred - canceling invocation now');
            this._cancelCall(grpcStream, err);
        });
        this._invokeHooks();
        logger('Streaming pipeline initialized');
    }

    _cancelCall(grpcStream, err) {
        switch (err.type) {
            case 'error-streaming-invalid-input-signal':
            case 'error-streaming-invalid-output-count':
            case 'error-streaming-missing-start-signal':
            case 'error-streaming-too-many-start-signals':
                grpcStream.call.cancelWithStatus(
                    grpc.status.UNKNOWN,
                    `Invoker: Protocol Violation: ${err.cause}`
                );
                break;
            case 'error-output-content-type-unsupported':
                grpcStream.call.cancelWithStatus(
                    grpc.status.INVALID_ARGUMENT,
                    `Invoker: Not Acceptable: ${err.cause}`
                );
                break;
            case 'error-input-content-type-unsupported':
                grpcStream.call.cancelWithStatus(
                    grpc.status.INVALID_ARGUMENT,
                    `Invoker: Unsupported Media Type: ${err.cause}`
                );
                break;
            case 'streaming-function-runtime-error':
                grpcStream.call.cancelWithStatus(
                    grpc.status.UNKNOWN,
                    `Invoker: Unexpected Invocation Error: ${err.cause.message}`
                );
                break;
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

    _endInputs() {
        this._functionInputs.forEach((fi) => fi.emit('end'));
    }

    _write(inputSignal, _, callback) {
        logger('Input signal received');
        if (!inputSignal || !inputSignal['hasStart'] || !inputSignal['hasData']) {
            callback(new RiffError(
                'error-streaming-invalid-input-signal',
                `Invalid input signal type ${Object.prototype.toString.call(inputSignal)}`));
            return;
        }
        if (!inputSignal.hasStart() && !inputSignal.hasData()) {
            callback(new RiffError(
                'error-streaming-invalid-input-signal',
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
                    'error-streaming-too-many-start-signals',
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
                return;
            }

            const negotiatedOutputContentTypes = outputContentTypes.map(ct => determineContentTypes(ct).accept);
            for (let i = 0; i < negotiatedOutputContentTypes.length; i++) {
                const contentType = negotiatedOutputContentTypes[i];
                if (!canMarshall(contentType)) {
                    logger(`Unsupported content type ${contentType} for output #${i}`);
                    callback(new RiffError(
                        'error-output-content-type-unsupported',
                        `Unsupported content-type '${outputContentTypes[i]}' for output #${i}`));
                    return;
                }
            }

            this._wireInputs(transformers);
            this._wireOutputs(negotiatedOutputContentTypes);
            this._invoke(callback);
            this._startReceived = true;
            logger('Ready to process data');
        } else {
            if (!this._startReceived) {
                callback(new RiffError(
                    'error-streaming-missing-start-signal',
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
            const inputUnmarshaller = new InputUnmarshaller(this._options, transformers[i]);
            inputUnmarshaller.on('error', (err) => {
                logger(`error from unmarshaller: ${err.toString()}`);
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
            const inputStreams = toObject(this._functionInputs, this._streamMetadata.inputs);
            const outputStreams = toObject(this._functionOutputs, this._streamMetadata.outputs);
            this._userFunction.apply(null, [inputStreams, outputStreams]);
            callback();
        } catch (err) {
            callback(new RiffError('streaming-function-runtime-error', err));
        }
    }
};
