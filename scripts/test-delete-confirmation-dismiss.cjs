const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const coffee = require('coffeescript');
const Immutable = require('immutable');
process.chdir(path.resolve(__dirname, '..'));
const controllers = {}, services = {};
let currentDialog;
const moduleMock = {controller: (name, value) => controllers[name] = value, directive() {}, service: (name, value) => services[name] = value};
const context = {angular: {module: () => moduleMock, element: value => typeof value === 'string' ? currentDialog : value},
  _: require('lodash'), Immutable,
  taiga: {Service: class {}, Controller: class {}, PageMixin: {}, FiltersMixin: {}, mixOf: () => class {},
    bindMethods() {}, debounce: (delay, fn) => fn,
    defineImmutableProperty: (object, key, get) => Object.defineProperty(object, key, {get})}};
for (const file of ['app/coffee/modules/common/confirm.coffee', 'app/coffee/modules/issues/list.coffee', 'app/modules/epics/dashboard/epic-row/epic-row.controller.coffee']) {
  vm.runInNewContext(coffee.compile(fs.readFileSync(file, 'utf8')), context);
}
const q = {defer() {let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};}};
async function scenario(kind, dismissal) {
  let onClose, onEsc, opens = 0, removes = 0;
  const handlers = {};
  const dialog = {find: () => ({text() {}}), on: (type, selector, callback) => handlers[selector] = callback, off: () => {}};
  currentDialog = dialog;
  const lightbox = {open: (el, close, esc) => {opens++; onClose = close; onEsc = esc;}, close: () => onClose()};
  const confirm = new services.$tgConfirm(q, lightbox, () => ({target() {return this;}, start() {return {finish() {}};}}), {instant: key => key}, {});
  const controller = Object.create(controllers[kind === 'issue' ? 'IssuesController' : 'EpicRowCtrl'].prototype);
  controller.projectService = {canEdit: () => true};
  controller.translate = {instant: key => key}; controller.confirm = confirm;
  controller.scope = {issues: [{id: 7, subject: 'Test issue'}]};
  controller.repo = {remove: () => {removes++; return Promise.resolve();}};
  controller.epic = Immutable.fromJS({id: 7, subject: 'Test epic'});
  controller.epicsService = {deleteEpic: () => {removes++; return Promise.resolve();}};
  const invoke = () => kind === 'issue' ? controller.deleteIssue(7) : controller.deleteEpic();
  const dismiss = () => dismissal === 'escape' ? onEsc() : dismissal === 'backdrop' ? onClose() : handlers['.js-cancel']({preventDefault() {}});
  let pending = invoke(); assert.equal(opens, 1);
  dismiss(); await pending;
  pending = invoke(); assert.equal(opens, 2, `${kind}: ${dismissal} must release the deletion guard`);
  dismiss(); await pending;
  assert.equal(removes, 0, 'Dismissing confirmation must never delete data');
}
(async () => {
  for (const kind of ['issue', 'epic']) for (const dismissal of ['escape', 'backdrop', 'cancel']) await scenario(kind, dismissal);
  console.log('PASS: Escape, backdrop and Cancel release issue/epic deletion guards and allow reopening without deleting.');
})().catch(error => {console.error(error); process.exitCode = 1;});
