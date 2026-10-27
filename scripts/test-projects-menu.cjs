const fs = require('fs');
const path = require('path');
const assert = require('assert');
const coffee = require('coffeescript');
const jade = require('jade');
const Immutable = require('immutable');
const {JSDOM} = require('jsdom');
process.chdir(path.resolve(__dirname, '..'));
const w = new JSDOM('<body></body>', {url: 'http://localhost/project/demo/kanban', runScripts: 'outside-only'}).window;
w.eval(fs.readFileSync('node_modules/jquery/dist/jquery.js', 'utf8'));
w.eval(fs.readFileSync('node_modules/angular/angular.js', 'utf8'));
w.taiga = {defineImmutableProperty: (object, key, getter) => Object.defineProperty(object, key, {get: getter})};
const navigationModule = w.angular.module('taigaNavigationBar', [])
.value('$rootElement', w.angular.element(w.document.body))
.value('tgCurrentUserService', {projects: Immutable.fromJS({recents: [{id: 1}]})})
.value('tgProjectsService', {}).value('tgProjectService', {project: Immutable.fromJS({id: 1})})
.filter('translate', () => key => key);
let navigations = [];
navigationModule.directive('tgNav', () => ({link(scope, element, attrs) {element.on('click', event => {event.preventDefault(); navigations.push(attrs.tgNav);});}}));
w.eval(coffee.compile(fs.readFileSync('app/modules/navigation-bar/dropdown-project-list/dropdown-project-list.directive.coffee', 'utf8')));
const injector = w.angular.injector(['ng', 'taigaNavigationBar']);
const root = injector.get('$rootScope');
injector.get('$templateCache').put('navigation-bar/dropdown-project-list/dropdown-project-list.html', jade.renderFile('app/modules/navigation-bar/dropdown-project-list/dropdown-project-list.jade'));
const scope = root.$new(); scope.active = false;
const element = injector.get('$compile')('<div class="topnav-dropdown-wrapper" tg-dropdown-project-list active="active"></div>')(scope);
w.document.body.append(element[0]); root.$digest();
const state = element.isolateScope().vm;
const trigger = element.find('.dropdown-project-list-projects');
assert.equal(trigger[0].tagName, 'BUTTON'); assert.equal(trigger.attr('type'), 'button'); assert(!trigger.attr('tg-nav')); assert(!trigger.attr('href'));
assert(!state.menuOpen);
trigger.trigger('click'); root.$digest(); assert(state.menuOpen); assert.equal(trigger.attr('aria-expanded'), 'true');
trigger.trigger('click'); root.$digest(); assert(state.menuOpen, 'Clicking an open menu must keep it open'); assert.deepEqual(navigations, []);
element.find('.see-more-projects-btn').trigger('click'); root.$digest(); assert.deepEqual(navigations, ['projects']);
w.angular.element(w.document).triggerHandler({type: 'keydown', key: 'Escape'}); root.$digest(); assert(!state.menuOpen);
trigger.trigger('click'); root.$digest(); w.angular.element(w.document).triggerHandler({type: 'click', target: w.document.body}); root.$digest(); assert(!state.menuOpen);
const list = element.find('.dropdown-project-list'); list.trigger('mouseenter'); root.$digest(); assert(state.menuOpen); list.trigger('mouseleave'); root.$digest(); assert(!state.menuOpen);
element.isolateScope().$destroy(); scope.$destroy(); w.close();
console.log('PASS: Projects only opens its menu, repeated clicks preserve it, View all projects navigates, and hover/outside/Escape close behavior works.');
