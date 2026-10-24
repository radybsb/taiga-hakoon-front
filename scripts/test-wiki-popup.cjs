const assert = require('assert');
const fs = require('fs');
const coffee = require('coffeescript');
const {JSDOM} = require('jsdom');
const Immutable = require('immutable');
const jade = require('jade');
(async () => {
const w = new JSDOM('<body></body>', {url: 'http://localhost/project/demo/wiki/home', runScripts: 'outside-only', pretendToBeVisual: true}).window;
w.eval(fs.readFileSync('node_modules/jquery/dist/jquery.js', 'utf8'));
w.eval(fs.readFileSync('node_modules/angular/angular.js', 'utf8'));
w.matchMedia = () => ({matches: true});
w.HTMLElement.prototype.scrollIntoView = function() {this.scrolled = true;};
let copied, creations = 0, notifications = 0, revealPopup;
let holdOpening = true;
Object.defineProperty(w.navigator, 'clipboard', {value: {writeText: async url => {copied = url;}}});
w.taiga = {mixOf: () => class {}, Controller: class {}, PageMixin: {}};
let savedContent, uploadArgs;
const project = Immutable.fromJS({id: 1, slug: 'demo', is_wiki_activated: true, archived_code: false, members: [], my_permissions: ['view_wiki_pages', 'modify_wiki_page']});
const projectService = {_project: project, _activeMembers: Immutable.List(), get project() {return this._project;}};
const resources = {wiki: {getBySlug: (id, slug) => id === 99 ? Promise.reject(Error('Missing')) : Promise.resolve({id: 3, project: id, slug, content: '<h1>Intro</h1><h2>Child</h2>', outline: [{id: 'wiki-a', title: 'Intro'}, {id: 'wiki-b', title: 'Child'}]})}};
const factory = {create() {throw Error('Factory not initialized');}};
const lightbox = {open(el) {el.addClass('open'); return new Promise(resolve => {const show = () => {resolve();}; if(holdOpening) revealPopup = show; else show();});}, close(el) {el.data('scope').$destroy(); el.remove(); return new Promise(() => {});}};
const module = w.angular.module('taigaWiki', []).value('$rootElement', w.angular.element(w.document.body))
.value('tgProjectService', projectService).value('tgProjectsService', {getProjectBySlug: slug => Promise.resolve(project.set('id', slug === 'missing' ? 99 : 2).set('slug', slug).set('my_permissions', Immutable.List(slug === 'readonly' ? ['view_wiki_pages'] : ['view_wiki_pages', 'modify_wiki_page'])))})
.value('$tgResources', resources).value('tgLightboxFactory', factory).value('lightboxService', lightbox)
.value('$tgConfirm', {notify(type) {if(type === 'error') notifications++;}})
.value('tgAttachmentsFullService', {invalidatePendingLoads() {}, addAttachment(...args) {uploadArgs = args; return Promise.resolve(Immutable.fromJS({file: {url: '/media/upload.png'}}));}})
.value('$tgQueueModelTransformation', {}).value('$tgQqueue', {bindAdd: fn => fn})
.value('$tgRepo', {save: page => {savedContent = page.content; return Promise.resolve(page);}})
.value('$tgAnalytics', {}).value('tgActivityService', {fetchEntries() {throw Error('Popup must not refresh background activity');}})
.filter('translate', () => value => value);
module.directive('tgWysiwyg', () => ({link(scope, el) {scope.$watch('item.content', content => el.html('<div class="js-wysiwyg-html">'+content+'</div>'));}}));
module.directive('tgBindWysiwygHtml', () => ({link(scope, el, attrs) {scope.$watch(attrs.tgBindWysiwygHtml, content => el.html(content));}}));
for (const file of ['app/coffee/modules/wiki/main.coffee', 'app/coffee/modules/wiki/popup.coffee', 'app/coffee/modules/wiki/outline.coffee']) w.eval(coffee.compile(fs.readFileSync(file, 'utf8')));
const injector = w.angular.injector(['ng', 'taigaWiki']);
const root = injector.get('$rootScope');
injector.get('$templateCache').put('wiki/wiki-popup.html', jade.render(fs.readFileSync('app/partials/wiki/wiki-popup.jade', 'utf8')));
factory.create = (name, attrs, values) => {creations++; const scope = root.$new(); Object.assign(scope, values); const el = w.angular.element('<div>'); el.attr(name, ''); el.attr(attrs); w.document.body.append(el[0]); injector.get('$compile')(el)(scope); root.$digest();};
const settle = async () => {for(let i=0;i<6;i++) {await new Promise(r => setTimeout(r, 15)); root.$digest();}};
function link(href, container = w.document.body, extra = {}) {
 const a = w.document.createElement('a'); a.href = href; a.target = '_blank'; a.textContent = 'chapter'; container.append(a);
 let opened = false; a.addEventListener('click', () => {opened = true;});
 const event = new w.MouseEvent('click', {bubbles: true, cancelable: true, ...extra});
 a.dispatchEvent(event); a.remove(); return {event, opened};
}
let result = link('/project/demo/wiki/home#wiki-a'); await settle();
assert(result.event.defaultPrevented && !result.opened); assert.equal(creations, 0); assert.equal(injector.get('$location').hash(), 'wiki-a');
result = link('/project/demo/wiki/other#wiki-b'); await settle();
assert(result.event.defaultPrevented && !result.opened); assert.equal(creations, 1, "one popup: " + w.location.href);
let modal = w.document.querySelector('.lightbox-wiki-detail'); assert(modal);
assert(!modal.querySelector('h2[data-wiki-chapter]').scrolled, 'Do not consume navigation while the popup is hidden');
holdOpening = false; revealPopup(); await settle();
assert(modal.querySelector('h2[data-wiki-chapter]').scrolled, 'Scroll when the popup finishes showing its content');
const editorScope = w.angular.element(modal.querySelector('tg-wiki-wysiwyg')).scope();
assert(editorScope.editableDescription);
modal.querySelector('.wiki-content-edit').click(); root.$digest(); assert.equal(editorScope.descriptionEditRequest, 1);
let finished = false;
await editorScope.saveDescription('<h1>Edited</h1><h2>Child</h2>', () => {finished = true;}); await settle();
assert.equal(savedContent, '<h1>Edited</h1><h2>Child</h2>'); assert(finished);
let uploadURL; editorScope.uploadFiles({name: 'image.png'}, result => {uploadURL = result.default;}); await settle();
assert.equal(uploadArgs[0], 1); assert.equal(uploadArgs[1], 3); assert.equal(uploadURL, '/media/upload.png');
const pageURL = w.location.href;
result = link('#wiki-a', modal); await settle(); assert.equal(creations, 1, "one popup: " + w.location.href); assert.equal(w.location.href, pageURL); assert(modal.querySelector('h1[data-wiki-chapter]').scrolled);
modal.querySelector('h1[data-wiki-chapter]').scrolled = false;
link('#wiki-a', modal); await settle(); assert(modal.querySelector('h1[data-wiki-chapter]').scrolled, 'Clicking the active chapter again must scroll back to it');
modal.querySelector('.wiki-copy-chapter-link').click(); await settle(); assert.equal(copied, 'http://localhost/project/demo/wiki/other#wiki-a');
link('/project/demo/wiki/third#wiki-b', modal); await settle(); assert.equal(creations, 2); assert.equal(w.document.querySelectorAll('.lightbox-wiki-detail').length, 1, 'Replace the previous popup');
for(const [href, options] of [['https://other.test/project/demo/wiki/other#wiki-a', {}], ['/project/demo/wiki/other#wiki-a', {ctrlKey: true}], ['/project/demo/us/1', {}]]) {const r=link(href,w.document.body,options); assert(!r.event.defaultPrevented);}
const editable = w.document.createElement('div'); editable.setAttribute('contenteditable','true'); w.document.body.append(editable); assert(!link('/project/demo/wiki/other#wiki-a', editable).event.defaultPrevented); editable.remove();
const currentModal = w.document.querySelector('.lightbox-wiki-detail');
link('/project/missing/wiki/test#wiki-a'); await settle(); assert.equal(notifications, 1, "one error notification"); assert.equal(w.document.querySelector('.lightbox-wiki-detail'), currentModal, 'Failed loads preserve the current popup');
lightbox.close(w.angular.element(currentModal)); assert.equal(projectService.project, project);
link('/project/readonly/wiki/test#wiki-a'); await settle();
const readonlyModal = w.document.querySelector('.lightbox-wiki-detail');
assert(readonlyModal); assert(!readonlyModal.querySelector('.wiki-content-edit')); assert(!readonlyModal.querySelector('tg-wysiwyg'));
lightbox.close(w.angular.element(readonlyModal)); assert.equal(projectService.project, project);
const componentModule = w.angular.module('taigaComponents', []);
w.eval(coffee.compile(fs.readFileSync('app/modules/components/wysiwyg/wysiwyg.service.coffee', 'utf8')));
const serviceClass = componentModule._invokeQueue.find(entry => entry[2][0] === 'tgWysiwygService')[2][1];
const conversion = new serviceClass({}, {}, {}, {getTrustedHtml: html => html}, {});
const resolved = w.document.createElement('div');
resolved.innerHTML = conversion.relativePaths('<a href="#wiki-b">local</a><a href="third#wiki-a">other</a>', 'http://localhost/project/demo/wiki/second');
assert.equal(resolved.children[0].href, 'http://localhost/project/demo/wiki/second#wiki-b');
assert.equal(resolved.children[1].href, 'http://localhost/project/demo/wiki/third#wiki-a');
w.close();
console.log('PASS: same-page anchors, cross-page popup and initial scroll, local anchors/copy links, replacement, external/modified/editor clicks, failure handling, Wiki edit/save/upload, read-only permissions and project restoration.');
})().catch(error => {console.error(error); process.exitCode = 1;});
