// Run from taiga-front: node scripts/test-inline-video.cjs
const fs = require('fs');
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
const coffee = require('coffeescript');
const assert = require('assert');
const {JSDOM} = require(process.cwd() + '/node_modules/jsdom');
const dom = new JSDOM('<!doctype html><div id="editor"></div>', {url:'http://localhost:9000/',runScripts:'outside-only',pretendToBeVisual:true});
const w = dom.window;
w._ = require('lodash');
w.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
w.Range.prototype.getClientRects = () => [];
w.Range.prototype.getBoundingClientRect = () => ({top:0,left:0,bottom:0,right:0,width:0,height:0});
w.scrollTo = () => {};
let Service;
w.angular = {module:()=>({service:(name, cls)=>Service=cls})};
w.eval(coffee.compile(fs.readFileSync('app/modules/components/wysiwyg/wysiwyg.service.coffee', 'utf8')));
const service = new Service(null,null,null,null);
const src = 'http://localhost:9000/media/attachments/a/test.mp4?token=abc#_taiga-refresh=userstory:8';
assert(service.isVideoAttachmentURL(src));
assert(!service.isVideoAttachmentURL('javascript:alert(1)'));
assert(!service.isVideoAttachmentURL('/media/attachments/test.png'));
assert(!service.isVideoAttachmentURL('/media/attachments/test.mp4.exe'));
assert(!service.isVideoAttachmentURL('https://example.com/test.mp4'));
const read = w.document.createElement('div');
read.innerHTML = `<p><a href="${src}">Video</a><a href="/media/attachments/test.gif">GIF</a></p>`;
service.appendVideoPlayers(read);service.appendVideoPlayers(read);
assert.equal(read.querySelectorAll('video').length,1);
assert.equal(read.querySelector('video').src,src);
assert.equal(read.querySelectorAll('a[href*="test.mp4"]').length, 0);
w.eval(fs.readFileSync('node_modules/taiga-html-editor/packages/ckeditor5-build-classic/build/ckeditor.js','utf8'));
(async()=>{
 const stopObserving = service.observeEditorVideos(w.document.body);
 const editor = await w.ClassicEditor.create(w.document.querySelector('#editor'), {toolbar:[],initialData:`<p><a href="${src}">Video</a> text</p>`});
 await new Promise(resolve => w.setTimeout(resolve, 0));
 assert(editor.model.schema.isRegistered('taigaInlineVideo'));
 service.enableEditorVideos(editor); // Must be safe to call more than once.
 assert.equal(editor.ui.getEditableElement().querySelectorAll('video').length,1);
 assert(editor.getData().includes('_taiga-refresh=userstory:8'));
 assert(!editor.getData().includes('<video'));
 editor.setData('<p>Upload </p>');
 editor.model.change(writer=>{
  const root=editor.model.document.getRoot();
  const p=root.getChild(0);
  writer.insertText('Uploaded video',{linkHref:src},p,'end');
 });
 assert.equal(editor.ui.getEditableElement().querySelectorAll('video').length,1);
 assert(editor.getData().includes('Uploaded video'));
 editor.execute('undo');
 assert.equal(editor.ui.getEditableElement().querySelectorAll('video').length,0);
 editor.execute('redo');
 assert.equal(editor.ui.getEditableElement().querySelectorAll('video').length,1);
 editor.setData('<p>Drop here</p>');
 const repository = editor.plugins.get('FileRepository');
 repository.createUploadAdapter = loader => ({
   upload: () => loader.file.then(file => new Promise(resolve => {
     service.uploadEditorFile((uploadedFile, callback) => {
       assert.equal(uploadedFile.name, 'dragged.mp4');
       callback({default: src});
     }, file, resolve);
   })),
   abort: () => {}
 });
 const dropped = new w.File(['mp4'], 'dragged.mp4', {type: 'video/mp4'});
 const paragraph = editor.model.document.getRoot().getChild(0);
 editor.model.change(writer => writer.setSelection(paragraph, 'end'));
 const viewRange = editor.editing.mapper.toViewRange(editor.model.document.selection.getFirstRange());
 editor.editing.view.document.fire('clipboardInput', {
   dataTransfer: {files: [dropped], types: ['Files'], getData: () => ''},
   targetRanges: [viewRange],
   method: 'drop'
 });
 for (let i = 0; i < 50 && !editor.getData().includes('dragged.mp4'); i++) {
   await new Promise(resolve => w.setTimeout(resolve, 10));
 }
 assert(editor.getData().includes('dragged.mp4'));
 assert.equal(editor.ui.getEditableElement().querySelectorAll('video').length, 1);
 editor.setData('<p><img src="/media/attachments/test.gif"></p>');
 assert.equal(editor.ui.getEditableElement().querySelectorAll('video').length,0);
 assert(editor.getData().includes('test.gif'));
 service.sce = {getTrustedHtml: value => value};
 const renewed = src.replace('token=abc', 'token=renewed');
 service.getCachedAttachment = () => Promise.resolve(renewed);
 const refreshed = await service.refreshAttachmentURL(`<p><a href="${src}">Video</a></p>`);
 read.innerHTML = refreshed;
 service.appendVideoPlayers(read);
 assert.equal(read.querySelector('video').src, renewed);
 stopObserving();
 await editor.destroy();
 dom.window.close();
 console.log('PASS: URL validation, read player, existing links, uploaded links, canonical data, undo/redo, actual MP4 drop, hidden read link, GIF preservation, token renewal');
})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close();});
