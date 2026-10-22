const fs = require('fs');
const assert = require('assert');
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<body><input class="due-date" value="01 Jan 2030"></body>', {runScripts:'outside-only'});
const w = dom.window;
w.$ = require('jquery')(w);
w.moment = require('moment');
w.eval(fs.readFileSync('node_modules/angular/angular.js','utf8'));
let target, closed = 0;
w.angular.module('taigaCommon', [])
.filter('translate', () => value => value)
.value('lightboxService', {open(){}, close(){closed++;}})
.value('$translate', {instant: key => key === 'COMMON.PICKERDATE.FORMAT' ? 'DD MMM YYYY' : key})
.value('$tgLoading', () => ({target(){return this;},start(){return {finish(){}};}}))
.factory('$tgConfirm', ['$q', q => ({notify(){},askOnDelete:()=>q.when({finish(){}})})])
.factory('$tgQueueModelTransformation', ['$q', q => ({save: transform => {transform(target);return q.when(target);}})]);
const source = fs.readFileSync('app/coffee/modules/common/lightboxes.coffee','utf8');
const start = source.indexOf('SetDueDateDirective =');
w.eval(require('coffeescript').compile('module = angular.module("taigaCommon")\n' + source.slice(start,source.indexOf('\n#############################################################################',start))));
const injector = w.angular.injector(['ng','taigaCommon']);
const root = injector.get('$rootScope');
injector.get('$templateCache').put('common/lightbox/lightbox-due-date.html',require('jade').renderFile('app/partials/common/lightbox/lightbox-due-date.jade'));
for (const notAutoSave of [false,true]) {
 const scope = root.$new();
 scope.object = target = {due_date:'2026-11-01'};
 scope.notAutoSave = notAutoSave;
 const el = injector.get('$compile')('<div tg-lb-set-due-date></div>')(scope);
 w.$('body').append(el);root.$digest();
 el.find('input[name="due_date"]').val('20 Nov 2026');
 const event = w.$.Event('submit');
 el.find('form').trigger(event);root.$digest();
 assert(event.isDefaultPrevented(),'Form submission must stay in the popup');
 assert.equal(target.due_date,'2026-11-20','Save must read its own field, including issue dialogs');
 el.find('.delete-due-date').trigger('click');root.$digest();
 assert.equal(target.due_date,null);
 assert.equal(w.$('body > input.due-date').val(),'01 Jan 2030','Removing a date must preserve fields outside the popup');
 scope.$destroy();el.remove();
}
assert.equal(closed,4);
dom.window.close();
console.log('PASS: due date submit, scoped field, auto/manual saving and removal isolation');
