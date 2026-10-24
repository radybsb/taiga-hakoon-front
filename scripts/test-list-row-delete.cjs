const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const coffee = require('coffeescript');
const jade = require('jade');
const Immutable = require('immutable');
process.chdir(path.resolve(__dirname, '..'));
const controllers = {}, services = {};
const moduleMock = {controller: (name, value) => controllers[name] = value, directive: () => {}, service: (name, value) => services[name] = value};
const context = {angular: {module: () => moduleMock}, _: require('lodash'), Immutable,
  taiga: {Controller: class {}, PageMixin: {}, FiltersMixin: {}, mixOf: () => class {}, defineImmutableProperty: (obj, key, get) => Object.defineProperty(obj, key, {get})}};
for (const file of ['app/coffee/modules/issues/list.coffee', 'app/modules/epics/dashboard/epic-row/epic-row.controller.coffee', 'app/modules/epics/epics.service.coffee']) {
  vm.runInNewContext(coffee.compile(fs.readFileSync(file, 'utf8')), context);
}
async function testDeletion(kind, {allowed = true, cancel = false, fail = false} = {}) {
  let confirmations = 0, deletions = 0, reloads = 0, notifications = 0, finishValue;
  let approve, reject;
  const confirmation = new Promise((resolve, decline) => {approve = resolve; reject = decline;});
  const controller = Object.create(controllers[kind === 'issue' ? 'IssuesController' : 'EpicRowCtrl'].prototype);
  const record = {id: 7, subject: 'Test subject'};
  controller.projectService = {canEdit: () => allowed};
  controller.translate = {instant: key => key};
  controller.confirm = {askOnDelete: () => {confirmations++; return confirmation;}, notify: () => notifications++};
  const remove = () => {deletions++; return fail ? Promise.reject(Error('Delete failed')) : Promise.resolve();};
  controller.scope = {issues: [record]}; controller.repo = {remove}; controller.loadIssues = () => reloads++;
  controller.epic = Immutable.fromJS(record); controller.epicsService = {deleteEpic: remove};
  const invoke = () => kind === 'issue' ? controller.deleteIssue(7) : controller.deleteEpic();
  const pending = invoke();
  if (!allowed) {assert.equal(confirmations, 0); assert.equal(deletions, 0); return;}
  assert.equal(confirmations, 1); assert.equal(deletions, 0);
  invoke(); assert.equal(confirmations, 1, 'Duplicate clicks must not open another confirmation');
  if (cancel) reject(); else approve({finish: value => finishValue = value === undefined ? true : value});
  await pending;
  assert.equal(deletions, cancel ? 0 : 1);
  if (cancel) {assert.equal(reloads, 0); assert.equal(notifications, 0);}
  else if (fail) {assert.equal(finishValue, false); assert.equal(notifications, 1); assert.equal(reloads, 0);}
  else {assert.equal(finishValue, true); if (kind === 'issue') assert.equal(reloads, 1);}
}
(async () => {
  for (const kind of ['issue', 'epic']) for (const options of [{}, {allowed: false}, {cancel: true}, {fail: true}]) await testDeletion(kind, options);
  let complete;
  const service = new services.tgEpicsService({}, {}, {epics: {delete: () => new Promise(resolve => complete = resolve)}}, {}, {});
  service._epics = Immutable.fromJS([{id: 7}, {id: 8}]);
  const pending = service.deleteEpic(service._epics.first());
  assert.equal(service.epics.size, 2); complete(); await pending; assert.deepEqual(service.epics.toJS(), [{id: 8}]);
  for (const file of ['app/modules/components/issues-table/issues-table.jade', 'app/modules/epics/dashboard/epic-row/epic-row.jade']) {
    const html = jade.render(fs.readFileSync(file, 'utf8'), {filename: file});
    assert(html.includes('row-delete-button')); assert(html.includes('$event.stopPropagation()'));
  }
  console.log('PASS: permission guards, confirmation, cancellation, duplicate clicks, failure handling, list refresh and epic removal after server success.');
})().catch(error => {console.error(error); process.exitCode = 1;});
