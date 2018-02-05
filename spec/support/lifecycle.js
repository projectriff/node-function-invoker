const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');

const file = path.join(os.tmpdir(), 'lifecycle.txt');

module.exports = () => util.promisify(fs.readFile)(file, { encoding: 'utf8' }).then(content => ({ file, content }));
module.exports.$init = () => util.promisify(fs.writeFile)(file, '' + Math.random());
module.exports.$destroy = () => util.promisify(fs.unlink)(file);
