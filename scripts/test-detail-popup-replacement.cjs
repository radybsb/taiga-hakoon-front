const fs=require('fs'),path=require('path'),assert=require('assert');
process.chdir(path.resolve(__dirname,'..'));
const {JSDOM}=require('jsdom'),coffee=require('coffeescript'),jade=require('jade');
const dom=new JSDOM('<body></body>',{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window;
w.$=require('jquery')(w);w._=require('lodash');w.Immutable=require('immutable');
w.eval(fs.readFileSync('node_modules/angular/angular.js','utf8'));
w.taiga={Service:class {},Controller:class {onInitialDataError(error){throw error;}}, PageMixin:class {}, groupBy:(items,key)=>Object.fromEntries(items.map(item=>[key(item),item])), bindMethods:()=>{}, mixOf:(...classes)=>{class Mixed{};for(const base of classes)for(const key of Object.getOwnPropertyNames(base.prototype))if(key!=='constructor')Object.defineProperty(Mixed.prototype,key,Object.getOwnPropertyDescriptor(base.prototype,key));return Mixed;}};
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
app.value('animationFrame',{add:fn=>fn()});
const lightboxSource=fs.readFileSync('app/coffee/modules/common/lightboxes.coffee','utf8');
const serviceStart=lightboxSource.indexOf('class LightboxService extends');
const serviceEnd=lightboxSource.indexOf('\n\nclass LightboxKeyboardNavigationService',serviceStart);
w.eval(coffee.compile('module = angular.module("taigaComponents")\n'+lightboxSource.slice(serviceStart,serviceEnd)));
w.eval(coffee.compile(fs.readFileSync('app/modules/components/detail/detail-popup.coffee','utf8')));
const injector=w.angular.injector(['ng','taigaComponents','taigaUserStories','taigaTasks','taigaIssues','taigaEpics']),root=injector.get('$rootScope'),compile=injector.get('$compile');
injector.get('$templateCache').put('common/lightbox/detail-popup.html',jade.renderFile('app/partials/common/lightbox/detail-popup.jade'));
const service=injector.get('tgDetailPopup'),lightbox=injector.get('lightboxService');
injector.get('tgLightboxFactory').create=(name,attrs,data)=>{
 const scope=root.$new();Object.assign(scope,data);
 const el=w.$('<div>').attr(name,true).attr(attrs).addClass('remove-on-close').data('scope',scope);
 compile(el)(scope);w.$('body').append(el);
};
const active=()=>w.$('.lightbox-task-detail');
for(const type of ['userstories','epics','userstories','tasks','userstories','epics']){
 const old=active()[0];
 service.open('project-'+type+'-detail',{project:'demo',ref:12});root.$digest();
 assert.equal(active().length,1,'Detail navigation must replace rather than stack');
 if(old)assert.equal(w.document.body.contains(old),false,'Previous detail must be removed');
 assert.equal(lightbox.opened.length,1,'Only the current detail retains keyboard handlers');
 assert.equal(transform.scope,active().data('scope'));
}
// Media previews may overlay a detail; both are released when navigating away.
const preview=w.$('<div class="lightbox preview"><p>Media</p></div>');active().children('.lightbox-panel').append(preview);
lightbox.open(preview);root.$digest();assert.equal(lightbox.opened.length,2);
service.open('project-userstories-detail',{project:'demo',ref:12});root.$digest();
assert.equal(active().length,1);assert.equal(w.$('.preview').length,0);assert.equal(lightbox.opened.length,1);
// Rapid competing lookups must not create multiple dialogs.
service.open('project-tasks-detail',{project:'demo',ref:12});
service.open('project-epics-detail',{project:'other',ref:12});root.$digest();
assert.equal(active().length,1);assert.equal(active().data('scope').popupType,'epic');
assert.equal(project.project.get('slug'),'other');
lightbox.close(active());root.$digest();
assert.equal(active().length,0);assert.equal(transform.scope,null);assert.equal(project.project,originalProject);assert.equal(attachments._attachments,originalAttachments);assert.equal(lightbox.opened.length,0);
// The pre-existing taskboard task dialog participates in replacement too.
const legacyScope=root.$new(),legacy=w.$('<div class="lightbox lightbox-task-detail remove-on-close">Task</div>').data('scope',legacyScope);
w.$('body').append(legacy);lightbox.open(legacy);root.$digest();
service.open('project-userstories-detail',{project:'demo',ref:12});root.$digest();
assert(legacyScope.$$destroyed);assert.equal(active().length,1);
lightbox.close(active());root.$digest();
dom.window.close();console.log('PASS: real detail controllers and lightbox lifecycle; story/epic/task loops replace dialogs; previews, rapid requests, original task dialogs and context cleanup');
