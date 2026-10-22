const fs=require('fs'),path=require('path'),assert=require('assert');
process.chdir(path.resolve(__dirname,'..'));
const coffee=require('coffeescript'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;
w.taiga={Controller:class{},PageMixin:class{},FiltersMixin:class{},UsFiltersMixin:class{},mixOf:()=>class{}};
(async()=>{
 for(const [folder,name] of [['taskboard','TaskboardController'],['backlog','BacklogController']]){
  let Controller;w.angular={module:()=>({controller:(id,cls)=>{Controller=cls;}})};
  let source=fs.readFileSync('app/coffee/modules/'+folder+'/main.coffee','utf8');source=source.slice(0,source.indexOf('\n',source.indexOf('module.controller(')));
  w.eval(coffee.compile(source));assert(Controller,name);
  const host=Object.create(Controller.prototype),events={},calls=[];
  host.scope={projectId:1,userstories:[{id:2}],closedSprints:[{id:9}],$on:(event,callback)=>events[event]=callback};
  let refresh;host.popupRefresh={listen:(scope,fn)=>refresh=fn};host.q={all:values=>Promise.all(values)};
  host.confirm={notify:()=>{throw Error('Unexpected failure');}};
  const methodNames=folder==='taskboard'?['loadSprint','loadTasks','loadSprintStats','refreshTagsColors']:['loadAllPaginatedUserstories','loadUserstories','loadSprints','loadProjectStats','loadClosedSprints','generateFilters'];
  for(const method of methodNames)host[method]=async()=>{calls.push(method);};
  host.initializeEventHandlers();await refresh();
  for(const method of methodNames)if(method!=='loadUserstories')assert(calls.includes(method),folder+' refreshes '+method);
  if(folder==='taskboard'){
   assert(calls.indexOf('loadSprint')<calls.indexOf('loadTasks'),'Sprint membership must be refreshed before fetching task cards');
   calls.length=0;await events['taskform:edit:success']({},{});assert(calls.includes('loadTasks'),'Task edits must refetch full board models instead of copying stale detail attachments');
  }else assert(!calls.includes('loadUserstories'),'Already loaded backlog pagination must be preserved');
 }
 dom.window.close();console.log('PASS: taskboard refetches sprint membership, tasks and stats; backlog refreshes loaded pages and open/closed sprints; task edits avoid stale attachment models');
})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1;});
