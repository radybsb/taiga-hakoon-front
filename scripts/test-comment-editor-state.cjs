const fs = require('fs');
const path = require('path');
const assert = require('assert');
const coffee = require('coffeescript');
const jade = require('jade');
const {JSDOM} = require('jsdom');
process.chdir(path.resolve(__dirname, '..'));
(async () => {
    const w = new JSDOM('<body></body>', {url: 'http://localhost/', runScripts: 'outside-only'}).window;
    w.$ = require('jquery')(w); w._ = require('lodash'); w.taiga = {};
    w.eval(fs.readFileSync('node_modules/angular/angular.js', 'utf8'));
    w.eval(fs.readFileSync('node_modules/angular-mocks/angular-mocks.js', 'utf8'));
    const app = w.angular.module('taigaComponents', []);
    app.factory('$exceptionHandler', () => error => {throw error;});
    app.filter('translate', () => key => key);
    app.value('$translate', {preferredLanguage: () => 'en', instant: key => key});
    app.value('$tgConfirm', {});
    app.value('$tgStorage', {get: () => null, set() {}, remove() {}});
    app.value('animationFrame', {}); app.value('tgLoader', {open: () => false});
    app.value('$tgAnalytics', {trackEvent() {}});
    app.value('tgAttachmentsFullService', {attachments: {toJS: () => []}});
    app.factory('tgWysiwygService', ['$q', q => ({
        observeEditorVideos: () => () => {}, getHTML: text => text, getMarkdown: html => html,
        refreshAttachmentURLFromMarkdown: text => q.when(text)
    })]);
    w.eval(coffee.compile(fs.readFileSync('app/modules/components/wysiwyg/wysiwyg.directive.coffee', 'utf8')));
    const injector = w.angular.injector(['ng', 'ngMock', 'taigaComponents']);
    const root = injector.get('$rootScope'), browser = injector.get('$browser');
    injector.get('$templateCache').put('common/components/wysiwyg-toolbar.html', jade.renderFile('app/partials/common/components/wysiwyg-toolbar.jade'));
    const scope = root.$new(); scope.content = ''; scope.project = {id: 1, members: []};
    const saved = []; scope.save = (text, cb) => {saved.push(text); cb();};
    const el = injector.get('$compile')('<tg-wysiwyg editonly required not-persist content="content" project="project" on-save="save(text, cb)"></tg-wysiwyg>')(scope);
    w.document.body.append(el[0]); root.$digest(); browser.defer.flush();
    const editor = el.find('tg-text-editor')[0], save = el.find('.e2e-save-editor');
    assert(save.hasClass('disabled'), 'Empty required comments start unavailable');
    editor.dispatchEvent(new w.CustomEvent('changed', {detail: 'First comment'}));
    browser.defer.flush(); // No manual digest: the editor itself must schedule the visual update.
    assert(!save.hasClass('disabled'), 'Typing enables Save without another click');
    editor.dispatchEvent(new w.CustomEvent('changed', {detail: 'Latest comment'}));
    save.trigger('click');
    assert.deepEqual(saved, ['Latest comment'], 'Immediate Save still flushes the latest throttled content');
    assert(save.hasClass('disabled'), 'Successful save resets the empty comment state');
    await new Promise(resolve => setTimeout(resolve, 220));
    editor.dispatchEvent(new w.CustomEvent('changed', {detail: 'Text to remove'}));
    browser.defer.flush(); assert(!save.hasClass('disabled'));
    editor.dispatchEvent(new w.CustomEvent('changed', {detail: ''}));
    await new Promise(resolve => setTimeout(resolve, 220));
    browser.defer.flush();
    assert(save.hasClass('disabled'), 'Clearing the editor updates Save after the trailing throttle');
    scope.$destroy(); w.close();
    console.log('PASS: Save updates automatically while typing/clearing, immediate saving retains the latest text, and saved comments reset the state.');
})().catch(error => {console.error(error); process.exitCode = 1;});
