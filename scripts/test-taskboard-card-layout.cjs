// Taskboard-only overflow must preserve colors, epic links and task actions.
const fs = require('fs'), path = require('path'), assert = require('assert');
process.chdir(path.resolve(__dirname, '..'));
const {JSDOM} = require('jsdom'), jade = require('jade'), coffee = require('coffeescript');
const dom = new JSDOM('<body></body>', {runScripts: 'outside-only', url: 'http://localhost/'});
const w = dom.window;
w.$ = require('jquery')(w); w._ = require('lodash'); w.Immutable = require('immutable');
w.eval(fs.readFileSync('node_modules/angular/angular.js', 'utf8'));
w.eval(fs.readFileSync('app/js/tg-repeat.js', 'utf8'));
w.taiga = {Service: class {}, trim: (v, c) => w._.trim(v, c), bindOnce: (scope, attr, cb) => cb(scope.$eval(attr))};
const app = w.angular.module('taigaBase', ['tgRepeat']);
app.value('$tgAuth', {getUser: () => null});
app.value('$tgLocation', {url: () => {throw Error('Epic must open a popup');}});
app.value('lightboxService', {closeAll: () => {}}); app.value('$tgSections', {});
app.factory('$exceptionHandler', () => error => { throw error; });
app.filter('translate', () => key => key);
app.filter('emojify', ['$sce', sce => text => sce.trustAsHtml(text)]);
const opened = [];
app.value('tgDetailPopup', {open: (route, args) => opened.push([route, args])});
w.eval(coffee.compile(fs.readFileSync('app/coffee/modules/base/navurls.coffee', 'utf8')));
const injector = w.angular.injector(['ng', 'taigaBase']), root = injector.get('$rootScope');
injector.get('$tgNavUrls').update({'project-epics-detail': '/project/:project/epic/:ref'});
async function activate(link) {link.trigger('pointerenter'); for(let i=0; i<5; i++) {root.$digest(); await Promise.resolve();}}
const scope = root.$new();
const epics = Array.from({length: 7}, (_, i) => ({id: i + 1, ref: i + 10, subject: 'Epic ' + i, color: '#123456'}));
const tags = Array.from({length: 8}, (_, i) => ({name: 'Tag ' + i, color: '#654321'}));
scope.vm = {taskboardStory: {}, project: {slug: 'demo'}, item: w.Immutable.fromJS({model: {epics}, colorized_tags: tags}), visible: () => true, getTagColor: c => c};
function mount(file) {
 const el = w.angular.element('<div>' + jade.renderFile('app/modules/components/card/card-templates/' + file + '.jade') + '</div>');
 injector.get('$compile')(el)(scope); w.$('body').append(el); root.$digest(); return el;
}
(async () => {try {
 const epicsEl = mount('card-taskboard-epics');
 assert.equal(epicsEl.find('a').length, 3); assert.equal(epicsEl.find('button').text().trim(), '+4');
 assert.equal(epicsEl.find('a').first().attr('title'), 'Epic 0');
 assert.equal(epicsEl.find('.epic-color')[0].style.backgroundColor, 'rgb(18, 52, 86)');
 await activate(epicsEl.find('a').first()); epicsEl.find('a').first().trigger('click'); root.$digest(); assert.equal(opened.length, 1); assert.equal(opened[0][0], 'project-epics-detail');
 epicsEl.find('button').trigger('click'); root.$digest(); assert.equal(epicsEl.find('.card-collection-popover a').length, 7);
 await activate(epicsEl.find('.card-collection-popover a').last()); epicsEl.find('.card-collection-popover a').last().trigger('click'); root.$digest(); assert.equal(opened.length, 2);
 epicsEl.find('button').trigger('click'); root.$digest(); assert.equal(epicsEl.find('.card-collection-popover').length, 0);
 const tagsEl = mount('card-taskboard-tags');
 assert.equal(tagsEl.find('.card-tag').length, 3); assert.equal(tagsEl.find('button').text().trim(), '+5');
 assert.equal(tagsEl.find('.card-tag')[0].style.backgroundColor, 'rgb(101, 67, 33)');
 tagsEl.find('button').trigger('click'); root.$digest(); assert.equal(tagsEl.find('.card-collection-popover .card-tag').length, 8);
 // Non-taskboard cards must retain the original rendering path.
 scope.vm.taskboardStory = null; root.$digest(); assert.equal(tagsEl.find('.taskboard-tags').length, 0); assert.equal(epicsEl.find('.taskboard-epics').length, 0);
 // Taskboard tasks share the bounded tags and original source colors.
 scope.vm.showTaskboardTags = false; scope.vm.taskboardTask = true; root.$digest();
 assert.equal(tagsEl.find('.card-tag').length, 3);
 assert.equal(tagsEl.find('.card-tag')[0].style.backgroundColor, 'rgb(101, 67, 33)');
 tagsEl.find('button').trigger('click'); root.$digest();
 assert.equal(tagsEl.find('.card-collection-popover .card-tag').length, 8);
 assert.equal(epicsEl.find('.taskboard-epics').length, 0, 'Task cards do not gain story epic controls');
 scope.vm.taskboardTask = false; root.$digest();
 assert.equal(tagsEl.find('.taskboard-tags').length, 0);

 const calls = []; scope.us = {id: 42}; scope.ctrl = {addNewTask: (mode, us) => calls.push([mode, us.id])};
 const actions = w.angular.element('<div>' + jade.renderFile('app/partials/includes/components/addnewtask.jade') + '</div>');
 injector.get('$compile')(actions)(scope); actions.find('button').eq(0).trigger('click'); actions.find('button').eq(1).trigger('click');
 assert.deepEqual(calls, [['standard', 42], ['bulk', 42]]);
 const icons = fs.readFileSync('app/svg/sprite.svg', 'utf8');
 for (const name of ['plus', 'list-plus', 'paperclip', 'eye', 'comment']) assert.equal((icons.match(new RegExp('id="icon-story-' + name + '"', 'g')) || []).length, 1);
 console.log('PASS: bounded epic/tag previews, full overflow lists, source colors, epic names/popups, unchanged single/bulk task handlers, shared-card isolation and unique icons');
} finally {root.$destroy(); dom.window.close();}})().catch(error => {console.error(error); process.exitCode = 1;});
