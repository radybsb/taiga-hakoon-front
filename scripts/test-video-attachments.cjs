// Run from taiga-front: node scripts/test-video-attachments.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert');
process.chdir(path.resolve(__dirname, '..'));
const coffee = require('coffeescript');
const jade = require('jade');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><body></body>', {
  url: 'http://localhost:9001/', runScripts: 'outside-only'
});
const w = dom.window;
w._ = require('lodash');
w.Immutable = require('immutable');
w.taiga = {};
w.$ = require('jquery')(w);
const evaluate = file => w.eval(coffee.compile(fs.readFileSync(file, 'utf8')));
evaluate('app/coffee/utils.coffee');
w.eval(fs.readFileSync('node_modules/angular/angular.js', 'utf8'));
const preview = { fileId: 2 };
let opened = 0;
let closed = 0;
w.angular.module('taigaComponents', [])
  .value('tgAttachmentsPreviewService', preview)
  .value('lightboxService', { open: () => opened++, close: () => closed++ })
  .filter('sizeFormat', () => value => value == null ? '' : value + ' bytes');
evaluate('app/modules/components/attachments-preview/attachments-preview.controller.coffee');
evaluate('app/modules/components/attachments-preview/attachments-preview.directive.coffee');
evaluate('app/modules/components/attachment-link/attachment-link.directive.coffee');
const injector = w.angular.injector(['ng', 'taigaComponents']);
const root = injector.get('$rootScope');
const compile = injector.get('$compile');
const scope = root.$new();
const controller = injector.get('$controller')('AttachmentsPreview', {});
const url = 'http://localhost:9000/media/attachments/test.mp4?token=test';
controller.attachments = w.Immutable.fromJS([
  {file: {id: 1, name: 'image.png', url: '/image.png'}},
  {file: {id: 2, name: 'video.MP4', url, size: 134590, created_date: '2026-10-17T00:12:00Z'}},
  {file: {id: 3, name: 'notes.txt', url: '/notes.txt'}},
  {file: {id: 4, name: 'animated.gif', url: '/animated.gif'}}
]);
assert(controller.isVideo());
assert(controller.hasPagination());
controller.next(); assert.equal(preview.fileId, 4);
controller.next(); assert.equal(preview.fileId, 1);
controller.previous(); assert.equal(preview.fileId, 4);
controller.previous(); assert.equal(preview.fileId, 2);
scope.vm = controller;
const html = jade.render(fs.readFileSync('app/modules/components/attachments-preview/attachments-preview.jade', 'utf8'));
const element = compile('<div>' + html + '</div>')(scope);
w.angular.element(w.document.body).append(element);
root.$digest();
const video = element[0].querySelector('video');
assert(video);
assert.equal(video.getAttribute('src'), url);
assert.equal(element[0].querySelectorAll('img').length, 0);
assert.equal(element[0].querySelector('.attachment-preview-name').textContent.trim(), 'video.MP4');
assert(element[0].querySelector('.attachment-preview-meta').textContent.includes('134590 bytes'));
assert.deepEqual(Array.from(element[0].querySelectorAll('.attachment-preview-action span'), el => el.textContent.trim()),
  ['Download', 'Edit', 'Delete']);
