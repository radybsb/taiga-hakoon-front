// Run with TAIGA_EDITOR_BUILD=elements node taiga-front/scripts/test-editor-video-upload.cjs
const fs=require('fs'),path=require('path'),assert=require('assert');
process.chdir(path.resolve(__dirname,'..'));
const coffee=require('coffeescript'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><tg-text-editor><div class="edit-mode"><div id="editor"></div></div></tg-text-editor>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;w._=require('lodash');w.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}};
w.Range.prototype.getClientRects=()=>[];w.Range.prototype.getBoundingClientRect=()=>({top:0,left:0,bottom:0,right:0,width:0,height:0});w.scrollTo=()=>{};
const services={};w.angular={module:()=>({service:(name,cls)=>services[name]=cls})};
for(const f of ['wysiwyg-layout.service.coffee','wysiwyg.service.coffee'])w.eval(coffee.compile(fs.readFileSync('app/modules/components/wysiwyg/'+f,'utf8')));
const layout=new services.tgWysiwygLayoutService({instant:key=>key.split('.').pop()});
const service=new services.tgWysiwygService(null,null,null,null,layout);
const componentConverter={toMarkdown:html=>html};
w.document.querySelector('tg-text-editor').ngElementStrategy={componentRef:{instance:{dataConversionService:componentConverter}}};
if(process.env.TAIGA_EDITOR_BUILD === 'elements') {
 // Load the production editor module without bootstrapping the Angular application.
 const bundle=fs.readFileSync('elements.js','utf8').replace('l.m=e','window.__bundleRequire=l;l.m=e').replace(',[[0,0]]])',',[]])');
 w.eval(bundle);
 const id=Object.keys(w.__bundleRequire.m).find(id=>w.__bundleRequire.m[id].toString().includes('ty.defaultConfig='));
 assert(id,'Production editor module must be found');
 w.ClassicEditor=w.__bundleRequire(id);
} else {
 w.eval(fs.readFileSync('node_modules/taiga-html-editor/packages/ckeditor5-build-classic/build/ckeditor.js','utf8'));
}
const image=id=>`<figure class="image"><img src="/media/attachments/${id}.png#_taiga-width=120"></figure>`;
const video='<p><a href="/media/attachments/a.mp4#_taiga-width=120">Video</a> </p>';
(async()=>{
 const errors=[];
 w.addEventListener('error',event=>{errors.push(event.error || event.message);event.preventDefault();});
 const editor=await w.ClassicEditor.create(w.document.querySelector('#editor'),{toolbar:['heading'],initialData:image(1)+'<p></p>'});
 service.enableEditorVideos(editor);layout.enable(editor);service.enableMediaResize(editor);
 const repository=editor.plugins.get('FileRepository');
 repository.createUploadAdapter=loader=>({upload:()=>loader.file.then(file=>new Promise(resolve=>w.setTimeout(()=>{
   service.uploadEditorFile((uploaded,callback)=>callback({default:'/media/attachments/'+uploaded.name}),file,resolve);
 },file.name.length%3))),abort:()=>{}});
 for(let i=0;i<20;i++){
   editor.setData(image(1)+'<p></p>');
   const paragraph=editor.model.document.getRoot().getChild(1);
   editor.model.change(writer=>writer.setSelection(paragraph,'end'));
   const viewRange=editor.editing.mapper.toViewRange(editor.model.document.selection.getFirstRange());
   const files=[new w.File(['mp4'],'a-'+i+'.mp4',{type:'video/mp4'}),new w.File(['mp4'],'longer-clip-'+i+'.mp4',{type:'video/mp4'})];
   editor.editing.view.document.fire('clipboardInput',{dataTransfer:{files,types:['Files'],dropEffect:'copy',getData:()=>''},target:editor.editing.view.document.getRoot(),targetRanges:[viewRange],method:'drop'});
   for(let j=0;j<100 && editor.ui.getEditableElement().querySelectorAll('video').length<2;j++)await new Promise(resolve=>w.setTimeout(resolve,5));
   assert.equal(errors.length,0,String(errors[0]));
   assert.equal(editor.ui.getEditableElement().querySelectorAll('video').length,2);
   const players=editor.ui.getEditableElement().querySelectorAll('video');
   players[1].dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
   assert.equal(editor._taigaLayoutViews.gap.isEnabled,true,'Gap must work with two uploaded videos: '+editor.getData());
   assert.equal(editor._taigaLayoutViews.join.isEnabled,true,'Join must work with two uploaded videos');
   editor._taigaLayoutViews.join.element.click();
   editor._taigaLayoutViews.gap.buttonView.element.click();
   editor._taigaLayoutViews.gap.toolbarView.items.find(item=>item.label==='24 px').element.click();
   assert(editor.getData().includes('taiga-gap-24'));
   const saved=editor.getData();
   editor.execute('undo');editor.execute('redo');
   editor.setData(saved);
   assert.equal(editor.ui.getEditableElement().querySelectorAll('.taiga-media-row video').length,2);
 }
 for(const text of ['Before ', '']) {
   editor.setData('<p>'+text+'<a href="/media/attachments/mixed.mp4">Video</a> After</p>');
   editor.ui.getEditableElement().querySelector('video').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
   assert.equal(editor._taigaLayoutViews.gap.isEnabled,true);
   editor._taigaLayoutViews.gap.buttonView.element.click();
   editor._taigaLayoutViews.gap.toolbarView.items.find(item=>item.label==='24 px').element.click();
   const saved=editor.getData();
   assert(saved.includes('After'),saved);
   if(text)assert(saved.includes('Before'),saved);
   assert.equal(editor.ui.getEditableElement().querySelectorAll('.taiga-media-row video').length,1);
   editor.execute('undo');editor.execute('redo');
   assert.equal(errors.length,0,String(errors[0]));
 }
 // Exercise the actual native type-around buttons, including row splitting.
 for(const side of ['before','after']) {
   for(const inRow of [false,true]) {
     editor.setData(inRow ? '<div class="taiga-media-row taiga-gap-16">'+image(1)+video.replace(/<\/?p>/g,'')+image(2)+'</div>' : video);
     const button=editor.ui.getEditableElement().querySelector('.inline-video .ck-widget__type-around__button_'+side);
     assert(button,'Video must expose native '+side+' paragraph control');
     assert.equal(button.title,'Insert paragraph '+side+' block');
     button.dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
     const root=editor.model.document.getRoot();
     const blocks=Array.from(root.getChildren());
     const paragraph=blocks.find(node=>node.name==='paragraph' && node.isEmpty);
     assert(paragraph,'Native control must insert a paragraph: '+editor.getData());
     assert.equal(editor.model.document.selection.anchor.parent,paragraph);
     if(inRow) {
       assert.equal(blocks[0].name,'taigaMediaRow');
       assert.equal(blocks[0].childCount,side==='before'?1:2);
       assert.equal(blocks[1],paragraph);
       assert.equal(blocks[2].name,'taigaMediaRow');
       assert.equal(blocks[2].childCount,side==='before'?2:1);
     }
     assert.equal(editor.ui.getEditableElement().querySelectorAll('video').length,1);
     assert(!editor.getData().includes('ck-widget__type-around'));
     editor.execute('undo');editor.execute('redo');
     assert.equal(errors.length,0,String(errors[0]));
   }
 }
 for(const side of ['before','after']) {
   editor.setData('<p>Before <a href="/media/attachments/text.mp4">Video</a> After</p>');
   let button=editor.ui.getEditableElement().querySelector('.inline-video .ck-widget__type-around__button_'+side);
   editor.isReadOnly=true;
   const unchanged=editor.getData();
   button.dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
   assert.equal(editor.getData(),unchanged);
   editor.isReadOnly=false;
   button=editor.ui.getEditableElement().querySelector('.inline-video .ck-widget__type-around__button_'+side);
   button.dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
   assert(editor.getData().includes('Before'));assert(editor.getData().includes('After'));
   assert(editor.model.document.selection.anchor.parent.isEmpty);
   editor.execute('undo');assert.equal(editor.getData(),unchanged);
 }
 await editor.destroy();dom.window.close();console.log('PASS: repeated MP4 drops, selection, native paragraph controls before/after, row splitting, text preservation, readonly and undo/redo');
})().catch(error=>{console.error(error);process.exitCode=1;dom.window.close();});
