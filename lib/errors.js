module.exports = {
    types: {
        // streaming protocol
        PROTOCOL_INVALID_INPUT_SIGNAL: "error-streaming-invalid-input-signal",
        PROTOCOL_MISSING_START_SIGNAL: "error-streaming-missing-start-signal",
        PROTOCOL_OUTPUT_COUNT_MISMATCH: "error-streaming-invalid-output-count",
        PROTOCOL_TOO_MANY_START_SIGNALS:
            "error-streaming-too-many-start-signals",
        // streaming functions
        STREAMING_FUNCTION_RUNTIME: "streaming-function-runtime-error",
        // request-reply functions
        REQUEST_REPLY_FUNCTION_RUNTIME: "request-reply-function-runtime-error",
        FUNCTION_PROMOTION: "error-promoting-function",
        // argument transformers
        ARGUMENT_TRANSFORMER: "error-argument-transformer",
        // hooks
        HOOK_INVALID: "error-invalid-hook",
        HOOK_TIMEOUT: "error-hook-timeout",
        HOOK_RUNTIME: "error-hook-runtime-error",
        // (un)marshalling errors
        UNSUPPORTED_INPUT_CONTENT_TYPE: "error-input-content-type-unsupported",
        INVALID_INPUT: "error-input-invalid",
        UNSUPPORTED_OUTPUT_CONTENT_TYPE:
            "error-output-content-type-unsupported",
        INVALID_OUTPUT: "error-output-invalid"
    },
    // these are specially handled by the streaming HTTP adapter
    reserved_prefixes: {
        NOT_ACCEPTABLE: "Invoker: Not Acceptable",
        UNSUPPORTED_MEDIA_TYPE: "Invoker: Unsupported Media Type"
    }
};
