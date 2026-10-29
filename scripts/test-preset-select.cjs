const fs = require('fs');
const path = require('path');
const assert = require('assert');
const coffee = require('coffeescript');
const {JSDOM} = require('jsdom');
process.chdir(path.resolve(__dirname, '..'));
const w = new JSDOM('<body></body>', {runScripts: 'outside-only'}).window;
w.eval(fs.readFileSync('node_modules/jquery/dist/jquery.js', 'utf8'));
w.eval(fs.readFileSync('node_modules/angular/angular.js', 'utf8'));
w.eval(fs.readFileSync('node_modules/angular-mocks/angular-mocks.js', 'utf8'));
const media = {matches: true, addListener() {}, removeListener() {}};
w.matchMedia = () => media;
const saves = [];
const notifications = [];
w._ = require('lodash');
w.angular.module('taigaAdmin', [])
    .filter('translate', () => key => key)
    .value('$tgRepo', {save(member) {saves.push(member.role); return {then(success) {success();}};}})
    .value('$tgConfirm', {notify(status) {notifications.push(status);}});
const memberships = fs.readFileSync('app/coffee/modules/admin/memberships.coffee', 'utf8');
w.eval(coffee.compile('module = angular.module("taigaAdmin")\n' + memberships.slice(memberships.indexOf('MembershipsRowRoleSelectorDirective ='))));
w.eval(coffee.compile(fs.readFileSync('app/coffee/modules/admin/preset-select.coffee', 'utf8')));
const injector = w.angular.injector(['ng', 'ngMock', 'taigaAdmin']);
const root = injector.get('$rootScope');
const timeout = injector.get('$timeout');
const scope = root.$new();
scope.options = [{id: 1, name: 'New'}, {id: 2, name: 'In progress'}];
scope.value = 1;
const host = injector.get('$compile')('<div><label for="status">Default status</label><select id="status" tg-preset-select ng-model="value" ng-options="o.id as o.name for o in options"></select><button class="outside">Outside</button></div>')(scope);
w.document.body.append(host[0]); root.$digest();
const native = host.find('select');
const trigger = host.find('[role="combobox"]');
// A narrow field near a phone's right edge must keep its menu in the viewport.
Object.defineProperty(w, 'innerWidth', {value: 320, writable: true});
host.find('.preset-select-wrapper')[0].getBoundingClientRect = () => ({left: 240, right: 308, top: 100, bottom: 132, width: 68});

assert.equal(trigger.text().trim(), 'New');
trigger.trigger('click'); root.$digest(); timeout.flush();
assert.equal(trigger.attr('aria-expanded'), 'true');
const menuStyle = host.find('.preset-select-options')[0].style;
assert(240 + parseFloat(menuStyle.left) >= 12);
assert(240 + parseFloat(menuStyle.left) + parseFloat(menuStyle.width) <= 308);

let options = host.find('[role="option"]');
assert.equal(options.length, 2);
options.eq(1).trigger('click'); root.$digest();
assert.strictEqual(scope.value, 2, 'Numeric ng-options value is preserved');
assert.equal(trigger.text().trim(), 'In progress');
assert.equal(trigger.attr('aria-expanded'), 'false');
assert.equal(w.document.activeElement, trigger[0]);
trigger.trigger('click'); root.$digest(); timeout.flush();
options.eq(1).trigger(w.jQuery.Event('keydown', {key: 'ArrowUp'})); root.$digest();
assert.equal(w.document.activeElement, options[0]);
options.eq(0).trigger(w.jQuery.Event('keydown', {key: 'Escape'})); root.$digest();
assert.equal(trigger.attr('aria-expanded'), 'false');
trigger.trigger('click'); root.$digest(); timeout.flush();
host.find('.outside').trigger('click'); root.$digest();
assert.equal(trigger.attr('aria-expanded'), 'false');
scope.value = 1; root.$digest(); assert.equal(trigger.text().trim(), 'New');
native.prop('disabled', true);
trigger.trigger('click'); root.$digest(); assert.equal(trigger.attr('aria-expanded'), 'false');
scope.$destroy(); host.remove();
// Custom Fields uses string ng-options values, including the empty placeholder.
const fields = root.$new();
fields.kind = ''; fields.changes = 0; fields.types = [{key: 'text', name: 'Text'}, {key: 'dropdown', name: 'Dropdown'}];
const fieldsHost = injector.get('$compile')('<div><select tg-preset-select aria-label="Type" ng-model="kind" ng-change="changes = changes + 1" ng-options="t.key as t.name for t in types"><option value="">-- select one --</option></select></div>')(fields);
w.document.body.append(fieldsHost[0]); root.$digest();
fieldsHost.find('[role="combobox"]').trigger('click'); root.$digest(); timeout.flush();
fieldsHost.find('[role="option"]').eq(2).trigger('click'); root.$digest();
assert.strictEqual(fields.kind, 'dropdown');
assert.strictEqual(fields.changes, 1, 'ng-change saves must run exactly once for string-valued settings');
fields.$destroy(); fieldsHost.remove();
// Members inserts its select dynamically and saves through a delegated change event.
const memberScope = root.$new();
memberScope.project = {roles: [{id: 1, name: 'Developer'}, {id: 2, name: 'Designer'}]};
memberScope.member = {role: 1};
const memberHost = injector.get('$compile')('<div tg-memberships-row-role-selector="member"></div>')(memberScope);
w.document.body.append(memberHost[0]); root.$digest();
assert.equal(memberHost.find('[role="combobox"]').text().trim(), 'Developer');
memberHost.find('[role="combobox"]').trigger('click'); root.$digest(); timeout.flush();
memberHost.find('[role="option"]').eq(1).trigger('click'); root.$digest();
assert.strictEqual(memberScope.member.role, 2);
assert.deepEqual(saves, [2], 'Role selection must save exactly once');
assert.deepEqual(notifications, ['success']);
assert.equal(memberHost.find('[role="combobox"]').text().trim(), 'Designer');
memberScope.$destroy(); memberHost.remove(); w.close();
console.log('PASS: anchored Settings menus; Presets numeric values, Custom Fields string values, Members saving once, keyboard, dismissal, external updates and disabled state.');
