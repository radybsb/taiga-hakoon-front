const assert = require('assert');
const fs = require('fs');
const {JSDOM} = require('jsdom');
const coffee = require('coffeescript');
const dom = new JSDOM('<!doctype html><body></body>', {url: 'http://localhost/', runScripts: 'outside-only'});
const w = dom.window;
w.eval(fs.readFileSync(require.resolve('jquery'), 'utf8'));
w.eval(fs.readFileSync(require.resolve('immutable/dist/immutable.js'), 'utf8'));
w.taiga = {isImage: name => /\.(png|jpe?g|gif|webp)$/i.test(name)};
let registration;
w.angular = {module: () => ({directive: (name, factory) => { registration = factory; }})};
w.eval(coffee.compile(fs.readFileSync('app/modules/components/wysiwyg/item-wysiwyg.directive.coffee', 'utf8')));
const factory = registration.at(-1);
try {
  for (const type of ['us', 'task', 'epic']) {
    for (const popup of [false, true]) {
      const preview = {}, opened = [];
      const directive = factory(null, null, null, null, null, preview, {open: el => opened.push(el)});
      const template = w.$('<div>' + directive.template + '</div>');
      assert.equal(template.find('tg-attachments-preview.description-image-preview.lightbox.lightbox-block').length, 1,
        'Description viewer must use the same element and styles as the attachment viewer');
      const destroy = [];
      const scope = {$id: type + popup, $apply: cb => cb(), $watch: () => {}, $on: (name, cb) => destroy.push(cb)};
      const el = w.$('<div><div class="description-body"><div class="wysiwyg"><a href="/elsewhere"><img alt="Screenshot" src="/first.png"></a><img src="/animated.gif?token=abc"></div><div class="edit-mode"><div class="wysiwyg"><img src="/editing.png"></div></div></div><div class="description-image-preview"></div></div>').appendTo(w.document.body);
      directive.link(scope, el, {type});
      const images = el.find('img');
      const click = w.$.Event('click');
      images.eq(1).trigger(click);
      assert(click.isDefaultPrevented());
      assert.equal(opened.length, 1);
      assert.equal(opened[0][0], el.find('.description-image-preview')[0]);
      assert.equal(scope.descriptionImages.size, 1);
      assert.equal(preview.fileId, scope.descriptionImages.getIn([0, 'file', 'id']));
      assert.equal(scope.descriptionImages.getIn([0, 'file', 'url']), 'http://localhost/animated.gif?token=abc');
      assert(scope.descriptionImages.every(image => image.get('inherited')));
      assert(scope.descriptionImages.every(image => w.taiga.isImage(image.getIn(['file', 'name']))));
      images.eq(2).trigger('click');
      assert.equal(opened.length, 1, 'Editor images must keep editor behavior');
      destroy.forEach(cb => cb());
      images.eq(0).triggerHandler('click');
      assert.equal(opened.length, 1);
      el.remove();
    }
  }
  console.log('PASS: story/task/epic descriptions open scoped attachment viewers, retain GIF URLs, show only the clicked image, exclude editing and clean up handlers.');
} finally {dom.window.close();}
