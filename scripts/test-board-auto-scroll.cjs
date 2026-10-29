const assert = require('assert');
const fs = require('fs');
const path = require('path');
const coffee = require('coffeescript');
const {JSDOM} = require('jsdom');
process.chdir(path.resolve(__dirname, '..'));
const w=new JSDOM('<body><main id="board" style="overflow-x:auto;overflow-y:hidden"><div id="column" style="overflow-y:auto;overflow-x:hidden"><article>Card</article></div></main></body>',{url:'http://localhost/',runScripts:'outside-only'}).window;
Object.defineProperties(w,{innerWidth:{value:390},innerHeight:{value:800}});
let next=0, frames=new Map();w.requestAnimationFrame=fn=>{frames.set(++next,fn);return next;};w.cancelAnimationFrame=id=>frames.delete(id);
const frame=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
w.taiga={};w.eval(coffee.compile(fs.readFileSync('app/coffee/board-auto-scroll.coffee','utf8')));
const d=w.document,board=d.querySelector('#board'),column=d.querySelector('#column'),card=d.querySelector('article'),page=d.documentElement;
for(const el of [board,column,card])el.getBoundingClientRect=()=>({left:0,top:100,right:390,bottom:1000,width:390,height:900});
function dimensions(el, values){Object.entries(values).forEach(([key,value])=>Object.defineProperty(el,key,{value,configurable:true}));}
dimensions(board,{scrollWidth:1300,clientWidth:390,scrollHeight:900,clientHeight:900});dimensions(column,{scrollWidth:390,clientWidth:390,scrollHeight:2000,clientHeight:900});dimensions(page,{scrollWidth:390,scrollHeight:2500});
d.elementFromPoint=()=>card;
const handlers={};const drake={dragging:false,on(name,fn){(handlers[name]??=[]).push(fn);},off(name,fn){handlers[name]=handlers[name].filter(x=>x!==fn);},destroy(){this.dragging=false;}};
function emit(name){handlers[name].slice().forEach(fn=>fn());}
function mouse(x,y){card.dispatchEvent(new w.MouseEvent('mousemove',{bubbles:true,buttons:1,clientX:x,clientY:y}));}
w.taiga.boardAutoScroll(drake,board);
mouse(385,795);frame();assert.equal(board.scrollLeft,0,'No scrolling before a drag');
drake.dragging=true;emit('drag');frame();assert(board.scrollLeft>0,'Horizontal board edge scrolls');assert(column.scrollTop>0,'Visible viewport bottom scrolls the column even when its rectangle extends below screen');assert.equal(page.scrollTop,0,'Inner scroll takes priority');
let previous=board.scrollLeft;frame();assert(board.scrollLeft>previous,'Continues with stationary finger/pointer');
column.scrollTop=1100;frame();assert(page.scrollTop>0,'Page scrolls after inner vertical scroll reaches its end');
mouse(5,105);previous=board.scrollLeft;frame();assert(board.scrollLeft<previous,'Left edge scrolls back');assert(column.scrollTop<1100,'Top edge scrolls back');
mouse(195,400);previous=board.scrollLeft;let vertical=column.scrollTop;frame();assert.equal(board.scrollLeft,previous);assert.equal(column.scrollTop,vertical);
let touchReplays=0;d.documentElement.addEventListener('touchmove',e=>{if(e.target===d.documentElement)touchReplays++;});
const touch=new w.Event('touchmove',{bubbles:true});Object.defineProperty(touch,'touches',{value:[{identifier:7,clientX:385,clientY:795}]});card.dispatchEvent(touch);frame();assert(touchReplays>0,'Scroll refreshes touch dragging without requiring another physical movement');
drake.dragging=false;emit('dragend');assert.equal(frames.size,0,'Release stops animation');previous=board.scrollLeft;frame();assert.equal(board.scrollLeft,previous);
drake.destroy();mouse(385,795);drake.dragging=true;emit('drag');assert.equal(frames.size,0,'Destroy removes listeners and animation callbacks');w.close();
console.log('PASS: edge scrolling in both axes, viewport clipping, nested/page fallback, stationary drag, touch refresh, release and cleanup.');
