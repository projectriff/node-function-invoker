const express = require('express');
const bodyParser = require('body-parser');

const PORT = 8080;

const app = express();

app.use('/', bodyParser.text());                            // Supports text/plain
app.use('/', bodyParser.raw());                             // Supports application/octet-stream by default
app.use('/', bodyParser.json());                            // Supports application/json by default
app.use('/', bodyParser.urlencoded({ extended: false }));   // Supports application/x-www-form-urlencoded by default

var fn = require(process.env.FUNCTION_URI);

app.post('/', function (req, res) {
    var resultx = fn(req.body);
    console.log("Result " + resultx);
    res.type("text/plain");
    res.status(200).send(resultx);
});

app.listen(PORT);
console.log('Running on http://localhost:' + PORT);
