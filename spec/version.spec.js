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

describe('version', () => {

    const { version } = require('../package.json');

    it('matches the shrinkwrap version', async () => {
        const packageLock = require('../npm-shrinkwrap.json');
        expect(packageLock.version).toBe(version);
    });

    if (process.env.TRAVIS_TAG) {
        it('matches the tag name', () => {
            expect(process.env.TRAVIS_TAG).toBe(`v${version}`);
        });
    }

});
