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

const childProcess = require('child_process');
const fs = require('fs');

function nestHeaders(content, levels = 1) {
    return content.toString().replace(/^#/gm, '#'.repeat(levels + 1))
}

function inject(content, signal, injection) {
    const start = content.indexOf(`<!-- ${signal} -->`) + `<!-- ${signal} -->`.length;
    const end = content.indexOf(`<!-- /${signal} -->`)
    return `${content.slice(0, start)}\n${injection}${content.slice(end)}`;
}

describe('docs', () => {

    it('are up to date', async () => {
        // generate docs
        childProcess.execFileSync('riff', ['docs', '-d', 'docs', '-c', 'init node'], {
            env: Object.assign({ RIFF_INVOKER_PATHS: 'node-invoker.yaml' }, process.env)
        });
        childProcess.execFileSync('riff', ['docs', '-d', 'docs', '-c', 'create node'], {
            env: Object.assign({ RIFF_INVOKER_PATHS: 'node-invoker.yaml' }, process.env)
        });

        // assert docs are up to date
        childProcess.execFileSync('git', ['diff', '--exit-code', '--', 'docs']);

        // update readme
        let readme = fs.readFileSync('README.md');
        readme = inject(readme, 'riff-init', nestHeaders(fs.readFileSync('docs/riff_init_node.md')))
        readme = inject(readme, 'riff-create', nestHeaders(fs.readFileSync('docs/riff_create_node.md')))
        fs.writeFileSync('README.md', readme);

        // assert readme is up to date
        childProcess.execFileSync('git', ['diff', '--exit-code', '--', 'README.md']);
    });

});
