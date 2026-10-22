// Run: node docker/test-image.cjs IMAGE
// Uses disposable containers with --network none; never contacts a real API.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const image = process.argv[2];
assert(image, 'Provide the image tag to test');
function docker(...args) {
    const result = spawnSync('docker', args, {encoding:'utf8'});
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
    return result.stdout.trim();
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'taiga-image-test-'));
const containers = [];
function start(args) {
    const id = docker('run', '-d', '--network', 'none', ...args, image);
    containers.push(id);
    return id;
}
function wget(id, url, headers = false) {
    return docker('exec', id, 'wget', ...(headers ? ['-S'] : []), '-qO-', 'http://127.0.0.1' + url);
}
async function ready(id) {
    for (let i = 0; i < 40; i++) {
        try { if (wget(id, '/healthz') === 'ok') return; } catch (_) {}
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('Container did not become ready: ' + docker('logs', id));
}
(async () => {
    const id = start(['-e','ENABLE_EVENTS=false']);
    await ready(id);
    docker('exec', id, 'nginx', '-t');
    const config = JSON.parse(wget(id, '/conf.json'));
    assert.equal(config.api, '/api/v1/');
    assert.equal(config.eventsUrl, null);
    assert.equal(config.publicRegisterEnabled, false);
    const html = wget(id, '/');
    assert(html.includes('<base href="/">'));
    assert(wget(id, '/project/test/backlog').includes('<base href="/">'));
    const loader = html.match(/(v-\d+\/js\/app-loader\.js)/)[1];
    assert(!wget(id, '/' + loader).startsWith('<'));
    for (const url of ['/v-missing/js/app-loader.js', '/missing.js', '/conf.json.template']) {
        const response = spawnSync('docker', ['exec',id,'wget','-S','-qO-','http://127.0.0.1'+url], {encoding:'utf8'});
        assert.notEqual(response.status,0);
        assert(response.stderr.includes('404'),response.stderr);
    }
    const headers = spawnSync('docker', ['exec',id,'wget','-S','-qO-','http://127.0.0.1/conf.json'],{encoding:'utf8'}).stderr;
    assert(headers.toLowerCase().includes('cache-control: no-store'));
    docker('restart',id);await ready(id);
    assert.equal(JSON.parse(wget(id,'/conf.json')).api,'/api/v1/');

    const configured = start(['-e','TAIGA_URL=https://example.test','-e','TAIGA_WEBSOCKETS_URL=wss://example.test']);
    await ready(configured);
    const explicitConfig=JSON.parse(wget(configured,'/conf.json'));
    assert.equal(explicitConfig.api,'https://example.test/api/v1/');
    assert.equal(explicitConfig.eventsUrl,'wss://example.test/events');

    fs.writeFileSync(path.join(temp,'backend.conf'), `server { listen 81; location / { default_type application/json; return 200 '{"host":"$http_host","path":"$request_uri"}'; } }`);
    const previewTemplate = path.resolve(__dirname,'test-fixtures/nginx-preview.conf.template');
    const preview = start([
        '-v',previewTemplate+':/etc/nginx/templates/default.conf.template:ro',
        '-v',path.join(temp,'backend.conf')+':/etc/nginx/conf.d/mock-backend.conf:ro',
        '-e','NGINX_ENVSUBST_FILTER=^PREVIEW_',
        '-e','PREVIEW_GATEWAY=127.0.0.1:81',
        '-e','PREVIEW_BACKEND_HOST=taiga.hakoongames.com',
        '-e','TAIGA_WEBSOCKETS_URL=wss://taiga-homolog.hakoongames.com',
        '-e','ENABLE_EVENTS=false'
    ]);
    await ready(preview);
    docker('exec',preview,'nginx','-t');
    for (const url of ['/api/v1/projects?test=1','/media/attachments/video.mp4?token=test','/static/admin/base.css']) {
        const data=JSON.parse(wget(preview,url));
        assert.equal(data.path,url);assert.equal(data.host,'taiga.hakoongames.com');
    }
    assert(wget(preview,'/project/test/backlog').includes('<base href="/">'));
    assert.equal(JSON.parse(wget(preview,'/conf.json')).eventsUrl,null);
    docker('run','--rm','--network','none','-v',
        path.resolve(__dirname,'test-fixtures/nginx-host.conf.example')+':/etc/nginx/conf.d/default.conf:ro',
        image,'nginx','-t');
    console.log('PASS: image startup/restart, runtime config, SPA, assets/404/cache, preview Nginx and same-origin API/media/static proxy with mock backend');
})().catch(error => {console.error(error);process.exitCode=1;}).finally(() => {
    for (const id of containers) {
        try { docker('rm','-f',id); } catch (error) { console.error(error.message); }
    }
    fs.rmSync(temp,{recursive:true,force:true});
});
