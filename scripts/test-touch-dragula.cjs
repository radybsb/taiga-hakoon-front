const assert = require('assert');
const fs = require('fs');
const path = require('path');
const coffee = require('coffeescript');
const {JSDOM} = require('jsdom');
process.chdir(path.resolve(__dirname, '..'));
const w = new JSDOM('<body><section id="a"><article id="card"><span id="surface">Card</span><a href="#">Link</a><button>Action</button></article></section><section id="b"></section></body>', {runScripts:'outside-only',url:'http://localhost/'}).window;
let now = 0, id = 0, jobs = new Map();
w.setTimeout = (fn, delay=0) => {jobs.set(++id,{fn,at:now+delay});return id;};
w.clearTimeout = n => jobs.delete(n);
function tick(ms) {const end=now+ms; for(;;){const next=[...jobs].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0]; if(!next) break; now=next[1].at; jobs.delete(next[0]); next[1].fn();} now=end;}
w.taiga = {};
w.eval(fs.readFileSync('node_modules/dragula/dist/dragula.js','utf8'));
w.eval(coffee.compile(fs.readFileSync('app/coffee/touch-dragula.coffee','utf8')));
const d=w.document, a=d.querySelector('#a'), b=d.querySelector('#b'), card=d.querySelector('#card'), surface=d.querySelector('#surface');
let behind=surface;
d.elementFromPoint = () => behind;
for(const [el,left] of [[a,0],[b,200],[card,0]]) el.getBoundingClientRect=()=>({left,top:0,right:left+100,bottom:100,width:100,height:100});
let drake=w.taiga.touchDragula([a,b], {moves:item=>item.tagName==='ARTICLE'}), drags=0, drops=0;
drake.on('drag',()=>drags++); drake.on('drop',()=>drops++);
function touch(type,target=surface,x=20,y=20,count=1) {const e=new w.Event(type,{bubbles:true,cancelable:true});const p={identifier:1,clientX:x,clientY:y,pageX:x,pageY:y};Object.defineProperties(e,{touches:{value:type==='touchend'||type==='touchcancel'?[]:Array(count).fill(p)},targetTouches:{value:type==='touchend'||type==='touchcancel'?[]:[p]},changedTouches:{value:[p]}});target.dispatchEvent(e);return e;}
// A tap and a scrolling gesture never arm Dragula or block native scrolling.
touch('touchstart');tick(799);assert.equal(drags,0);touch('touchend');tick(1);assert.equal(drags,0);
touch('touchstart');assert(!touch('touchmove',surface,35).defaultPrevented);tick(1200);assert.equal(drags,0);touch('touchend');
// Interactive children retain their normal touch behavior even during a long hold.
for(const target of [d.querySelector('a'),d.querySelector('button')]) {touch('touchstart',target);tick(1100);assert(!drake.dragging);touch('touchend',target);}
// Hold -> drag -> move across containers -> release persists through the existing drop event.
touch('touchstart');tick(799);assert(!drake.dragging);tick(1);assert(drake.dragging);assert.equal(drags,1);behind=b;assert(touch('touchmove',surface,220).defaultPrevented);touch('touchend',surface,220);assert(!drake.dragging);assert.equal(card.parentNode,b);assert.equal(drops,1);
const click=new w.MouseEvent('click',{bubbles:true,cancelable:true});surface.dispatchEvent(click);assert(click.defaultPrevented,'A completed hold must not open the card');
// A cancelled touch returns to its source; multitouch cancels a pending hold.
behind=surface;touch('touchstart');tick(800);assert(drake.dragging);touch('touchcancel');assert(!drake.dragging);assert.equal(card.parentNode,b);
touch('touchstart');touch('touchmove',surface,20,20,2);tick(800);assert(!drake.dragging);touch('touchend');
// Clickable row wrappers still allow a hold on whitespace, but their links do not.
const row=d.createElement('div');row.className='epic-row';row.setAttribute('ng-click','expand()');card.append(row);row.append(surface);
behind=surface;touch('touchstart');tick(800);assert(drake.dragging);touch('touchend');
// Browser focus loss cancels both pending and active gestures.
touch('touchstart');tick(500);w.dispatchEvent(new w.Event('blur'));tick(500);assert(!drake.dragging);
touch('touchstart');tick(800);assert(drake.dragging);w.dispatchEvent(new w.Event('blur'));assert(!drake.dragging);touch('touchend');
// Desktop dragging remains immediate.
behind=surface;surface.dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,cancelable:true,buttons:1,clientX:20,clientY:20}));surface.dispatchEvent(new w.MouseEvent('mousemove',{bubbles:true,cancelable:true,buttons:1,clientX:30,clientY:20}));assert(drake.dragging);surface.dispatchEvent(new w.MouseEvent('mouseup',{bubbles:true,cancelable:true,buttons:0,clientX:30,clientY:20}));assert(!drake.dragging);
// Destroy removes pending timers and listeners.
touch('touchstart');drake.destroy();tick(800);assert(!drake.dragging);assert(!card.classList.contains('touch-drag-pending'));
w.close();console.log('PASS: touch hold timing, tap, scrolling, interactive controls, drop, cancellation, multitouch, click suppression, mouse dragging and cleanup with real Dragula.');
