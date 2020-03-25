const { Writable } = require("stream");
const validateArgumentTransformers = require("./argument-transformer-validator");
const RiffError = require("./riff-error");
const OutputMarshaller = require("./output-marshaller");
const logger = require("util").debuglog("riff");
const InputUnmarshaller = require("./input-unmarshaller");
const grpc = require("grpc");
const errors = require("./errors");
const { canMarshall, determineContentTypes } = require("./content-negotiation");

const toObject = (parameters, streamNames) => {
    return parameters.reduce(
        (result, stream, i) => {
            result[streamNames[i]] = stream;
            return result;
        },
        { $order: [...parameters] }
    );
};

const validateTransformers = (transformers) => {
    if (typeof transformers === "undefined") {
        return;
    }
    validateArgumentTransformers(transformers);
};

module.exports = class StreamingPipeline extends Writable {
    constructor(userFunction, grpcStream) {
        super({ objectMode: true });
        if (userFunction.$interactionModel !== "node-streams") {
            throw new Error(
                `SteamingPipeline expects a function with "node-streams" interaction model, but was "${userFunction.$interactionModel}" instead`
            );
        }

        validateTransformers(userFunction["$argumentTransformers"]);
        this._userFunction = userFunction;
        this._destinationStream = grpcStream;
        this._startReceived = false;
        this._functionInputs = [];
        this._functionOutputs = [];
        this._finishedOutputs = 0;
        this._streamMetadata = {};
        this.on("finish", () => {
            logger("Ending input streams");
            this._endInputs();
        });
        this.on("error", (err) => {
            logger("Error occurred - canceling invocation now");
            this._cancelCall(grpcStream, err);
        });
        logger("Streaming pipeline initialized");
    }

    _cancelCall(grpcStream, err) {
        switch (err.type) {
            case errors.types.PROTOCOL_INVALID_INPUT_SIGNAL:
            case errors.types.PROTOCOL_OUTPUT_COUNT_MISMATCH:
            case errors.types.PROTOCOL_MISSING_START_SIGNAL:
            case errors.types.PROTOCOL_TOO_MANY_START_SIGNALS:
                grpcStream.call.cancelWithStatus(
                    grpc.status.UNKNOWN,
                    `Invoker: Protocol Violation: ${err.cause}`
                );
                break;
            case errors.types.UNSUPPORTED_OUTPUT_CONTENT_TYPE:
                grpcStream.call.cancelWithStatus(
                    grpc.status.INVALID_ARGUMENT,
                    `${errors.reserved_prefixes.NOT_ACCEPTABLE}: ${err.cause}`
                );
                break;
            case errors.types.UNSUPPORTED_INPUT_CONTENT_TYPE:
                grpcStream.call.cancelWithStatus(
                    grpc.status.INVALID_ARGUMENT,
                    `${errors.reserved_prefixes.UNSUPPORTED_MEDIA_TYPE}: ${err.cause}`
                );
                break;
            case errors.types.STREAMING_FUNCTION_RUNTIME:
                grpcStream.call.cancelWithStatus(
                    grpc.status.UNKNOWN,
                    `Invoker: Unexpected Invocation Error: ${err.cause.message}`
                );
                break;
            default:
                grpcStream.call.cancelWithStatus(
                    grpc.status.UNKNOWN,
                    `Invoker: Unexpected Error: ${
                        err.cause ? err.cause : err.message ? err.message : err
                    }`
                );
        }
    }

    _endInputs() {
        this._functionInputs.forEach((fi) => fi.emit("end"));
    }

    _write(inputSignal, _, callback) {
        logger("Input signal received");
        if (
            !inputSignal ||
            !inputSignal["hasStart"] ||
            !inputSignal["hasData"]
        ) {
            callback(
                new RiffError(
                    errors.types.PROTOCOL_INVALID_INPUT_SIGNAL,
                    `Invalid input signal type ${Object.prototype.toString.call(
                        inputSignal
                    )}`
                )
            );
            return;
        }
        if (!inputSignal.hasStart() && !inputSignal.hasData()) {
            callback(
                new RiffError(
                    errors.types.PROTOCOL_INVALID_INPUT_SIGNAL,
                    "Input is neither a start nor a data signal"
                )
            );
            return;
        }

        if (inputSignal.hasStart()) {
            const startSignal = inputSignal.getStart();
            const outputContentTypes = startSignal.getExpectedcontenttypesList();
            const inputStreamNames = startSignal.getInputnamesList();
            const outputStreamNames = startSignal.getOutputnamesList();
            if (this._startReceived) {
                callback(
                    new RiffError(
                        errors.types.PROTOCOL_TOO_MANY_START_SIGNALS,
                        "Start signal has already been received. " +
                            `Rejecting start signal with: output content types: [${outputContentTypes}], ` +
                            `input names: [${inputStreamNames}], ` +
                            `output names: [${outputStreamNames}]`
                    )
                );

                return;
            }
            this._streamMetadata.inputs = inputStreamNames;
            this._streamMetadata.outputs = outputStreamNames;
            const actualOutputCount = outputContentTypes.length;
            const expectedOutputCount = this._streamMetadata.outputs.length;
            if (actualOutputCount !== expectedOutputCount) {
                callback(
                    new RiffError(
                        errors.types.PROTOCOL_OUTPUT_COUNT_MISMATCH,
                        `Invalid output count ${actualOutputCount}: function has only ${expectedOutputCount} output(s)`
                    )
                );
                return;
            }
            logger(
                `Start signal with: output content types: ${outputContentTypes}, ` +
                    `input names: [${this._streamMetadata.inputs}], ` +
                    `output names: [${this._streamMetadata.outputs}]`
            );

            const inputCount = this._streamMetadata.inputs.length;
            let transformers =
                this._userFunction["$argumentTransformers"] ||
                Array(inputCount);
            if (transformers.length !== inputCount) {
                const transformerCount = transformers.length;
                logger(
                    `Wrong number of argument transformers: ${transformerCount} instead of ${inputCount}`
                );
                callback(
                    new RiffError(
                        errors.types.ARGUMENT_TRANSFORMER,
                        `Function must declare exactly ${inputCount} argument transformer(s). Found ${transformerCount}`
                    )
                );
                return;
            }

            const normalizedOutputContentTypes = [];
            for (let i = 0; i < outputContentTypes.length; i++) {
                const contentType = outputContentTypes[i];
                const normalizedOutputContentType = determineContentTypes(
                    contentType
                ).accept;
                if (!canMarshall(normalizedOutputContentType)) {
                    logger(
                        `Unsupported content type ${contentType} for output #${i}`
                    );
                    callback(
                        new RiffError(
                            errors.types.UNSUPPORTED_OUTPUT_CONTENT_TYPE,
                            `Unsupported content-type '${contentType}' for output #${i}`
                        )
                    );
                    return;
                }
                normalizedOutputContentTypes.push(normalizedOutputContentType);
            }

            this._wireInputs(transformers);
            this._wireOutputs(normalizedOutputContentTypes);
            this._invoke(callback);
            this._startReceived = true;
            logger("Ready to process data");
        } else {
            if (!this._startReceived) {
                callback(
                    new RiffError(
                        errors.types.PROTOCOL_MISSING_START_SIGNAL,
                        "Start signal has not been received or processed yet. Rejecting data signal"
                    )
                );
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
            const unmarshaller = new InputUnmarshaller(transformers[i]);
            unmarshaller.on("error", (err) => {
                logger(`error from unmarshaller: ${err.toString()}`);
                this.emit("error", err);
            });
            this._functionInputs[i] = unmarshaller;
        }
    }

    _wireOutputs(outputContentTypes) {
        const outputCount = outputContentTypes.length;
        logger(`Wiring ${outputCount} output stream(s)`);
        for (let i = 0; i < outputCount; i++) {
            const marshaller = new OutputMarshaller(i, outputContentTypes[i]);
            marshaller.pipe(this._destinationStream, { end: false });
            marshaller.on("finish", () => {
                this._finishedOutputs++;
                if (this._finishedOutputs === this._functionOutputs.length) {
                    logger(
                        "Last output stream closing: ending destination stream"
                    );
                    this._destinationStream.end();
                }
            });
            marshaller.on("error", (err) => {
                logger(`error from marshaller: ${err.toString()}`);
                this.emit("error", err);
            });
            this._functionOutputs[i] = marshaller;
        }
    }

    _invoke(callback) {
        try {
            const inputStreams = toObject(
                this._functionInputs,
                this._streamMetadata.inputs
            );
            const outputStreams = toObject(
                this._functionOutputs,
                this._streamMetadata.outputs
            );
            this._userFunction.apply(null, [inputStreams, outputStreams]);
            callback();
        } catch (err) {
            callback(
                new RiffError(errors.types.STREAMING_FUNCTION_RUNTIME, err)
            );
        }
    }
};
