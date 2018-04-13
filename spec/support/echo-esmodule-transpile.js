"use strict";

/*
// ES Module
export default function echo(value) {
    return value;
}
*/

// CommonJS Module interop transpile
Object.defineProperty(exports, "__esModule", { value: true });
function echo(message) {
    return message;
}
exports.default = echo;
