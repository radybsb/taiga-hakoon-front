// Run from taiga-front: node scripts/test-media-resize.cjs
const fs = require('fs');
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
const coffee = require('coffeescript');
const assert = require('assert');
const {JSDOM} = require(process.cwd() + '/node_modules/jsdom');
const dom = new JSDOM('<!doctype html><div id="editor"></div>', {url:'http://localhost:9000/',runScripts:'outside-only',pretendToBeVisual:true});
const w = dom.window;
w._ = require('lodash');
const resizeObservers=[];
w.ResizeObserver = class {
 constructor(callback){this.callback=callback;this.targets=new Set();resizeObservers.push(this);}
 observe(target){this.targets.add(target);}unobserve(target){this.targets.delete(target);}
 disconnect(){this.targets.clear();}
};
w.Range.prototype.getClientRects = () => [];
w.Range.prototype.getBoundingClientRect = () => ({top:0,left:0,bottom:0,right:0,width:0,height:0});
w.scrollTo = () => {};
let Service;
w.angular = {module:()=>({service:(name, cls)=>Service=cls})};
w.eval(coffee.compile(fs.readFileSync('app/modules/components/wysiwyg/wysiwyg.service.coffee', 'utf8')));
const service = new Service(null,null,null,null);
const src = 'http://localhost:9000/media/attachments/a/test.mp4?token=abc#_taiga-refresh=userstory:8';
assert(service.isVideoAttachmentURL(src));
assert.equal(service.mediaWidth(service.sizedMediaURL(src, 400)), 400);
assert.equal(service.mediaWidth(service.sizedMediaURL(service.sizedMediaURL(src, 400), 500)), 500);
assert.equal(service.mediaWidth('/test.png#_taiga-width=99999'), undefined);
assert.equal(service.mediaWidth('/test.png#_taiga-width=0'), undefined);
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
 // Resize the real editing widgets and verify persistence and undo/redo.
 const host = editor.ui.getEditableElement();
 host.parentElement.classList.add('edit-mode');
 Object.defineProperty(host, 'clientWidth', {value: 800});
 host.parentElement.getBoundingClientRect = () => ({left:-20, top:-30});
 host.parentElement.scrollLeft = 5;host.parentElement.scrollTop = 7;
 const resize = (media, corner, dx, dy) => {
   media.getBoundingClientRect = () => ({left:10, top:10, width:320, height:180});
   media.dispatchEvent(new w.MouseEvent('click', {bubbles:true}));
   const overlay = w.document.querySelector('.taiga-media-resize');
   assert(!overlay.hidden);
   assert.equal(overlay.parentElement,host.parentElement,'Resize chrome stays in the content stacking context');
   assert.equal(overlay.style.left,'35px');assert.equal(overlay.style.top,'47px');
   overlay.querySelector('.' + corner).dispatchEvent(new w.MouseEvent('pointerdown', {bubbles:true,clientX:100,clientY:100}));
   w.document.dispatchEvent(new w.MouseEvent('pointermove', {buttons:1,clientX:100+dx,clientY:100+dy}));
   w.document.dispatchEvent(new w.MouseEvent('pointerup'));
 };
 for (const type of ['image', 'video']) {
   editor.setData(type === 'image' ? '<p><img src="/media/attachments/test.gif#_taiga-refresh=userstory:8"></p>' : `<p><a href="${src}">Video</a></p>`);
   for (const [corner, dx, dy] of [['se',80,45], ['nw',-80,-45], ['ne',80,-45], ['sw',-80,45]]) {
     const media = host.querySelector(type === 'image' ? 'img' : 'video');
     resize(media, corner, dx, dy);
     assert(editor.getData().includes('_taiga-width=400'), editor.getData());
     editor.execute('undo');
     assert(!editor.getData().includes('_taiga-width='), type + corner + editor.getData());
     editor.execute('redo');
     assert(editor.getData().includes('_taiga-width=400'));
     const saved = editor.getData();
     editor.setData(saved);
     await new Promise(resolve => w.setTimeout(resolve, 0));
     assert.equal(host.querySelector(type === 'image' ? 'img' : 'video').style.width, '400px');
     // Restore the original for the next corner.
     editor.setData(saved.replace(/&(?:amp;)?_taiga-width=400/g, ''));
   }
 }
 // Release over native controls must end dragging, even if bubbling is blocked.
 for (const type of ['image','video']) {
   for (const ending of ['pointerup','pointercancel','lostpointercapture','buttonsReleased']) {
     editor.setData(type === 'image' ? '<p><img src="/media/attachments/test.gif"></p>' : `<p><a href="${src}">Video</a></p>`);
     const media=host.querySelector(type === 'image' ? 'img' : 'video');
     media.getBoundingClientRect=()=>({left:10,top:10,width:320,height:180});
     media.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
     const handle=w.document.querySelector('.taiga-media-resize .se');
     let captured=false;
     handle.setPointerCapture=id=>{assert.equal(id,7);captured=true;};
     handle.hasPointerCapture=id=>captured && id===7;
     handle.releasePointerCapture=id=>{assert.equal(id,7);captured=false;};
     const pointer=(name,buttons,x=100,y=100)=>{
       const event=new w.MouseEvent(name,{bubbles:true,cancelable:true,buttons,clientX:x,clientY:y});
       Object.defineProperty(event,'pointerId',{value:7});return event;
     };
     handle.dispatchEvent(pointer('pointerdown',1));assert(captured);
     media.dispatchEvent(pointer('pointermove',1,180,145));
     if(ending==='buttonsReleased')media.dispatchEvent(pointer('pointermove',0,190,150));
     else if(ending==='lostpointercapture')handle.dispatchEvent(pointer(ending,0));
     else {
       media.addEventListener(ending,event=>event.stopImmediatePropagation(),{once:true});
       media.dispatchEvent(pointer(ending,0));
     }
     assert(!captured,'Capture must be released: '+ending);
     const saved=editor.getData(),width=media.style.width;
     assert(saved.includes('_taiga-width=400'),saved);
     media.dispatchEvent(pointer('pointermove',1,250,180));
     assert.equal(editor.getData(),saved,'Model must stop changing: '+ending);
     assert.equal(media.style.width,width,'Visual width must stop changing: '+ending);
     editor.execute('undo');assert(!editor.getData().includes('_taiga-width='));
     editor.execute('redo');assert(editor.getData().includes('_taiga-width=400'));
   }
 }
 // Metadata/layout changes can happen after a drag has finished.
 editor.setData(`<p><a href="${src}">Video</a></p>`);
 const measuredVideo=host.querySelector('video');
 let actualHeight=180;
 measuredVideo.getBoundingClientRect=()=>({left:10,top:10,width:320,height:actualHeight});
 measuredVideo.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
 const frame=w.document.querySelector('.taiga-media-resize');
 assert.equal(frame.style.height,'180px');
 actualHeight=240;measuredVideo.dispatchEvent(new w.Event('loadedmetadata'));
 assert.equal(frame.style.height,'240px','Metadata must realign the frame');
 const observer=resizeObservers.find(item=>item.targets.has(measuredVideo));assert(observer);
 actualHeight=300;observer.callback();
 assert.equal(frame.style.height,'300px','Intrinsic/layout resize must realign the frame');
 const sized = service.sizedMediaURL(src, 400);
 const refreshedSized = await service.refreshAttachmentURL(`<a href="${sized}">Video</a>`);
 assert(refreshedSized.includes('_taiga-width=400'));
 assert(refreshedSized.includes('token=renewed'));
 read.innerHTML = refreshedSized;
 service.appendVideoPlayers(read);
 assert.equal(read.querySelector('video').style.width, '400px');
 stopObserving();
 await editor.destroy();
 assert.equal(w.document.querySelectorAll('.taiga-media-resize').length, 0);
 dom.window.close();
 console.log('PASS: corner resizing, persistence, image/video undo/redo, cleanup, URL validation, read player, existing links, uploaded links, canonical data, undo/redo, actual MP4 drop, hidden read link, GIF preservation, token renewal');
})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close();});
