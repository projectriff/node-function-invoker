const express = require('express');
const bodyParser = require('body-parser');
const Negotiator = require('negotiator');

const PORT = 8080;
const SUPPORTED_MEDIA_TYPES = ['text/plain', 'application/json' /*TODO add more*/]; // In preference order

const app = express();

app.use('/', bodyParser.text());                            // Supports text/plain
app.use('/', bodyParser.raw());                             // Supports application/octet-stream by default
app.use('/', bodyParser.json());                            // Supports application/json by default
app.use('/', bodyParser.urlencoded({ extended: false }));   // Supports application/x-www-form-urlencoded by default

var fn = require(process.env.FUNCTION_URI);

app.post('/', function (req, res) {
    var resultx = fn(req.body);
    console.log("Result " + resultx);

    negotiator = new Negotiator(req);

    switch (negotiator.mediaType(SUPPORTED_MEDIA_TYPES)) { // returns the most preferred Accept'ed type intersected with our list
        case 'application/json':
            res.type("application/json").json(resultx);
            break;
        case 'text/plain':
            // Force text/plain before calling send, as it defaults to html for strings
            res.type("text/plain").send("" + resultx);
            break;

    }

    res.status(200);
});

app.listen(PORT);
console.log('Running on http://localhost:' + PORT);
