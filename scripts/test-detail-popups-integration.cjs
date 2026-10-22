const fs=require('fs'),path=require('path'),assert=require('assert');
process.chdir(path.resolve(__dirname,'..'));
const {JSDOM}=require('jsdom'),coffee=require('coffeescript'),jade=require('jade');
const dom=new JSDOM('<body></body>',{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window;
w.$=require('jquery')(w);w._=require('lodash');w.Immutable=require('immutable');
w.eval(fs.readFileSync('node_modules/angular/angular.js','utf8'));
w.taiga={Controller:class {onInitialDataError(error){throw error;}}, PageMixin:class {}, groupBy:(items,key)=>Object.fromEntries(items.map(item=>[key(item),item])), bindMethods:()=>{}, mixOf:(...classes)=>{class Mixed{};for(const base of classes)for(const key of Object.getOwnPropertyNames(base.prototype))if(key!=='constructor')Object.defineProperty(Mixed.prototype,key,Object.getOwnPropertyDescriptor(base.prototype,key));return Mixed;}};
w.taiga.PageMixin.prototype.fillUsersAndRoles=function(){this.scope.activeUsers=[];};
w.legacyChannel={next:()=>{}};
const app=w.angular.module('taigaComponents',[]);
for(const name of ['taigaUserStories','taigaTasks','taigaIssues','taigaEpics'])w.angular.module(name,['taigaComponents']);
app.factory('$exceptionHandler',()=>error=>{throw error;});
app.filter('translate',()=>key=>key);app.filter('emojify',['$sce',sce=>text=>sce.trustAsHtml(text)]);
const originalProject=w.Immutable.fromJS({id:1,slug:'demo',members:[],roles:[],points:[],my_permissions:[],us_statuses:[],task_statuses:[],issue_statuses:[],epic_statuses:[],issue_types:[],severities:[],priorities:[]});
const project={_project:originalProject,_activeMembers:w.Immutable.List()};Object.defineProperty(project,'project',{get(){return this._project;}});
const transform={scope:null,prop:null,setObject(scope,prop){this.scope=scope;this.prop=prop;}};
const originalAttachments=w.Immutable.List(['original']);const attachments={_attachments:originalAttachments};
let opened=0;const created=[];
app.value('tgProjectService',project);app.value('$tgQueueModelTransformation',transform);app.value('tgAttachmentsFullService',attachments);
app.value('lightboxService',{open:()=>opened++});app.value('$tgConfirm',{notify:()=>{throw Error('Unexpected API failure');}});
app.factory('tgProjectsService',['$q',q=>({getProjectBySlug:slug=>q.when(originalProject.set('slug',slug).set('id',2))})]);
app.value('tgLightboxFactory',{create:(name,attrs,scope)=>created.push({name,attrs,scope})});
app.value('$tgRepo',{});app.value('$log',{});app.value('$tgLocation',{search:()=>({})});app.value('$tgNavUrls',{});
app.value('$tgAnalytics',{trackEvent:()=>{}});app.value('$translate',{instant:key=>key});
app.value('tgAppMetaService',{setAll:()=>{throw Error('Popup must not change page metadata');}});
app.value('tgErrorHandlingService',{});app.value('$tgConfig',{config:{}});app.value('$tgModel',{});app.value('tgWysiwygService',{});
app.factory('$tgResources',['$q','$rootScope',(q,root)=>{
 attachments.loadAttachments=()=>{root.$broadcast('attachments:loaded');return q.when();};
 const result={};
 for(const [resource,type] of Object.entries({tasks:'task',userstories:'us',issues:'issue',epics:'epic'}))result[resource]={getByRef:(project,ref)=>q.when({id:8,ref,project,version:1,description:'Rich content',total_comments:2,tags:[],neighbors:{},_attrs:{id:8},_name:resource}),list:()=>q.when([]),storeQueryParams:()=>{}};
 return result;
}]);
app.factory('tgResources',['$q',q=>({userstories:{listInEpic:()=>q.when([])}})]);
const controllers={us:'UserStoryDetailController',task:'TaskDetailController',issue:'IssueDetailController',epic:'EpicDetailController'};
for(const folder of ['tasks','userstories','issues','epics']){
 const source=fs.readFileSync('app/coffee/modules/'+folder+'/detail.coffee','utf8');
 const end=source.indexOf('module.controller(');const last=source.indexOf('\n',end);
 w.eval(coffee.compile(source.slice(0,last)));
}
w.eval(coffee.compile(fs.readFileSync('app/modules/components/detail/detail-popup.coffee','utf8')));
const injector=w.angular.injector(['ng','taigaComponents','taigaUserStories','taigaTasks','taigaIssues','taigaEpics']),root=injector.get('$rootScope'),compile=injector.get('$compile');
injector.get('$templateCache').put('common/lightbox/detail-popup.html',jade.renderFile('app/partials/common/lightbox/detail-popup.jade'));
const service=injector.get('tgDetailPopup');
for(const route of ['project-userstories-detail','project-tasks-detail','project-issues-detail','project-epics-detail']){service.open(route,{project:'demo',ref:12});root.$digest();}
assert.deepEqual(created.map(item=>item.scope.popupType),['us','task','issue','epic']);
service.open('project-epics-detail',{project:'other',ref:12});root.$digest();assert.equal(created.at(-1).scope.popupProject.get('id'),2);
function popup(type,projectData=originalProject){const scope=root.$new();Object.assign(scope,{popupType:type,popupRef:12,popupProject:projectData});const el=compile('<div tg-detail-popup></div>')(scope);w.$('body').append(el);root.$digest();return {scope,el};}
for(const type of Object.keys(controllers)){
 const {scope,el}=popup(type);
 assert.equal(el.find('tg-item-wysiwyg').length,1,type+' rich description');assert.equal(el.find('tg-attachments-full').length,1,type+' gallery');assert.equal(el.find('tg-history-section').length,1,type+' comments');
 if(type==='us'){assert.equal(el.find('.story-metadata').length,1);assert.equal(el.find('.story-discussion tg-history-section').length,1);assert.equal(el.find('.main tg-history-section').length,0);}
 assert.equal(el.find('tg-project-menu').length,0);scope.$destroy();el.remove();assert.equal(transform.scope,null);assert.equal(attachments._attachments,originalAttachments);
}
const parent=popup('us'),parentAttachments=attachments._attachments;
const child=popup('epic',originalProject.set('id',2).set('slug','other'));
assert.equal(project.project.get('id'),2);child.scope.$destroy();child.el.remove();
assert.equal(transform.scope,parent.scope);assert.equal(attachments._attachments,parentAttachments);assert.equal(project.project,originalProject);
parent.scope.$destroy();parent.el.remove();assert.equal(transform.scope,null);assert.equal(attachments._attachments,originalAttachments);
assert.equal(opened,6);dom.window.close();console.log('PASS: actual detail controllers inside all four popup templates, metadata isolation, cross-project lookup and nested context restoration');
