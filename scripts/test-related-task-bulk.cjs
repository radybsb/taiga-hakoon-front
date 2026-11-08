const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const coffee = require('coffeescript');
const jade = require('jade');
const _ = require('lodash');
process.chdir(path.resolve(__dirname, '..'));
const factories = {}, directives = {};
vm.runInNewContext(coffee.compile(fs.readFileSync('app/coffee/modules/related-tasks.coffee','utf8')), {
 angular: {module: () => ({factory: (n,v) => factories[n]=v, directive: (n,v) => directives[n]=v})},
 _:_, taiga:{debounce: (delay, callback)=>callback}, $:()=>{}
});
for (const locale of ['en','pt-br','es']) assert(require('../app/locales/taiga/locale-'+locale+'.json').TASK.BULK.SELECT_ALL);
const fn = value => value[value.length-1];
(async()=>{
 const models = new Map([1,2,3].map(id=>[id,{id,project:10,user_story:20,version:7,subject:'Task '+id,status:1,assigned_to:4}]));
 const calls=[],failures=new Set([2]);
 const repo={queryOne:async(type,id,params)=>{assert.equal(type,'tasks');assert.equal(params.project,10);return {...models.get(id)};},
 save:async(task)=>{if(failures.has(task.id))throw Error('Conflict'); calls.push(['save',{...task}]);models.set(task.id,task);},
 remove:async(task)=>{if(failures.has(task.id))throw Error('Forbidden');calls.push(['delete',task.id]);}};
 const service=fn(factories.tgRelatedTaskBulkActions)({when:()=>Promise.resolve()},repo);
 let result=await service.run(10,20,[1,2,1,3],'status',5);
 assert.deepEqual(Array.from(result.succeeded),[1,3]);assert.deepEqual(Array.from(result.failed),[2]);assert.equal(calls.length,2);
 assert.equal(models.get(1).version,7);assert.equal(models.get(1).subject,'Task 1');
 failures.clear();await service.run(10,20,result.failed,'status',5);assert.equal(models.get(2).status,5);
 await service.run(10,20,[1,2],'assigned',[9,11]);assert.equal(models.get(1).assigned_to,9);assert.equal(models.get(1).status,5);assert.deepEqual(Array.from(models.get(1).assigned_users),[9,11]);
 await service.run(10,20,[1,2],'assigned',[]);assert.equal(models.get(2).assigned_to,null);
 models.get(3).user_story=99;const before=calls.length;
 result=await service.run(10,20,[3],'delete');assert.deepEqual(Array.from(result.failed),[3]);assert.equal(calls.length,before);
 failures.add(2);result=await service.run(10,20,[1,2],'delete');assert.deepEqual(Array.from(result.succeeded),[1]);assert.deepEqual(Array.from(result.failed),[2]);

 const {JSDOM}=require('jsdom');
 const dom=new JSDOM('<!doctype html><body></body>',{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window;
 w.eval(fs.readFileSync('node_modules/jquery/dist/jquery.js','utf8'));w.eval(fs.readFileSync('node_modules/angular/angular.js','utf8'));
 const app=w.angular.module('bulkTest',[]),actions=[],confirmations=[],pickers=[];
 let fail=[2];
 app.factory('$exceptionHandler',()=>error=>{throw error;});
 app.filter('translate',()=>v=>v);
 app.directive('translate',()=>({}));
 app.directive('tgRelatedTasks', ['$rootScope','$q','$document',function(root,q,document){
  const bulk={run:(project,story,ids,action,value)=>{actions.push({project,story,ids:Array.from(ids),action,value});return q.when({succeeded:ids.filter(id=>!fail.includes(id)),failed:ids.filter(id=>fail.includes(id))});}};
  const confirm={notify:()=>{},askOnDelete:()=>{const d=q.defer();confirmations.push(d);return d.promise;}};
  return fn(directives.tgRelatedTasks)(root,bulk,confirm,{instant:(k,p)=>k+JSON.stringify(p||{})},{create:(...args)=>pickers.push(args)},document);
 }]);
 // Compile the production row renderer, including selection controls and existing links.
 app.directive('tgRelatedTaskRow',['$compile','$rootScope',function(compile,root){
  return fn(directives.tgRelatedTaskRow)({},compile,{},root,()=>{},
   {get:name=>_.template(jade.renderFile('app/partials/'+name.replace('.html','.jade')))},
   {instant:key=>key},{replaceEmojiNameByHtmlImgs:text=>text});
 }]);
 const injector=w.angular.injector(['ng','bulkTest']),root=injector.get('$rootScope'),compile=injector.get('$compile');
 const parent=root.$new();parent.project={id:10,my_permissions:['view_tasks','modify_task','delete_task'],task_statuses:[{id:1,name:'New'},{id:5,name:'Done'}]};parent.us={id:20};parent.tasks=[{id:1,ref:1,subject:'First'},{id:2,ref:2,subject:'Second'}];parent.activeUsers=[];
 const source=jade.renderFile('app/partials/includes/modules/related-tasks.jade');
 const first=w.$(source),second=w.$(source);w.$('body').append(first,second);compile(first)(parent);compile(second)(parent);root.$digest();
 const scope=first.scope(),bulk=scope.taskBulk;
 const click=selector=>{const e=first.find(selector)[0];assert(e,selector);e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));root.$digest();};
 // Angular checkboxes listen to click, so use real click events.
 click('.task-bulk-select-all input');assert.deepEqual(Array.from(bulk.ids),[1,2]);assert.equal(second.scope().taskBulk.ids.length,0,'Popup/list selections must be isolated');
 click('.e2e-task-bulk-status');assert.equal(first.find('.task-bulk-status-menu button').length,2);
 click('.task-bulk-status-menu li:last-child button');assert.equal(actions.at(-1).action,'status');assert.equal(actions.at(-1).value,5);assert.deepEqual(Array.from(bulk.ids),[2]);assert.equal(bulk.failed.length,1);
 fail=[];bulk.retry();root.$digest();assert.deepEqual(actions.at(-1).ids,[2]);assert.equal(bulk.ids.length,0);
 click('.task-bulk-select-all input');click('.e2e-task-bulk-assign');assert.equal(pickers.at(-1)[2].single,false);pickers.at(-1)[2].onClose([9,11]);root.$digest();assert.deepEqual(Array.from(actions.at(-1).value),[9,11]);
 click('.task-bulk-select-all input');click('.e2e-task-bulk-delete');bulk.remove();assert.equal(confirmations.length,1);assert.equal(bulk.confirming,true);
 const count=actions.length;confirmations[0].reject('cancel');root.$digest();assert.equal(actions.length,count);assert.equal(bulk.confirming,false);
 click('.e2e-task-bulk-delete');confirmations[1].resolve({finish:()=>{}});root.$digest();assert.equal(actions.at(-1).action,'delete');
 click('.task-bulk-select-all input');parent.tasks=[parent.tasks[0]];root.$digest();assert.deepEqual(Array.from(bulk.ids),[1],'Remove disappeared tasks from selection');
 parent.project.archived_code='archived';root.$digest();assert.equal(first.find('.task-bulk-select-all').length,0);const saved=actions.length;bulk.execute('delete',null,[1]);assert.equal(actions.length,saved);
 parent.project.archived_code=null;parent.project.my_permissions=['view_tasks','delete_task'];root.$digest();click('.task-bulk-select-all input');assert.equal(first.find('.e2e-task-bulk-status').length,0);assert.equal(first.find('.e2e-task-bulk-delete').length,1);
 let sortable, dragOptions;
 vm.runInNewContext(coffee.compile(fs.readFileSync('app/modules/components/tasks-sortable/tasks-sortable.directive.coffee','utf8')), {
  angular:{module:()=>({directive:(name,value)=>sortable=value})}, $:w.$, window:w,
  taiga:{touchDragula:(containers,options)=>{dragOptions=options;return {on:()=>{},destroy:()=>{}};}},autoScroll:()=>({})
 });
 sortable(()=>()=>{}, {canEdit:()=>true}).link(scope,first.find('.related-tasks-body'),{tgTasksSortable:'reorderTask(task, newIndex)'});
 const row=first.find('.js-related-task')[0];
 assert.equal(dragOptions.moves(row,null,first.find('.task-bulk-checkbox input')[0]),false,'Checkbox selection must not start dragging');
 assert.equal(dragOptions.moves(row,null,first.find('.task-name a')[0]),false,'Task navigation must not start dragging');
 assert.equal(dragOptions.moves(row,null,row),true,'Task rows must remain draggable');
 bulk.busy=true;assert.equal(dragOptions.moves(row,null,row),false,'Do not reorder while bulk changes run');bulk.busy=false;
 parent.$destroy();dom.window.close();
 console.log('PASS: current task versions, ownership, status/assignment/unassignment/deletion, partial failures/retry, real selection controls, isolated popup scopes, confirmation/cancellation and archived/permission guards.');
})().catch(error=>{console.error(error);process.exitCode=1;});
