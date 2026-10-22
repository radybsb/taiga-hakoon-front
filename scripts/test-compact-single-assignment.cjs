const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),coffee=require('coffeescript'),jade=require('jade');
const dom=new JSDOM('<body></body>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;
w.$=require('jquery')(w);w._=require('lodash');w.eval(fs.readFileSync('node_modules/angular/angular.js','utf8'));
const app=w.angular.module('taigaComponents',[]);let confirmations=0,opened;
app.filter('translate',()=>s=>s);
app.factory('$tgConfirm',['$q',q=>({ask:()=>{confirmations++;return q.defer().promise;},notify:()=>assert.fail('unexpected error')})]);
for(const name of ['$tgRepo','$tgLoading','$tgTemplate','tgAvatarService'])app.value(name,{});
app.value('$tgQueueModelTransformation',{save:()=>assert.fail('must not save before confirmation')});
app.value('$translate',{instant:s=>s});app.value('tgCurrentUserService',{getUser:()=>({get:()=>9})});app.value('tgLightboxFactory',{create:(...args)=>opened=args});
w.eval(coffee.compile(fs.readFileSync('app/modules/components/ticket-assigned/assigned-to.directive.coffee','utf8')));
const i=w.angular.injector(['ng','taigaComponents']),root=i.get('$rootScope');i.get('$templateCache').put('components/ticket-assigned/assigned-to.html',jade.renderFile('app/modules/components/ticket-assigned/assigned-to.jade'));
for(const compact of [false,true]){
 const s=root.$new();Object.assign(s,{compact,project:{my_permissions:['modify_task']},usersById:{5:{id:5,full_name_display:'User Five'}},activeUsers:[{id:5}],item:{assigned_to:5}});
 const el=i.get('$compile')('<section tg-assigned-to ng-model="item" required-perm="modify_task" compact-users="compact"></section>')(s);w.$('body').append(el);root.$digest();
 assert.equal(el.find('.ticket-users-actions').length,compact?0:1);
 if(compact){el.find('.compact-add-user').trigger('click');root.$digest();assert.equal(opened[2].activeUsers,s.activeUsers);assert.equal(opened[2].single,true);el.find('.user-list-single').trigger('click');root.$digest();assert.equal(confirmations,1);assert.equal(s.item.assigned_to,5);assert.equal(el.find('.user-list-single').attr('tabindex'),'0');}
 s.$destroy();el.remove();
}
dom.window.close();console.log('PASS: regular assignment actions preserved; compact picker receives users; avatar confirmation leaves assignment unchanged until accepted');
