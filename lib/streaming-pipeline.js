const {Writable} = require('stream');
const RiffError = require('./riff-error');
const OutputMarshaller = require('./output-marshaller');
const logger = require('util').debuglog('riff');
const InputUnmarshaller = require('./input-unmarshaller');
const {guardWithTimeout} = require('./async');

module.exports = class StreamingPipeline extends Writable {

    constructor(userFunction, destinationStream, options) {
        super(options);
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
            this.end(); // TODO: investigate why 'finish' event is not fired after this call
        });
        this._invokeHooks();
        logger('Streaming pipeline initialized');
    }

    _invokeHooks() {
        const hookResolve = (hookName) => {
            return (timerId) => {
                clearTimeout(timerId);
                logger(`${hookName} hook called`)
            }
        };
        const emitErrorOnReject = (err) => {
            this.emit('error', err)
        };
        if (typeof this._userFunction['$init'] === 'function') {
            logger(`Calling $init hook with a max timeout of ${this._hookTimeoutInMs}ms `);
            guardWithTimeout(this._userFunction['$init'], this._hookTimeoutInMs)
                .then(hookResolve('$init'))
                .catch(emitErrorOnReject);
        }
        if (typeof this._userFunction['$destroy'] === 'function') {
            this._destinationStream.on('finish', () => {
                logger(`Calling $destroy hook with a max timeout of ${this._hookTimeoutInMs}ms `);
                guardWithTimeout(this._userFunction['$destroy'], this._hookTimeoutInMs)
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
            this.emit('error', new RiffError(
                'error-streaming-input-type-invalid',
                `invalid input type ${Object.prototype.toString.call(inputSignal)}`));
            return;
        }
        if (!inputSignal.hasStart() && !inputSignal.hasData()) {
            this.emit('error', new RiffError(
                'error-streaming-input-type-unsupported',
                'input is neither a start nor a data signal'));
            return;
        }

        if (inputSignal.hasStart()) {
            const outputContentTypes = inputSignal.getStart().getExpectedcontenttypesList();
            if (this._startReceived) {
                this.emit('error', new RiffError(
                    'error-streaming-too-many-starts',
                    `start signal has already been received. Rejecting new start signal with content types [${outputContentTypes.join()}]`));
                return;
            }
            const outputCount = outputContentTypes.length;
            if (outputCount > this.parameterCount) {
                this.emit('error', new RiffError(
                    'error-streaming-invalid-output-count',
                    `invalid output count ${outputCount}: function has only ${this.parameterCount} parameter(s)`));
                return;
            }
            logger(`Start signal received: ${outputContentTypes}`);
            this._wireInputs(this.parameterCount - outputContentTypes.length);
            this._wireOutputs(outputContentTypes);
            this._invoke(callback);
            this._startReceived = true;
            logger('Ready to process data');
        } else {
            if (!this._startReceived) {
                this.emit('error', new RiffError(
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
        return this._userFunction.length;
    }

    _wireInputs(inputCount) {
        logger(`Wiring ${inputCount} input stream(s)`);
        for (let i = 0; i < inputCount; i++) {
            const inputUnmarshaller = new InputUnmarshaller(this._options);
            inputUnmarshaller.on('error', (err) => {
                logger('error from unmarshaller');
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
            this._userFunction.apply(null, [...this._functionInputs, ...this._functionOutputs]);
            callback();
        } catch (err) {
            this.emit('error', new RiffError('streaming-function-runtime-error', err));
        }
    }
};
