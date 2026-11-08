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

const Turndown=require('turndown'),Showdown=require('showdown');
(async()=>{
 const editor=await w.ClassicEditor.create(w.document.querySelector('#editor'),{toolbar:['heading','bold','italic','link','removeFormat'],initialData:'<p>Normal <strong>bold</strong> words <a href="https://example.com">link</a></p>'});
 service.initializeEditorMedia(editor);
 const root=()=>editor.model.document.getRoot();
 const select=(start,end)=>editor.model.change(writer=>writer.setSelection(writer.createRange(writer.createPositionAt(root().getChild(0),start),writer.createPositionAt(root().getChild(0),end))));
 select(7,11);
 editor.execute('fontColor',{value:'red'});
 assert(editor.getData().includes('taiga-text-color-red'));
 assert(editor.getData().includes('<strong>'));
 assert.equal(editor.commands.get('fontColor').value,'red');
 editor.execute('undo');assert(!editor.getData().includes('taiga-text-color-red'));
 editor.execute('redo');assert(editor.getData().includes('taiga-text-color-red'));
 editor.execute('fontColor',{value:'url(evil)'});assert(editor.getData().includes('taiga-text-color-red'));
 editor.execute('fontColor',{value:null});assert(!editor.getData().includes('taiga-text-color-red'));
 editor.execute('fontColor',{value:'blue'});
 editor.execute('removeFormat');assert(!editor.getData().includes('taiga-text-color-blue'));
 select(0,6);editor.execute('fontColor',{value:'green'});
 const beforeReadOnly=editor.getData();editor.isReadOnly=true;
 editor.execute('fontColor',{value:'purple'});assert.equal(editor.getData(),beforeReadOnly);editor.isReadOnly=false;
 // Both the component converter and the shared conversion service must retain inline colors.
 const td=new Turndown();const converter={toMarkdown:html=>td.turndown(html),toHtml:text=>new Showdown.Converter().makeHtml(text)};
 layout.preserveConversion(converter);
 const input='<p>Before <span class="taiga-text-color taiga-text-color-red"><strong>bold red</strong></span> after <a href="https://example.com"><span class="taiga-text-color taiga-text-color-blue">blue link</span></a>.</p><ul><li>A <span class="taiga-text-color taiga-text-color-green">green item</span></li></ul>';
 editor.setData(input);
 const markdown=converter.toMarkdown(editor.getData());
 assert(markdown.includes('taiga-text-color-red'));assert(markdown.includes('taiga-text-color-blue'));assert(markdown.includes('taiga-text-color-green'));assert(!markdown.includes('TAIGALAYOUTBLOCK'));
 editor.setData(converter.toHtml(markdown));
 for(const color of ['red','blue','green'])assert(editor.getData().includes('taiga-text-color-'+color),editor.getData());
 assert(editor.getData().includes('<strong>bold red</strong>'));assert(editor.getData().includes('href="https://example.com"'));
 const plain=w.document.createElement('div');plain.innerHTML=editor.getData();assert(plain.textContent.includes('Before bold red after blue link.'));
 // Collapsed selection colors subsequently typed text, while Automatic removes it.
 editor.setData('<p>Start </p>');editor.model.change(writer=>writer.setSelection(root().getChild(0),'end'));
 editor.execute('fontColor',{value:'purple'});editor.model.change(writer=>writer.insertText('Purple',Object.fromEntries(editor.model.document.selection.getAttributes()),editor.model.document.selection.getFirstPosition()));
 assert(editor.getData().includes('taiga-text-color-purple'));
 const dropdown=editor._taigaColorDropdown;
 assert(dropdown);assert.equal(dropdown.toolbarView.items.length,6);
 editor.setData('<p>Reset me</p>');select(0,8);editor.execute('fontColor',{value:'orange'});
 dropdown.toolbarView.items.get(0).fire('execute');assert(!editor.getData().includes('taiga-text-color-orange'));
 await editor.destroy();w.close();
 console.log('PASS: selected/collapsed text, bold/links/lists, palette, Automatic reset, remove formatting, undo/redo, read-only guard, invalid colors, Markdown save/reopen');
})().catch(error=>{console.error(error);w.close();process.exitCode=1;});
