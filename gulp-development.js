/* Development builds and validation builds must not share an output directory. */
var fs = require('fs');
var path = require('path');

function alive(pid) {
    try { process.kill(pid, 0); return true; }
    catch (error) { return error.code === 'EPERM'; }
}

function activeServer(marker) {
    try {
        var state = JSON.parse(fs.readFileSync(marker, 'utf8'));
        if (Number.isInteger(state.pid) && state.pid > 0 && /^v-\d+$/.test(state.version) && alive(state.pid)) {
            return state;
        }
    } catch (error) { /* Missing or stale marker: no active development server. */ }
    return null;
}

function directory(value) {
    return value.replace(/[\\/]+$/, '') + '/';
}

exports.buildConfig = function(root, args) {
    var tasks = args._ || [];
    var deploy = tasks.indexOf('deploy') !== -1;
    var listing = args.tasks || args['tasks-simple'] || args['tasks-json'] || args.help || args.version;
    var startsServer = !listing && (!tasks.length || tasks.indexOf('default') !== -1 || tasks.indexOf('express') !== -1);
    var marker = path.join(root, 'dist', '.dev-server.json');
    var active = activeServer(marker);
    var dist = directory(args.dist || (deploy && active ? 'dist-validation' : 'dist'));
    var isolated = path.resolve(root, dist) !== path.join(root, 'dist');
    if (startsServer && active) {
        throw new Error('Development server is already running. Keep npm start open and use incremental tasks.');
    }
    if (deploy && active && !isolated) {
        throw new Error('Cannot deploy into the active development directory. Use --dist dist-validation --tmp tmp-validation.');
    }
    var version = 'v-' + Date.now();
    if (!deploy && !startsServer) {
        if (active && !isolated) {
            version = active.version;
        } else {
            try {
                var html = fs.readFileSync(path.resolve(root, dist, 'index.html'), 'utf8');
                var match = html.match(/\bv-\d+(?=\/js\/app-loader\.js)/);
                if (match) { version = match[0]; }
            } catch (error) { /* A first build has no index yet. */ }
        }
    }
    var tmp = directory(args.tmp || (isolated ? 'tmp-validation' : 'tmp'));
    if (deploy && active && path.resolve(root, tmp) === path.join(root, 'tmp')) {
        throw new Error('Cannot clear active development intermediates. Use --tmp tmp-validation.');
    }
    return {
        dist: dist,
        tmp: tmp,
        version: version,
        marker: marker,
        isolated: isolated,
        deploy: deploy
    };
};

// Check again immediately before cleaning: another process may have started
// the development server since this Gulp process loaded its configuration.
exports.assertCleanAllowed = function(root, target) {
    var active = activeServer(path.join(root, 'dist', '.dev-server.json'));
    var resolved = path.resolve(root, target);
    if (active && (resolved === path.join(root, 'dist') || resolved === path.join(root, 'tmp'))) {
        throw new Error('Cannot clean active development files. Use isolated validation directories.');
    }
};

exports.markServer = function(marker, version) {
    fs.mkdirSync(path.dirname(marker), {recursive: true});
    fs.writeFileSync(marker, JSON.stringify({pid: process.pid, version: version}));
    process.once('exit', function() {
        try {
            var state = JSON.parse(fs.readFileSync(marker, 'utf8'));
            if (state.pid === process.pid && state.version === version) { fs.unlinkSync(marker); }
        } catch (error) { /* Already removed. */ }
    });
};

exports.createApp = function(dist, options) {
    var express = require('express');
    var app = express();
    app.use(require('compression')());
    // Resolve assets from disk, rather than mounting one version for the lifetime
    // of the server. Never cache files which incremental builds can overwrite.
    app.use(express.static(dist, {
        index: false,
        etag: false,
        lastModified: false,
        setHeaders: function(res) { res.setHeader('Cache-Control', 'no-store'); }
    }));
    app.use(function(req, res, next) {
        if (/^\/v-[^/]+(?:\/|$)/.test(req.path) || /\.(?:js|css|json|map|svg|png|jpe?g|gif|webp|woff2?|ttf|eot|ico|wasm|html)$/i.test(req.path)) {
            return res.status(404).type('text/plain').send('Static asset not found');
        }
        next();
    });
    if (!options || options.livereload !== false) {
        app.use(require('connect-livereload')({port: 35729}));
    }
    app.get('*', function(req, res) {
        res.setHeader('Cache-Control', 'no-store');
        res.sendFile('index.html', {root: dist});
    });
    return app;
};
