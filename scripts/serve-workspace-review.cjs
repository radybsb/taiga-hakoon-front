// Optional review server: same frontend files, same-origin API, no changes to npm start.
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const express = require('express');
const development = require('../gulp-development');
const root = path.resolve(__dirname, '..');
const app = express();
const port = Number(process.env.TAIGA_REVIEW_PORT || 9002);
app.get('/conf.json', (req, res) => {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'dist/conf.json'), 'utf8'));
    config.api = `http://localhost:${port}/api/v1/`;
    res.setHeader('Cache-Control', 'no-store');
    res.json(config);
});
app.use('/api', (req, res) => {
    const upstream = http.request({hostname:'127.0.0.1',port:9000,path:req.originalUrl,method:req.method,headers:{...req.headers,host:'localhost:9000'}}, response => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
    });
    upstream.on('error', () => {
        if (!res.headersSent) res.status(502).json({_error_message:'Local API is unavailable on port 9000.'});
        else res.end();
    });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
});
app.use(development.createApp(path.join(root, 'dist'), {livereload:false}));
app.listen(port,'127.0.0.1',() => console.log(`Workspace review: http://localhost:${port}/project/test-project/kanban`));
