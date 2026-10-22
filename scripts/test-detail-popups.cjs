const fs=require('fs'),path=require('path'),assert=require('assert');
process.chdir(path.resolve(__dirname,'..'));
const {JSDOM}=require('jsdom'),coffee=require('coffeescript'),jade=require('jade');
const dom=new JSDOM('<body></body>',{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window;
w.$=require('jquery')(w);w._=require('lodash');w.Immutable=require('immutable');
w.eval(fs.readFileSync('node_modules/angular/angular.js','utf8'));
const app=w.angular.module('taigaComponents',[]);
app.factory('$exceptionHandler',()=>error=>{throw error;});
app.filter('translate',()=>key=>key);app.filter('emojify',['$sce',sce=>text=>sce.trustAsHtml(text)]);
const originalProject=w.Immutable.fromJS({id:1,slug:'demo',members:[]});
const project={_project:originalProject,_activeMembers:w.Immutable.List()};Object.defineProperty(project,'project',{get(){return this._project;}});
const transform={scope:null,prop:null,setObject(scope,prop){this.scope=scope;this.prop=prop;}};
const originalAttachments=w.Immutable.List(['original']);const attachments={_attachments:originalAttachments};
let opened=0;const created=[];
app.value('tgProjectService',project);app.value('$tgQueueModelTransformation',transform);app.value('tgAttachmentsFullService',attachments);
app.value('lightboxService',{open:()=>opened++});app.value('$tgConfirm',{notify:()=>{throw Error('Unexpected API failure');}});
app.factory('tgProjectsService',['$q',q=>({getProjectBySlug:slug=>q.when(originalProject.set('slug',slug).set('id',2))})]);
app.value('tgLightboxFactory',{create:(name,attrs,scope)=>created.push({name,attrs,scope})});
app.value('$tgResources',{tasks:{getByRef:()=>{}},userstories:{getByRef:()=>{}},issues:{getByRef:()=>{}},epics:{getByRef:()=>{}}});
const controllers={us:'UserStoryDetailController',task:'TaskDetailController',issue:'IssueDetailController',epic:'EpicDetailController'};
for(const [type,name] of Object.entries(controllers))app.controller(name,['$scope','$routeParams','tgProjectService','$q',function(scope,params,localProject,q){
 assert.equal(params[type+'ref'],12);assert.equal(params.pslug,localProject.project.get('slug'));
 scope.project=localProject.project.toJS();scope.projectId=scope.project.id;
 scope[type]={id:8,ref:12,version:1,description:'Rich content',total_comments:2,tags:[],_attrs:{id:8}};
 scope.attachmentsReady=true;scope.detailLoad=q.when();attachments._attachments=w.Immutable.List([type]);transform.setObject(scope,type);
}]);
w.eval(coffee.compile(fs.readFileSync('app/modules/components/detail/detail-popup.coffee','utf8')));
const injector=w.angular.injector(['ng','taigaComponents']),root=injector.get('$rootScope'),compile=injector.get('$compile');
injector.get('$templateCache').put('common/lightbox/detail-popup.html',jade.renderFile('app/partials/common/lightbox/detail-popup.jade'));
const service=injector.get('tgDetailPopup');
for(const route of ['project-userstories-detail','project-tasks-detail','project-issues-detail','project-epics-detail']){service.open(route,{project:'demo',ref:12});root.$digest();}
assert.deepEqual(created.map(item=>item.scope.popupType),['us','task','issue','epic']);
service.open('project-epics-detail',{project:'other',ref:12});root.$digest();assert.equal(created.at(-1).scope.popupProject.get('id'),2);
function popup(type,projectData=originalProject){const scope=root.$new();Object.assign(scope,{popupType:type,popupRef:12,popupProject:projectData});const el=compile('<div tg-detail-popup></div>')(scope);w.$('body').append(el);root.$digest();return {scope,el};}
for(const type of Object.keys(controllers)){
 const {scope,el}=popup(type);
 assert.equal(el.find('tg-item-wysiwyg').length,1,type+' rich description');assert.equal(el.find('tg-attachments-full').length,1,type+' gallery');assert.equal(el.find('tg-history-section').length,1,type+' comments');
 assert.equal(el.find('tg-project-menu').length,0);scope.$destroy();el.remove();assert.equal(transform.scope,null);assert.equal(attachments._attachments,originalAttachments);
}
const parent=popup('us'),parentAttachments=attachments._attachments;
const child=popup('epic',originalProject.set('id',2).set('slug','other'));
assert.equal(project.project.get('id'),2);child.scope.$destroy();child.el.remove();
assert.equal(transform.scope,parent.scope);assert.equal(attachments._attachments,parentAttachments);assert.equal(project.project,originalProject);
parent.scope.$destroy();parent.el.remove();assert.equal(transform.scope,null);assert.equal(attachments._attachments,originalAttachments);
assert.equal(opened,6);dom.window.close();console.log('PASS: four complete popup templates, routing, cross-project lookup, nested project/model/attachment context and restoration');
