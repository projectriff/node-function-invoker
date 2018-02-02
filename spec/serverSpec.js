const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const request = require('superagent');
const util = require('util');
const waitForPort = util.promisify(require('wait-for-port'));

const HOST = '127.0.0.1';
const PORT = 8080

const serverPath = path.join(__dirname, '..', 'server.js');

describe('server', () => {
    function createServerProcess(func) {
        return childProcess.execFile('node', [serverPath], {
            env: Object.assign({}, process.env, {
                HOST,
                PORT,
                FUNCTION_URI: path.join(__dirname, 'support', `${func}.js`)
            })
        });
    }

    it('runs the echo function', async () => {
        const server = createServerProcess('echo');

        const exitCode = new Promise(resolve => {
            server.on('exit', (code, status) => resolve(code));
        });

        await waitForPort(HOST, PORT);

        await new Promise(resolve => {
            request.post(`http://${HOST}:${PORT}/`)
                .accept('text/plain')
                .type('text/plain')
                .send('riff')
                .end((err, res) => {
                    if (err) return reject(err);
                    expect(res.status).toBe(200);
                    expect(res.headers['content-type']).toMatch('plain');
                    expect(res.text).toBe('riff');
                    resolve();
                });
        });

        server.kill('SIGINT');
        expect(await exitCode).toBe(0);
    });

    it('runs the lifecycle function', async () => {
        const server = createServerProcess('lifecycle');

        const exitCode = new Promise(resolve => {
            server.on('exit', (code, status) => resolve(code));
        });

        await waitForPort(HOST, PORT);

        const { file, content } = await new Promise(resolve => {
            request.post(`http://${HOST}:${PORT}/`)
                .accept('application/json')
                .type('text/plain')
                .send('riff')
                .end(async (err, res) => {
                    if (err) return reject(err);
                    expect(res.status).toBe(200);
                    expect(res.headers['content-type']).toMatch('json');
                    resolve(res.body);
                });
        });

        expect(await util.promisify(fs.readFile)(file, { encoding: 'utf8' })).toBe(content);

        server.kill('SIGINT');
        expect(await exitCode).toBe(0);

        try {
            await util.promisify(fs.stat)(file);
            fail('Nonce file not deleted by $destroy mehod');
        } catch (e) {
            // expect file to not exist
            expect(e.code).toBe('ENOENT');
        }
    });

    it('kills the init-throws function', async () => {
        const server = createServerProcess('init-throws');

        const exitCode = new Promise(resolve => {
            server.on('exit', (code, status) => resolve(code));
        });

        expect(await exitCode).toBe(2);
    });

    it('kills the init-timeout function after 10 seconds', async () => {
        const server = createServerProcess('init-timeout');

        const exitCode = new Promise(resolve => {
            server.on('exit', (code, status) => resolve(code));
        });

        expect(await exitCode).toBe(1);
    }, 15e3);

    it('kills the destroy-throws function', async () => {
        const server = createServerProcess('destroy-throws');

        const exitCode = new Promise(resolve => {
            server.on('exit', (code, status) => resolve(code));
        });

        await waitForPort(HOST, PORT);

        server.kill('SIGINT');
        expect(await exitCode).toBe(2);
    });

    it('kills the destroy-timeout function after 10 seconds', async () => {
        const server = createServerProcess('destroy-timeout');

        const exitCode = new Promise(resolve => {
            server.on('exit', (code, status) => resolve(code));
        });

        await waitForPort(HOST, PORT);

        server.kill('SIGINT');
        expect(await exitCode).toBe(1);
    }, 15e3);
});
