const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const coffee = require('coffeescript');
const Immutable = require('immutable');
process.chdir(path.resolve(__dirname, '..'));
let Controller;
const context = {
  angular: {module: () => ({controller: (name, value) => Controller = value})},
  taiga: {
    sizeFormat: value => value,
    defineImmutableProperty: (object, key, get) => Object.defineProperty(object, key, {get}),
    isImage: name => /\.(png|gif)$/i.test(name),
    isVideo: name => /\.mp4$/i.test(name)
  }
};
vm.runInNewContext(coffee.compile(fs.readFileSync('app/modules/components/attachments-full/attachments-full.controller.coffee', 'utf8')), context);
async function scenario({cancel = false, fail = false, current = 1, files = [{id: 1, name: 'a.png'}, {id: 2, name: 'notes.txt'}, {id: 3, name: 'b.gif'}]} = {}) {
  const preview = {fileId: current};
  let resolveConfirmation, rejectConfirmation, outcome, deleted = false;
  const confirm = {askOnDelete: () => new Promise((resolve, reject) => {resolveConfirmation = resolve; rejectConfirmation = reject;}), notify: () => {}};
  const service = {attachments: Immutable.fromJS(files.map(file => ({file}))), deleteAttachment: async attachment => {
    if (fail) throw Error('Server error');
    deleted = true;
    service.attachments = service.attachments.filter(item => item.getIn(['file', 'id']) !== attachment.getIn(['file', 'id']));
  }};
  const controller = new Controller({instant: key => key}, confirm, {get: () => null}, {get: (key, fallback) => fallback}, service, {}, preview);
  const pending = controller.deleteAttachment(service.attachments.first());
  assert.equal(preview.fileId, current, 'Opening confirmation must preserve the carousel');
  if (cancel) {
    rejectConfirmation(Error('Cancelled'));
    await pending.catch(() => {});
    assert.equal(preview.fileId, current);
    assert(!deleted);
  } else {
    resolveConfirmation({finish: value => outcome = value === undefined ? true : value});
    await pending;
    if (fail) { assert.equal(outcome, false); assert.equal(preview.fileId, current); }
    else { assert(deleted); assert.equal(outcome, true); }
  }
  return preview.fileId;
}
(async () => {
  assert.equal(await scenario({cancel: true}), 1);
  assert.equal(await scenario({fail: true}), 1);
  assert.equal(await scenario(), 3);
  assert.equal(await scenario({current: 3}), 3);
  assert.equal(await scenario({files: [{id: 1, name: 'a.mp4'}, {id: 2, name: 'notes.txt'}]}), null);
  console.log('PASS: confirmation and cancellation retain media; successful deletion advances or closes the empty viewer; errors preserve media.');
})().catch(error => { console.error(error); process.exitCode = 1; });
