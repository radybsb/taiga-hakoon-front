const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const coffee = require('coffeescript');
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
const directives = {};
const context = {
  taiga: {bindOnce: () => {}, debounce: () => {throw Error('Status clicks must not be time-debounced');}},
  angular: {module: () => ({directive: (name, value) => directives[name] = value}), element: value => value},
  $: value => value
};
vm.runInNewContext(coffee.compile(fs.readFileSync('app/coffee/modules/common/popovers.coffee', 'utf8').split('## Related Task Status Directive')[0].replace(/#+\s*$/, '')), context);
(async () => {
  const handlers = {};
  let resolveSave, rejectSave, saves = 0, updates = 0;
  const story = {status: 1};
  const node = {text() {}, css() {}, popover() {return this;}, open() {}, close() {}};
  const el = {controller() {}, find: () => node, on: (type, selector, fn) => handlers[selector] = fn};
  const scope = {usStatusById: {1: {name: 'New', color: '#70728f'}, 2: {name: 'Done', color: '#12ab34'}},
    $on() {}, $eval: expression => expression === 'story' ? story : updates++, $apply: fn => fn()};
  const repo = {save: () => {saves++; return new Promise((resolve, reject) => {resolveSave = resolve; rejectSave = reject;});}};
  const factory = directives.tgUsStatus[directives.tgUsStatus.length - 1];
  factory(repo, {get: () => () => ''}).link(scope, el, {tgUsStatus: 'story', onUpdate: 'updated'});
  function click(status) {
    const event = {prevented: false, stopped: false,
      preventDefault() {this.prevented = true;}, stopPropagation() {this.stopped = true;},
      currentTarget: {find: () => ({data: () => status})}};
    const result = handlers['.popover-status'](event);
    assert(event.prevented && event.stopped, 'Every click must prevent navigation, including rapid repeated clicks');
    return result;
  }
  let pending = click(2);
  click(1);
  assert.equal(saves, 1, 'Do not overlap saves');
  resolveSave(); await pending;
  pending = click(1);
  assert.equal(saves, 2, 'A second change must work immediately after the first save');
  resolveSave(); await pending;
  assert.equal(updates, 2);
  pending = click(2); rejectSave(Error('Save failed'));
  await assert.rejects(pending);
  pending = click(1); assert.equal(saves, 4, 'Failed saves must release the guard');
  resolveSave(); await pending;
  console.log('PASS: repeated status changes prevent navigation, serialize saves and recover after failure.');
})().catch(error => {console.error(error); process.exitCode = 1;});
