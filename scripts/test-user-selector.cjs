const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const coffee = require('coffeescript');
const jade = require('jade');
process.chdir(path.resolve(__dirname, '..'));
const dom = new JSDOM('<html><body></body></html>', {runScripts: 'outside-only', url: 'http://localhost'});
const w = dom.window;
w._ = require('lodash');
w.taiga = {truncate: text => text};
w.eval(fs.readFileSync('node_modules/jquery/dist/jquery.js', 'utf8'));
w.eval(fs.readFileSync('node_modules/angular/angular.js', 'utf8'));
const testModule = w.angular.module('taigaComponents', []);
testModule.factory('$exceptionHandler', () => error => {throw error;});
testModule.filter('translate', () => key => key);
for (const [name, value] of Object.entries({
    $tgRepo: {},
    lightboxService: {open() {return Promise.resolve();}, close() {}},
    lightboxKeyboardNavigationService: {stop() {}, init() {}},
    tgAvatarService: {getAvatar: () => ({url: '/avatar.png', bg: ''})},
    tgProjectService: {project: {toJS: () => ({roles: [{id: 1, name: 'Role'}]})}},
    $translate: {instant: key => key}
})) testModule.value(name, value);
testModule.directive('tgSvg', () => ({template: '<svg></svg>'}));
w.eval(coffee.compile(fs.readFileSync('app/modules/components/lb-select-user/lb-select-user.directive.coffee', 'utf8')));
const injector = w.angular.injector(['ng', 'taigaComponents']);
injector.get('$templateCache').put('components/lb-select-user/lb-select-user.html', jade.renderFile('app/modules/components/lb-select-user/lb-select-user.jade'));
const scope = injector.get('$rootScope').$new();
scope.activeUsers = [{id: 1, full_name_display: 'Alex', role: 1}, {id: 2, full_name_display: 'Taylor', role: 1}];
scope.currentUsers = [1, 2];
scope.onClose = () => {};
const el = injector.get('$compile')('<div tg-lb-select-user></div>')(scope);
w.document.body.append(el[0]);
scope.$digest();
const names = () => [...el[0].querySelectorAll('.is-active .user-list-name')].map(e => e.textContent.trim());
function click(selector, name) {
    const row = [...el[0].querySelectorAll('.user-list-item')].find(e => e.querySelector('.user-list-name').textContent.trim() === name);
    const target = selector ? row.querySelector(selector) : row;
    assert.ok(target, `Missing ${selector} for ${name}`);
    target.click(); scope.$digest();
}
assert.deepEqual(names(), ['Alex', 'Taylor']);
for (let i = 0; i < 3; i++) {
    click('.remove-selected', 'Alex');
    assert.deepEqual(names(), ['Taylor']);
    click(null, 'Alex');
    assert.deepEqual(names(), ['Alex', 'Taylor']);
    assert.equal(el[0].querySelectorAll('.is-active .remove-selected').length, 2);
}
click('.remove-selected', 'Taylor');
click('.remove-selected', 'Alex');
assert.deepEqual(names(), []);
click(null, 'LIGHTBOX.SELECT_USER.ROLE: Role(Alex, Taylor)');
assert.deepEqual(names(), ['Alex', 'Taylor']);
assert.equal(el[0].querySelectorAll('.is-active .remove-selected').length, 2);
console.log('PASS: repeated assignment removal, re-selection, role selection and close icons');
