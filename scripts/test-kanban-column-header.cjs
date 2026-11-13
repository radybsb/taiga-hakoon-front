// Header totals must update from the board collection and retain WIP semantics.
const fs=require('fs'),path=require('path'),assert=require('assert'),jade=require('jade'),coffee=require('coffeescript'),{JSDOM}=require('jsdom');
process.chdir(path.resolve(__dirname,'..'));
const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;
w.$=require('jquery')(w);w.eval(fs.readFileSync('node_modules/angular/angular.js','utf8'));
const app=w.angular.module('taigaComponents',[]);app.factory('$exceptionHandler',()=>e=>{throw e;});app.filter('translate',()=>k=>k);
w.eval(coffee.compile(fs.readFileSync('app/modules/components/animated-counter/animated-counter.directive.coffee','utf8')));
const injector=w.angular.injector(['ng','taigaComponents']),root=injector.get('$rootScope'),scope=root.$new(),Immutable=require('immutable');
const calls=[];scope.ctrl={renderInProgress:false,addNewUs:(...args)=>calls.push(args)};scope.usStatusList=[{id:7,name:'New',color:'#9391ae',wip_limit:5}];scope.folds={};scope.swimlanesList=Immutable.List();scope.usByStatus=Immutable.fromJS({'7':[1,2,3]});scope.foldStatus=s=>scope.folds[s.id]=!scope.folds[s.id];
const source=w.$('<div>'+jade.renderFile('app/partials/includes/modules/kanban-table.jade')+'</div>');const el=source.find('.kanban-table-header');injector.get('$compile')(el)(scope);w.$('body').append(el);root.$digest();
try{
 const count=()=>el.find('.kanban-column-count .result').eq(1).text().trim().replace(/\s+/g,' ');
 assert.equal(count(),'3 / 5');assert.equal(el.find('.kanban-column-count .limit-over').length,0);
 scope.usByStatus=Immutable.fromJS({'7':[1,2,3,4,5,6]});root.$digest();assert.equal(count(),'6 / 5');assert.equal(el.find('.kanban-column-count .limit-over').length,1);
 el.find('.options button').eq(0).trigger('click');el.find('.options button').eq(1).trigger('click');assert.deepEqual(calls,[['standard',7],['bulk',7]]);
 el.find('.options button').eq(2).trigger('click');root.$digest();assert.equal(el.find('.kanban-column-count').length,0);assert(el.find('.task-colum-name').hasClass('vfold'));
 el.find('.hunfold:not(.hidden)').trigger('click');root.$digest();assert.equal(count(),'6 / 5');
 scope.swimlanesList=Immutable.List([1]);root.$digest();assert.equal(count(),'6','Header shows the column aggregate; per-lane counters keep their own WIP limits');
 console.log('PASS: live header totals, WIP limits/over-limit indication, existing single/bulk creation callbacks, folded header and restored count, swimlane aggregate');
}finally{root.$destroy();dom.window.close();}