const original = controller.getCurrentAttachment();
let updated;
controller.onUpdate = ({attachment}) => updated = attachment;
controller.beginEdit();
assert(controller.editing);
assert.equal(original.get('editable'), undefined);
controller.updateCurrent(controller.editableAttachment.set('editable', false).setIn(['file', 'description'], 'Updated caption'));
assert.equal(updated.getIn(['file', 'description']), 'Updated caption');
assert.equal(original.getIn(['file', 'description']), undefined);
assert.equal(controller.editing, false);
controller.beginEdit();
controller.next(); assert.equal(controller.editing, false); root.$digest();
assert.equal(element[0].querySelectorAll('video').length, 0);
assert.equal(element[0].querySelectorAll('img').length, 1);
const linkScope = root.$new();
linkScope.attachment = controller.attachments.get(1);
const link = compile('<a tg-attachment-link="attachment" href="/download" download>video</a>')(linkScope);
w.angular.element(w.document.body).append(link);
root.$digest();
const event = new w.MouseEvent('click', {bubbles: true, cancelable: true});
link[0].dispatchEvent(event);
assert(event.defaultPrevented);
assert.equal(opened, 1);
assert.equal(preview.fileId, 2);
root.$digest();
const directive = injector.get('tgAttachmentsPreviewDirective')[0];
const modalScope = root.$new();
const modal = w.$('<div class="open close-started"><video></video></div>');
let paused = 0;
modal[0].querySelector('video').pause = () => paused++;
directive.link(modalScope, modal, {}, controller);
// Keyboard navigation remains available on video slides outside player focus.
w.$(w.document.body).append(modal);modal.removeClass('close-started');
const player=modal.find('video').attr('tabindex','0')[0];
const arrow=(key,target=w.document.body)=>{const event=new w.KeyboardEvent('keydown',{keyCode:key,bubbles:true,cancelable:true});target.dispatchEvent(event);root.$digest();return event;};
assert(arrow(39).defaultPrevented);assert.equal(preview.fileId,4);
arrow(37);assert.equal(preview.fileId,2);
player.focus();assert.equal(w.document.activeElement,player);
assert.equal(arrow(39,player).defaultPrevented,false);assert.equal(preview.fileId,2);
assert.equal(arrow(37).defaultPrevented,false);assert.equal(preview.fileId,2);
player.blur();arrow(37);assert.equal(preview.fileId,1);arrow(39);assert.equal(preview.fileId,2);
// A hidden preview must not navigate too or remove another preview's handler.
const hiddenScope=root.$new(),hidden=w.$('<div><video></video></div>');
hidden.find("video")[0].pause=()=>{};
directive.link(hiddenScope,hidden,{},controller);arrow(39);assert.equal(preview.fileId,4);
hiddenScope.$destroy();arrow(37);assert.equal(preview.fileId,2);
const input = w.$('<input>').appendTo(modal)[0];
const beforeTyping = preview.fileId;
assert.equal(arrow(39, input).defaultPrevented, false);
assert.equal(preview.fileId, beforeTyping);
// Only a click fully originating and ending in free space dismisses the viewer.
const image = w.$('<img>').appendTo(modal)[0];
const action = w.$('<button><svg></svg></button>').appendTo(modal)[0];
const free = w.$('<div class="attachment-preview-footer">Metadata</div>').appendTo(modal)[0];
const send = (target, type) => target.dispatchEvent(new w.MouseEvent(type, {button: 0, bubbles: true, cancelable: true}));
const clickFromTo = (from, to) => { send(from, 'pointerdown'); send(to, 'pointerup'); send(to, 'click'); root.$digest(); };
const beforeFreeClick = closed;
clickFromTo(image, image); clickFromTo(player, player); clickFromTo(action.querySelector('svg'), action.querySelector('svg'));
clickFromTo(input, free); clickFromTo(image, free); clickFromTo(free, image);
assert.equal(closed, beforeFreeClick);
send(free, 'pointerdown'); send(free, 'pointercancel'); send(free, 'pointerup'); send(free, 'click'); root.$digest();
assert.equal(closed, beforeFreeClick);
clickFromTo(free, free);
assert.equal(closed, beforeFreeClick + 1);
assert.equal(element[0].querySelector('.attachment-preview-image a'), null);
const beforeDelete = closed;
let deleted;
controller.onDelete = ({attachment}) => deleted = attachment;
controller.deleteCurrent();
assert.equal(closed, beforeDelete);
assert.equal(deleted.getIn(['file', 'id']), 2);
modal.addClass('close-started');arrow(39);assert.equal(preview.fileId,2);
root.$broadcast('lightbox:closed');
assert.equal(paused, 1);
assert.equal(preview.fileId, null);
modalScope.$destroy(); scope.$destroy(); linkScope.$destroy();
dom.window.close();
console.log('PASS: mixed media pagination, MP4 modal rendering, image rendering, attachment click, video focus keyboard controls, hidden preview isolation and pause on close');
