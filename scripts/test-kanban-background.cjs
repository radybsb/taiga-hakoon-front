const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const coffee = require('coffeescript');
const jade = require('jade');
process.chdir(path.resolve(__dirname, '..'));
for (const boardType of ['kanban', 'taskboard', 'backlog', 'issues', 'epics']) {
const w = new JSDOM(`<html><body>${boardType === 'backlog' ? '<main class="main scrum">' : ''}<section class="${boardType === 'issues' ? 'issue-main' : boardType}"></section>${boardType === 'backlog' ? '</main>' : ''}</body></html>`, {url:'http://localhost', runScripts:'outside-only'}).window;
w.eval(fs.readFileSync('node_modules/angular/angular.js', 'utf8'));
const m = w.angular.module('taigaComponents', []);
m.factory('$exceptionHandler', () => error => {throw error;});
m.value('$tgConfig', {get: () => 'http://localhost/api/v1/'});
m.value('tgCurrentUserService', {getUser: () => ({get: () => 9})});
let tracked;
m.factory('$tgHttp', ['$q', $q => ({
    get: () => $q.resolve({data:{photos:[{id:'one',url:'https://images.unsplash.com/test',token:'signed',author:'Test',profile:'https://unsplash.com/@test'}],more:false}}),
    post: (url, data) => {tracked = {url, data}; return $q.resolve({});}
})]);
w.eval(coffee.compile(fs.readFileSync('app/modules/components/kanban-background/kanban-background.coffee', 'utf8')));
const injector = w.angular.injector(['ng','taigaComponents']);
injector.get('$templateCache').put('components/kanban-background/kanban-background.html', jade.renderFile('app/modules/components/kanban-background/kanban-background.jade'));
const parent = injector.get('$rootScope').$new(); parent.project = {id:1};
const el = w.angular.element('<tg-kanban-background></tg-kanban-background>');
w.document.querySelector(`.${boardType === 'issues' ? 'issue-main' : boardType}`).append(el[0]);
injector.get('$compile')(el)(parent); parent.$digest();
const vm = el.scope().background;
assert.equal(vm.current, null);
assert.equal(vm.colors.length,12);
vm.chooseColor(vm.colors[0]);
if (boardType === 'backlog') {
    assert.ok(w.document.querySelector('main.scrum').classList.contains('has-board-background'));
    assert.equal(w.document.querySelector('.backlog').style.backgroundImage, '');
}
assert.equal(JSON.parse(w.localStorage.getItem(`taiga.${boardType}.background.9.1`)).name,'Slate');
assert.ok(w.document.querySelector(`.${boardType === 'issues' ? 'issue-main' : boardType}`).classList.contains('has-board-background'));
parent.project = {id:2}; parent.$digest(); assert.equal(vm.current,null);
parent.project = {id:1}; parent.$digest(); assert.equal(vm.current.name,'Slate');
vm.show('photos'); parent.$digest(); assert.equal(vm.photos.length,1);
vm.choosePhoto(vm.photos[0]); parent.$digest();
assert.deepEqual(JSON.parse(JSON.stringify(tracked.data)),{id:'one',token:'signed'});
assert.equal(vm.current.kind,'photo');
const surface = boardType === 'backlog' ? w.document.querySelector('main.scrum') : w.document.querySelector(`.${boardType === 'issues' ? 'issue-main' : boardType}`);
const creditLayer = surface.querySelector('.board-photo-credit-layer');
assert.equal(creditLayer.parentElement, surface, 'Credits must escape the header controls stacking context');
assert.equal(el[0].querySelector('.board-photo-credit'), null);
assert.ok(surface.classList.contains('board-background-surface'));
assert.match(creditLayer.textContent, /Photo by Test on Unsplash/);

if (boardType === 'backlog') assert.match(w.document.querySelector('main.scrum').style.backgroundImage, /images.unsplash.com/);
vm.open = true;
w.document.body.dispatchEvent(new w.Event('pointerdown',{bubbles:true})); parent.$digest();
assert.equal(vm.open,false);
vm.reset(); assert.equal(vm.current,null);
if (boardType === 'backlog') assert.equal(w.document.querySelector('main.scrum').style.backgroundImage, '');
assert.equal(w.localStorage.getItem(`taiga.${boardType}.background.9.1`),null);
parent.$destroy();
assert.equal(surface.querySelector('.board-photo-credit-layer'), null, 'Remove the detached credit layer on destruction');
assert.equal(surface.classList.contains('board-background-surface'), false);
console.log(`PASS ${boardType}: gradients, per-project persistence, photo tracking, outside dismissal and reset`);

}
