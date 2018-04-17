/*
 * Copyright 2018 the original author or authors.
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

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

fdescribe('version', () => {

    const { version } = require('../package.json');

    it('matches the package lock version', async () => {
        const packageLock = require('../package-lock.json');
        expect(packageLock.version).toBe(version);
    });

    it('matches the invoker.yaml version', async () => {
        const filepath = path.resolve(__dirname, '..', 'node-invoker.yaml');
        const invokerResource = yaml.safeLoad(fs.readFileSync(filepath, 'utf8'));
        expect(invokerResource.spec.version).toBe(version);
    });

    if (process.env.TRAVIS_TAG) {
        it('matches the tag name', () => {
            expect(process.env.TRAVIS_TAG).toBe(`v${version}`);
        });
    }

});
