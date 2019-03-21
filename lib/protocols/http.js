/*
 * Copyright 2018 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// const logger = require('util').debuglog('riff');

const express = require('express');
const bodyParser = require('body-parser');
const miss = require('mississippi');

function makeServer(fn, interactionModel, argumentTransformer) {
    const app = express();

    app.post('/', bodyParser.raw({ type: () => true }), (req, res) => {
        const messageStream = miss.duplex.obj(
            miss.to.obj((rawOutput, enc, cb) => {
                for (let header of Object.entries(rawOutput.headers)) {
                    const name = header[0];
                    for (let value of header[1].values) {
                        res.set(name, value);
                    }
                }
                if (req.headers.correlationid) {
                    res.set('correlationId', req.headers.correlationid);
                }
                res.end(rawOutput.payload);
                cb();
            }),
            miss.from.obj([
                {
                    headers: Object.entries(req.headers).reduce((headers, header) => {
                        headers[header[0]] = { values: [header[1]] };
                        return headers;
                    }, {}),
                    payload: req.body
                }
            ])
        );
        interactionModel(fn, argumentTransformer, messageStream);
    });

    return app;
}

module.exports = makeServer;
