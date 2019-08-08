// GENERATED CODE -- DO NOT EDIT!

// Original file comments:
// This protobuf definition defines how riff encodes messages on the wire when doing an RPC function invocation.
'use strict';
var grpc = require('grpc');
var proto_riff$rpc_pb = require('../proto/riff-rpc_pb.js');

function serialize_streaming_InputSignal(arg) {
  if (!(arg instanceof proto_riff$rpc_pb.InputSignal)) {
    throw new Error('Expected argument of type streaming.InputSignal');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_streaming_InputSignal(buffer_arg) {
  return proto_riff$rpc_pb.InputSignal.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_streaming_OutputSignal(arg) {
  if (!(arg instanceof proto_riff$rpc_pb.OutputSignal)) {
    throw new Error('Expected argument of type streaming.OutputSignal');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_streaming_OutputSignal(buffer_arg) {
  return proto_riff$rpc_pb.OutputSignal.deserializeBinary(new Uint8Array(buffer_arg));
}


var RiffService = exports.RiffService = {
  invoke: {
    path: '/streaming.Riff/Invoke',
    requestStream: true,
    responseStream: true,
    requestType: proto_riff$rpc_pb.InputSignal,
    responseType: proto_riff$rpc_pb.OutputSignal,
    requestSerialize: serialize_streaming_InputSignal,
    requestDeserialize: deserialize_streaming_InputSignal,
    responseSerialize: serialize_streaming_OutputSignal,
    responseDeserialize: deserialize_streaming_OutputSignal,
  },
};

exports.RiffClient = grpc.makeGenericClientConstructor(RiffService);
