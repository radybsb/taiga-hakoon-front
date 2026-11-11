const fs = require('fs'), assert = require('assert');
const {JSDOM} = require('jsdom'), coffee = require('coffeescript');
const dom = new JSDOM('<body></body>', {url: 'http://localhost/', runScripts: 'outside-only'}), w = dom.window;
w.$ = require('jquery')(w);
w.eval(fs.readFileSync(require.resolve('immutable/dist/immutable.js'), 'utf8'));
w.taiga = {isImage: name => /\.(gif|png|jpe?g)$/i.test(name)};
w.eval(fs.readFileSync('node_modules/angular/angular.js', 'utf8'));
const app = w.angular.module('taigaComponents', []), preview = {}, opened = [];
app.value('tgAttachmentsPreviewService', preview);
app.value('lightboxService', {open: el => {opened.push(el); el.addClass('open');}, close: el => el.removeClass('open')});
app.factory('tgWysiwygService', ['$q', '$sce', (q, sce) => ({getHTML: x => x, relativePaths: x => x, refreshAttachmentURL: x => q.when(sce.trustAsHtml(x)), appendVideoPlayers: () => {}})]);
// Keep the real preview's public binding contract while avoiding media loading.
app.directive('tgAttachmentsPreview', () => ({scope: {attachments: '='}}));
w.eval(coffee.compile(fs.readFileSync('app/modules/components/bind-wysiwyg-html.coffee', 'utf8')));
const injector = w.angular.injector(['ng', 'taigaComponents']), root = injector.get('$rootScope'), compile = injector.get('$compile');
try {
  for (const context of ['wiki', 'us-comment', 'task-comment', 'epic-comment']) {
    const scope = root.$new();
    scope.html = '<a href="/original"><img src="/one.png" alt="One"></a><img src="/two.gif?token=x">';
    const el = compile('<div tg-bind-wysiwyg-html="html"></div>')(scope).appendTo(w.document.body);
    root.$digest();
    const event = w.$.Event('click'); el.find('img').eq(1).trigger(event); root.$digest();
    assert(event.isDefaultPrevented(), context);
    const viewer = opened.at(-1), files = viewer.isolateScope().attachments;
    assert(viewer.is('tg-attachments-preview.lightbox.lightbox-block'));
    assert.equal(files.size, 1);
    assert.equal(files.getIn([0, 'file', 'url']), 'http://localhost/two.gif?token=x');
    assert.equal(preview.fileId, files.getIn([0, 'file', 'id']));
    assert(files.every(file => file.get('inherited')));
    // Rerenders must not orphan viewers or duplicate handlers.
    scope.html = '<img src="/replacement.gif">'; root.$digest();
    el.find('img').trigger('click'); root.$digest();
    assert.equal(viewer.isolateScope().attachments.size, 1);
    assert.equal(w.$('.embedded-image-preview').length, 1);
    const before = opened.length;
    el.wrap('<div class="edit-mode"></div>'); el.find('img').trigger('click');
    assert.equal(opened.length, before);
    scope.$destroy(); assert.equal(w.$('.embedded-image-preview').length, 0);
    el.parent().remove();
  }
  console.log('PASS: wiki/comment images use styled scoped viewers, preserve GIF URLs, update after rendering, ignore editing, and clean up on destroy.');
} finally {root.$destroy(); dom.window.close();}
