const fs=require('fs'),path=require('path'),assert=require('assert');
process.chdir(path.resolve(__dirname,'..'));
const {JSDOM}=require('jsdom'),coffee=require('coffeescript'),jade=require('jade');
const dom=new JSDOM('<!doctype html><body></body>',{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window;
w.Immutable=require('immutable');w._=require('lodash');w.taiga={Service:class{},defineImmutableProperty:(obj,key,get)=>Object.defineProperty(obj,key,{get})};
w.eval(fs.readFileSync('node_modules/angular/angular.js','utf8'));
const app=w.angular.module('taigaComponents',[]),calls=[];let listed=[];
app.factory('$exceptionHandler',()=>error=>{throw error;});app.filter('translate',()=>v=>v);app.filter('sizeFormat',()=>v=>v);
app.factory('tgAttachmentsService',['$q',q=>({types:{},validate:()=>true,list:()=>q.when(w.Immutable.fromJS(listed)),delete:(...args)=>{calls.push(['delete',...args]);return q.when();},patch:(...args)=>{calls.push(['patch',...args]);return q.when();},bulkUpdateOrder:(...args)=>{calls.push(['order',...args]);return q.when();}})]);
w.eval(coffee.compile(fs.readFileSync('app/modules/components/attachments-full/attachments-full.service.coffee','utf8')));
const injector=w.angular.injector(['ng','taigaComponents']),root=injector.get('$rootScope'),service=injector.get('tgAttachmentsFullService');
const tick=()=>root.$digest();
try {
 listed=[{id:31,source_task_id:9,order:0,name:'child.gif',is_deprecated:false,url:'/child.gif'},{id:10,order:1,name:'own.txt',is_deprecated:false},{id:11,order:2,name:'own.gif',is_deprecated:false}];
 service.loadAttachments('us',2,1);tick();assert.deepEqual(Array.from(service.attachments,x=>x.getIn(['file','id'])),[10,11,31]);const child=service.attachments.last();assert.equal(child.get('inherited'),true);assert.equal(child.getIn(['file','url']),'/child.gif');
 let rejected=0;service.deleteAttachment(child,'us').catch(()=>rejected++);service.updateAttachment(child.set('editable',true),'us').catch(()=>rejected++);service.reorderAttachment(2,'us',child,0).catch(()=>rejected++);tick();assert.equal(rejected,3);assert.equal(calls.length,0);
 const owned=service.attachments.first();service.reorderAttachment(2,'us',owned,20);tick();assert.deepEqual(Array.from(service.attachments,x=>x.getIn(['file','id'])),[11,10,31]);assert.equal(calls[0][3],11,'Story reorder must use a story-owned predecessor');assert.equal(service.attachments.last().getIn(['file','order']),0,'Task order remains unchanged');
 for(const name of ['attachment','attachment-gallery']){
  const html=jade.renderFile('app/modules/components/attachment/'+name+'.jade');
  const scope=root.$new();scope.vm={attachment:child,type:'us'};const el=w.angular.element('<div>'+html+'</div>');injector.get('$compile')(el)(scope);root.$digest();
  assert.equal(el[0].querySelectorAll('.e2e-edit,.e2e-delete,.icon-delete').length,0,'Inherited controls hidden in '+name);assert(el[0].querySelector('a[href="/child.gif"]'),'Inherited file remains downloadable/previewable');scope.$destroy();
 }
 service.loadAttachments('task',9,1);tick();assert.equal(service.attachments.first().get('inherited'),false,'Task files remain owned in the task view');
 service.deleteAttachment(service.attachments.first(),'task');tick();assert.equal(calls.at(-1)[0],'delete');assert.equal(calls.at(-1)[1],'task');
 // Shared preview must not provide mutation controls for inherited files.
 const controllers={};const vm=require('vm');vm.runInNewContext(coffee.compile(fs.readFileSync('app/modules/components/attachments-preview/attachments-preview.controller.coffee','utf8')),{angular:{module:()=>({controller:(n,c)=>controllers[n]=c})},taiga:{}});
 const preview=Object.create(controllers.AttachmentsPreview.prototype);preview.attachments=w.Immutable.List([child]);preview.attachmentsPreviewService={fileId:31};assert.equal(preview.canManageCurrent(),false);preview.beginEdit();assert(!preview.editing);
 const requestCalls=[];w.angular.module('taigaResources2',[]).value('$tgUrls',{resolve:key=>key}).value('$tgHttp',{get:(...args)=>{requestCalls.push(args);return injector.get('$q').when({data:[]});}}).value('$tgConfig',{}).value('$tgStorage',{});
 w.eval(coffee.compile(fs.readFileSync('app/modules/resources/attachments-resource.service.coffee','utf8')));
 const resources=w.angular.injector(['ng','taigaResources2']).get('tgAttachmentsResource')().attachments;
 resources.list('us',2,1);resources.list('task',9,1);assert.equal(requestCalls[0][1].include_task_attachments,1);assert.equal(requestCalls[1][1].include_task_attachments,undefined);
 console.log('PASS: inherited files display with original URLs, owned ordering is isolated, inherited mutations are blocked, list/gallery/preview controls are read-only, task owners retain controls and only story requests enable inheritance.');
} finally {root.$destroy();dom.window.close();}
