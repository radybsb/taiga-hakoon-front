const fs = require('fs'), path = require('path'), assert = require('assert');
process.chdir(path.resolve(__dirname, '..'));
const {JSDOM} = require('jsdom'), coffee = require('coffeescript'), jade = require('jade');
const dom = new JSDOM('<!doctype html><body></body>', {url:'http://localhost:9001/',runScripts:'outside-only'});
const w = dom.window;
w.$ = require('jquery')(w);
w.eval(fs.readFileSync('node_modules/angular/angular.js','utf8'));
const base = 'app/modules/user-timeline/user-timeline-attachment/';
w.angular.module('taigaUserTimeline',[]).value('$tgTemplate', {get(name) {
  return jade.renderFile(base + path.basename(name).replace(/\.html$/,'.jade'));
}});
w.eval(coffee.compile(fs.readFileSync(base+'user-timeline-attachment.directive.coffee','utf8')));
const injector = w.angular.injector(['ng','taigaUserTimeline']);
const root = injector.get('$rootScope'), compile = injector.get('$compile');
function render(values) {
  const scope = root.$new(); scope.attachment = {get:key=>values[key]};
  const el = compile('<div tg-user-timeline-attachment="attachment"></div>')(scope);
  w.document.body.appendChild(el[0]);root.$digest();
  return {el,scope};
}
for(const url of ['/media/attachments/photo.JPG?token=abc', '/media/attachments/photo.webp#preview']) {
  const {el,scope} = render({url,filename:'Photo'});
  assert.equal(el.find('img').length,1);assert.equal(el.find('a').length,0);
  assert.equal(el.find('img').attr('src'),url);
  scope.$destroy();el.remove();
}
for(const values of [
  {url:'/media/attachments/clip.MP4?token=abc',filename:'Clip'},
  {url:'/media/attachments/opaque-id?token=abc',filename:'clip.mp4'}
]) {
  const {el,scope} = render(values), video = el.find('video')[0];
  assert(video);assert.equal(el.find('a').length,0);
  assert(video.controls);assert(video.hasAttribute('playsinline'));
  assert.equal(video.getAttribute('preload'),'metadata');
  assert.equal(video.getAttribute('src'),values.url);
  assert.equal(video.getAttribute('aria-label'),values.filename);
  assert(video.getAttribute('controlslist').includes('nodownload'));
  assert(video.hasAttribute('disablepictureinpicture'));
  assert(video.hasAttribute('disableremoteplayback'));
  const menu = new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true});
  video.dispatchEvent(menu);assert(menu.defaultPrevented);
  scope.$destroy();
  const afterDestroy = new w.MouseEvent('contextmenu',{cancelable:true});
  video.dispatchEvent(afterDestroy);assert(!afterDestroy.defaultPrevented);
  el.remove();
}
const {el,scope} = render({url:'/media/attachments/report.pdf',filename:'report.pdf'});
assert.equal(el.find('video').length,0);assert.equal(el.find('a').attr('href'),'/media/attachments/report.pdf');
scope.$destroy();dom.window.close();
console.log('PASS: timeline image without link, inline MP4 player, signed URLs, hidden download/PiP, context menu cleanup and ordinary attachments');
