"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunk = chunk;
// split an array into chunks of a given size.
function chunk(array, size) {
    var result = [];
    for (var i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}
