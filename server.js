const PORT = 8080;

const fn = require(process.env.FUNCTION_URI);
const app = require('./lib/app')(fn);

app.listen(PORT);
console.log('Running on http://localhost:' + PORT);
