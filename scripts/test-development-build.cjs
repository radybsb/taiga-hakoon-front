// Run: node scripts/test-development-build.cjs
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const assert = require('assert');
const development = require('../gulp-development');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'taiga-development-'));
const dist = path.join(root, 'dist');
fs.mkdirSync(dist);
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><script src="v-123/js/app-loader.js"></script>');
const marker = path.join(dist, '.dev-server.json');
let server;
(async function() {
    const incremental = development.buildConfig(root, {_: ['jade-deploy']});
    assert.equal(incremental.version, 'v-123', 'Standalone tasks reuse the generated index version');
    fs.writeFileSync(marker, JSON.stringify({pid: process.pid, version: 'v-456'}));
    assert.throws(() => development.assertCleanAllowed(root, 'dist'), /Cannot clean active/);
    assert.throws(() => development.assertCleanAllowed(root, 'tmp'), /Cannot clean active/);
    development.assertCleanAllowed(root, 'dist-validation');
    const running = development.buildConfig(root, {_: ['app-watch']});
    assert.equal(running.version, 'v-456');
    assert.equal(running.dist, 'dist/');
    assert.equal(running.tmp, 'tmp/');
    const deploy = development.buildConfig(root, {_: ['deploy']});
    assert.equal(deploy.dist, 'dist-validation/');
    assert.equal(deploy.tmp, 'tmp-validation/');
    assert(deploy.isolated);
    assert.throws(() => development.buildConfig(root, {_: ['deploy'], dist: 'dist'}), /active development directory/);
    assert.throws(() => development.buildConfig(root, {_: []}), /already running/);
    assert.throws(() => development.buildConfig(root, {_: ['deploy'], dist: 'dist-validation', tmp: 'tmp'}), /active development intermediates/);
    assert.equal(development.buildConfig(root, {_: [], tasks: true}).version, 'v-456');
    fs.writeFileSync(marker, JSON.stringify({pid: 2147483647, version: 'v-456'}));
    assert.equal(development.buildConfig(root, {_: ['deploy']}).dist, 'dist/');
    const explicit = development.buildConfig(root, {_: ['deploy'], dist: 'dist-validation', tmp: 'tmp-validation'});
    assert.equal(explicit.dist, 'dist-validation/');
    for (const version of ['v-123', 'v-456']) {
        fs.mkdirSync(path.join(dist, version, 'js'), {recursive: true});
        fs.writeFileSync(path.join(dist, version, 'js', 'app-loader.js'), 'window.testVersion="' + version + '";');
    }
    server = development.createApp(dist, {livereload: false}).listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {server.once('listening', resolve); server.once('error', reject);});
    const get = url => new Promise((resolve, reject) => {
        http.get({hostname: '127.0.0.1', port: server.address().port, path: url}, response => {
            let body = '';
            response.on('data', chunk => body += chunk);
            response.on('end', () => resolve({status: response.statusCode, headers: response.headers, body}));
        }).on('error', reject);
    });
    for (const version of ['v-123', 'v-456']) {
        const asset = await get('/' + version + '/js/app-loader.js');
        assert.equal(asset.status, 200);
        assert(asset.headers['content-type'].includes('javascript'));
        assert(asset.body.startsWith('window.testVersion'));
        assert.equal(asset.headers['cache-control'], 'no-store');
    }
    // Files created after startup are served without restarting the server.
    fs.mkdirSync(path.join(dist, 'v-789', 'js'), {recursive: true});
    fs.writeFileSync(path.join(dist, 'v-789', 'js', 'app-loader.js'), 'window.nextVersion=true;');
    assert.equal((await get('/v-789/js/app-loader.js')).status, 200);
    for (const url of ['/v-missing/js/app-loader.js', '/missing.js', '/conf.json']) {
        const missing = await get(url);
        assert.equal(missing.status, 404);
        assert(!missing.headers['content-type'].includes('html'));
        assert(!missing.body.includes('<!doctype'));
    }
    const route = await get('/project/test/backlog');
    assert.equal(route.status, 200);
    assert(route.body.includes('<!doctype html>'));
    assert.equal(route.headers['cache-control'], 'no-store');
    assert.equal((await get('/project/test/wiki/guide.md')).status, 200);
    console.log('PASS: active build reuse, isolated validation output, stale markers, dynamic assets, real JS responses, asset 404s and SPA routing');
})().catch(error => {console.error(error); process.exitCode = 1;}).finally(async () => {
    if (server) {await new Promise(resolve => server.close(resolve));}
    fs.rmSync(root, {recursive: true, force: true});
});
