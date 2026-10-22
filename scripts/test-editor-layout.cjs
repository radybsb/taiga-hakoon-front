// Run from taiga-front: node scripts/test-editor-layout.cjs
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
w.document.querySelector('tg-text-editor').ngElementStrategy={strategy:{componentRef:{instance:{dataConversionService:componentConverter}}}};
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
 const component=w.document.querySelector('tg-text-editor').ngElementStrategy.strategy.componentRef.instance;
 const originalRow='<div class="taiga-media-row taiga-gap-48 taiga-align-center">'+image(1)+image(2)+video.replace(/<\/?p>/g,'')+'</div>';
 const firstHost=w.document.createElement('div');w.document.querySelector('tg-text-editor .edit-mode').appendChild(firstHost);
 component.contentHtml=originalRow;
 const first=await w.ClassicEditor.create(firstHost,{toolbar:['heading'],initialData:originalRow});
 assert(!first.getData().includes('taiga-media-row'),'Reproduce initial parse without custom schema');
 service.initializeEditorMedia(first);
 assert.equal(first.model.document.getRoot().getChild(0).name,'taigaMediaRow');
 assert.equal(first.model.document.getRoot().getChild(0).childCount,3);
 assert.equal(first.model.document.getRoot().getChild(0).getAttribute('taigaGap'),'48');
 assert.equal(first.model.document.getRoot().getChild(0).getAttribute('taigaAlignment'),'center');
 first.model.change(writer=>writer.setAttribute('taigaGap','72',first.model.document.getRoot().getChild(0)));
 service.initializeEditorMedia(first);
 assert.equal(first.model.document.getRoot().getChild(0).getAttribute('taigaGap'),'72','Repeated observer must not reload stale content');
 await first.destroy();delete component.contentHtml;
 const editor=await w.ClassicEditor.create(w.document.querySelector('#editor'),{toolbar:process.env.TAIGA_EDITOR_BUILD==='elements'?['heading','todoList','bulletedList','numberedList','alignment','removeFormat']:['heading','bulletedList','numberedList','removeFormat'],initialData:image(1)+image(2)+video});
 service.enableEditorVideos(editor);layout.enable(editor);service.enableMediaResize(editor);
 assert.equal(componentConverter._taigaLayout,true,'Mode-switch converter must preserve layout too');
 const toolbarItems=Array.from(editor.ui.view.toolbar.items);
 const headingView=toolbarItems.find(view=>view.element?.classList.contains('ck-heading-dropdown'));
 assert.equal(headingView.buttonView.label,'Tt');
 const listView=toolbarItems.find(view=>view.toolbarView && view.buttonView?.label==='Bulleted List');
 assert(listView,'Lists must be grouped');
 assert.equal(listView.toolbarView.items.length,process.env.TAIGA_EDITOR_BUILD==='elements'?3:2);
 assert(!toolbarItems.some(view=>['Bulleted List','Numbered List','To-do List'].includes(view.label)));
 const removeIndex=toolbarItems.findIndex(view=>view.label?.toLowerCase()==='remove format');
 assert(removeIndex>1); assert.equal(toolbarItems[removeIndex-2],editor._taigaLayoutViews.join); assert.equal(toolbarItems[removeIndex-1],editor._taigaLayoutViews.gap);
 const toolbarTestData=editor.getData(); editor.setData('<p>List item</p>');
 editor.model.change(writer=>writer.setSelection(editor.model.document.getRoot().getChild(0),0));
 editor.execute('heading',{value:'heading1'}); assert.equal(headingView.buttonView.label,'Tt');
 listView.buttonView.element.click(); assert(listView.isOpen);
 listView.toolbarView.items.find(view=>view.label==='Bulleted List').element.click(); assert.equal(listView.isOpen,false);
 assert(editor.commands.get('bulletedList').value); editor.execute('undo'); editor.execute('undo'); editor.setData(toolbarTestData);
 // CKEditor parses icon strings as XML and moves their paths into its SVG view.
 // Paths without the SVG namespace exist in the DOM but do not render.
 const iconViews=editor._taigaLayoutViews;
 for(const view of [iconViews.alignment.buttonView,iconViews.join,iconViews.gap.buttonView,...Array.from(iconViews.alignment.toolbarView.items)]) {
   const paths=view.element.querySelectorAll('svg path');
   assert(paths.length,'Icon must contain a rendered path: '+view.label);
   for(const path of paths)assert.equal(path.namespaceURI,'http://www.w3.org/2000/svg',view.label);
 }

 const root=()=>editor.model.document.getRoot();
 const select=node=>editor.model.change(writer=>writer.setSelection(node,'on'));
 select(root().getChild(1));
 editor._taigaLayoutViews.join.element.click();
 assert.equal(root().getChild(0).name,'taigaMediaRow');assert.equal(root().getChild(0).childCount,2);
 const actions=editor._taigaLayoutActions;
 editor._taigaLayoutViews.alignment.buttonView.element.click();
 assert.equal(editor._taigaLayoutViews.alignment.isOpen,true);
 editor._taigaLayoutViews.alignment.toolbarView.items.find(item=>item.label==='Align center').element.click();
 assert.equal(editor._taigaLayoutViews.alignment.isOpen,false);
 assert.equal(root().getChild(0).getAttribute('taigaAlignment'),'center','align row');
 editor._taigaLayoutViews.gap.buttonView.element.click();
 editor._taigaLayoutViews.gap.toolbarView.items.find(item=>item.label==='24 px').element.click();
 assert.equal(root().getChild(0).getAttribute('taigaGap'),'24');
 select(root().getChild(1).getChild(0));actions.join();
 assert.equal(root().childCount,1);assert.equal(root().getChild(0).childCount,3,editor.getData());
 assert.equal(editor.ui.getEditableElement().querySelectorAll('.taiga-media-row video').length,1);
 const rowData=editor.getData();assert(rowData.includes('taiga-align-center'));assert(rowData.includes('taiga-gap-24'));
 editor.setData(rowData);assert.equal(root().getChild(0).childCount,3,editor.getData());
 select(root().getChild(0).getChild(1));actions.newLine();
 assert.equal(root().childCount,2);assert.equal(root().getChild(0).childCount,2);assert.equal(root().getChild(1).childCount,1);
 editor.execute('undo');assert.equal(root().childCount,1);editor.execute('redo');assert.equal(root().childCount,2);
 select(root().getChild(1).getChild(0));actions.newLine();assert.equal(root().getChild(2).name,'paragraph');
 editor.model.change(writer=>writer.insertText('Centered text',root().getChild(2),0));
 actions.align('center');assert.equal(root().getChild(2).getAttribute('taigaAlignment'),'center','text alignment: '+editor.getData());
 editor.isReadOnly=true;const beforeReadOnly=editor.getData();editor._taigaLayoutViews.alignment.toolbarView.items.find(item=>item.label==='Align right').element.click();assert.equal(editor.getData(),beforeReadOnly);editor.isReadOnly=false;
 if(editor.commands.get('alignment')) {
   editor._taigaLayoutViews.alignment.buttonView.element.click();
   editor._taigaLayoutViews.alignment.toolbarView.items.find(item=>item.label==='Align right').element.click();
   assert.equal(root().getChild(2).getAttribute('taigaAlignment'),'right');
   assert(!root().getChild(2).hasAttribute('alignment'));
   editor._taigaLayoutViews.alignment.buttonView.element.click();
   editor._taigaLayoutViews.alignment.toolbarView.items.find(item=>item.label==='Align center').element.click();
 }
 const saved=editor.getData();editor.setData(saved);assert.equal(root().getChild(2).getAttribute('taigaAlignment'),'center','text alignment: '+editor.getData());
 // Use the same HTML/Markdown algorithms as the editor integration.
 const Turndown=require('turndown'),Showdown=require('showdown');
 const td=new Turndown();const converter={toMarkdown:html=>td.turndown(html),toHtml:text=>new Showdown.Converter().makeHtml(text)};
 layout.preserveConversion(converter);layout.preserveConversion(converter);
 const markdown=converter.toMarkdown(saved);assert(markdown.includes('taiga-media-row'));assert(markdown.includes('taiga-align-center'));assert(!markdown.includes('TAIGALAYOUTBLOCK'));
 editor.setData(converter.toHtml(markdown));assert.equal(root().getChild(0).childCount,2);assert.equal(root().getChild(1).childCount,1);assert.equal(root().getChild(2).getAttribute('taigaAlignment'),'center','text alignment: '+editor.getData());
 // Backend rendering may strip figure wrappers, while retaining div/img/a/classes.
 editor.setData(converter.toHtml(markdown).replace(/<figure[^>]*>|<\/figure>/g,''));
 assert.equal(root().getChild(0).childCount,2);assert.equal(root().getChild(1).childCount,1);
 const read=w.document.createElement('div');read.innerHTML=converter.toHtml(markdown);service.appendVideoPlayers(read);
 assert.equal(read.querySelectorAll('.taiga-media-row').length,2);assert.equal(read.querySelector('video').style.width,'120px');
 // The existing hover control splits a media row without an extra toolbar button.
 editor.setData(rowData);
 editor.execute('insertParagraph',{position:editor.model.createPositionAfter(root().getChild(0).getChild(1))});
 assert.equal(root().getChild(0).childCount,2);assert.equal(root().getChild(1).name,'paragraph');assert.equal(root().getChild(2).childCount,1);
 assert.equal(w.document.querySelectorAll('.taiga-layout-toolbar').length,0,'No duplicate toolbar');
 assert.equal(Array.from(editor._taigaLayoutViews.alignment.toolbarView.items).filter(item=>item.label==='Align center').length,1);
 assert(!Array.from(editor.ui.view.toolbar.items).some(item=>item.label==='NEW_LINE'));
 assert(editor.ui.view.toolbar.items.has(editor._taigaLayoutViews.join));
 assert(editor.ui.view.toolbar.items.has(editor._taigaLayoutViews.gap));
 // Repeated attachment insertion, row changes and undo/redo must not expose
 // transient model positions to selection-dependent toolbar state.
 for(let i=0;i<25;i++) {
   editor.setData(image(3)+'<p></p>');
   const paragraph=root().getChild(1);
   editor.model.change(writer=>{
     writer.setSelection(paragraph,0);
     writer.insertText('clip-'+i+'.mp4',{linkHref:'/media/attachments/clip.mp4'},paragraph,0);
     writer.insertText(' ',paragraph,'end');
     writer.setSelection(paragraph,'end');
   });
   const player=editor.ui.getEditableElement().querySelector('video');
   player.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
   assert.equal(editor._taigaLayoutViews.join.isEnabled,true);
   assert.equal(editor._taigaLayoutViews.gap.isEnabled,true);
   editor._taigaLayoutViews.join.element.click();
   editor.execute('undo');editor.execute('redo');
 }
 await editor.destroy();assert.equal(w.document.querySelectorAll('.taiga-layout-toolbar').length,0);dom.window.close();
 console.log('PASS: integrated alignment dropdown and media icons, native hover line break, mixed image/video rows, manual breaks, gap, alignment, undo/redo, Markdown roundtrip and read rendering');
})().catch(error=>{console.error(error);process.exitCode=1;dom.window.close();});
