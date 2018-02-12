/*
 * Copyright 2017-2018 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const logger = require('util').debuglog('riff');

const express = require('express');
const bodyParser = require('body-parser');
const Negotiator = require('negotiator');

const SUPPORTED_MEDIA_TYPES = ['text/plain', 'application/json' /*TODO add more*/]; // In preference order

function asyncMiddleware(middleware) {
    return (req, res, next) => {
        // handles thrown errors from middleware
        middleware(req, res, next).catch(err => next(err));
    };
}

function makeApp(fn) {
    const app = express();

    app.use('/', bodyParser.text());                            // Supports text/plain
    app.use('/', bodyParser.raw());                             // Supports application/octet-stream by default
    app.use('/', bodyParser.json({ strict: false }));           // Supports application/json by default
    app.use('/', bodyParser.urlencoded({ extended: false }));   // Supports application/x-www-form-urlencoded by default

    app.post('/', asyncMiddleware(async (req, res) => {
        const resultx = await fn(req.body);
        logger('Result:', resultx);

        negotiator = new Negotiator(req);

        switch (negotiator.mediaType(SUPPORTED_MEDIA_TYPES)) { // returns the most preferred Accept'ed type intersected with our list
            case 'application/json':
                res.json(resultx);
                break;
            case 'text/plain':
                // Force text/plain before calling send, as it defaults to html for strings
                res.type('text/plain').send('' + resultx);
                break;
            default:
                res.status(406).type('text/plain').send('' + resultx);
                break;
        }
    }));

    // handle errors
    app.use((err, req, res, next) => {
        logger('Error:', err);
        res.status(500).end();
    });

    return app;
}

module.exports = makeApp;
