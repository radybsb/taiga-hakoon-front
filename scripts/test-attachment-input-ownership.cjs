const fs = require('fs'), path = require('path'), assert = require('assert');
process.chdir(path.resolve(__dirname, '..'));
const {JSDOM} = require('jsdom'), coffee = require('coffeescript'), jade = require('jade');
const dom = new JSDOM('<body></body>', {runScripts: 'outside-only'}), w = dom.window;
w.Immutable = require('immutable');
w._ = require('lodash');
w.taiga = {Service: class {}, defineImmutableProperty: (obj, key, get) => Object.defineProperty(obj, key, {get}), sizeFormat: value => value};
w.eval(fs.readFileSync('node_modules/jquery/dist/jquery.js', 'utf8'));
w.eval(fs.readFileSync('node_modules/angular/angular.js', 'utf8'));
const app = w.angular.module('taigaComponents', []), uploads = [];
app.factory('$exceptionHandler', () => error => {throw error;});
app.filter('translate', () => value => value);
app.filter('sizeFormat', () => value => value);
app.value('$translate', {instant: value => value});
app.value('$tgConfirm', {});
app.value('$tgConfig', {get: () => null});
app.value('$tgStorage', {get: () => 'list'});
app.value('tgProjectService', {project: {}, hasPermission: () => true});
app.value('tgAttachmentsPreviewService', {});
app.factory('tgAttachmentsService', ['$q', q => ({types: {}, validate: () => true,
    upload: (file, objectId, projectId, type) => {
        uploads.push({file, objectId, projectId, type});
        return q.when(w.Immutable.fromJS({id: uploads.length, name: file.name}));
    }
})]);
app.directive('tgFileChange', () => ({link: (scope, el, attrs) => {
    el.on('change', () => scope.$apply(() => scope.$eval(attrs.tgFileChange, {files: el[0].files})));
}}));
for (const name of ['attachments-full/attachments-full.service', 'attachments-full/attachments-full.controller', 'attachments-full/attachments-full.directive', 'attachments-simple/attachments-simple.controller', 'attachments-simple/attachments-simple.directive']) {
    w.eval(coffee.compile(fs.readFileSync(`app/modules/components/${name}.coffee`, 'utf8')));
}
const injector = w.angular.injector(['ng', 'taigaComponents']), root = injector.get('$rootScope');
const cache = injector.get('$templateCache');
for (const name of ['attachments-full', 'attachments-simple']) {
    cache.put(`components/${name}/${name}.html`, jade.renderFile(`app/modules/components/${name}/${name}.jade`));
}
root.storyId = 18; root.taskId = 30; root.projectId = 2; root.draftFiles = w.Immutable.List();
const host = w.angular.element('<div><tg-attachments-full type="us" obj-id="storyId" project-id="projectId"></tg-attachments-full><tg-attachments-full type="task" obj-id="taskId" project-id="projectId"></tg-attachments-full><tg-attachments-simple attachments="draftFiles"></tg-attachments-simple></div>');
w.document.body.appendChild(host[0]);
injector.get('$compile')(host)(root); root.$digest();
try {
    const sections = host[0].querySelectorAll('tg-attachments-full, tg-attachments-simple');
    const opened = [];
    sections.forEach((section, index) => section.querySelector('input[type="file"]').addEventListener('click', event => {event.preventDefault(); opened.push(index);}));
    for (const index of [1, 0, 2]) {
        sections[index].querySelector('.add-attachment-button').click();
        assert.equal(opened.at(-1), index, 'Each picker must belong to the section whose button was clicked');
    }
    const taskInput = sections[1].querySelector('input[type="file"]');
    const file = new w.File(['image'], 'task-image.png', {type: 'image/png'});
    Object.defineProperty(taskInput, 'files', {value: [file]});
    taskInput.dispatchEvent(new w.Event('change', {bubbles: true}));
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].type, 'task');
    assert.equal(uploads[0].objectId, 30);
    assert.equal(uploads[0].projectId, 2);
    assert.equal(uploads[0].file, file);
    console.log('PASS: task popup picker remains local alongside story and draft pickers; selected image uploads to the task, never the parent story.');
} finally {root.$destroy(); dom.window.close();}
