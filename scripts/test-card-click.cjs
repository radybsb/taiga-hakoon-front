const fs=require('fs'),path=require('path'),assert=require('assert');
process.chdir(path.resolve(__dirname,'..'));
const {JSDOM}=require('jsdom'),coffee=require('coffeescript');
const dom=new JSDOM('<body></body>',{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window;
w.$=require('jquery')(w);w.eval(fs.readFileSync('node_modules/angular/angular.js','utf8'));
const app=w.angular.module('taigaComponents',[]),opened=[];
app.value('tgDetailPopup',{open:(route,target)=>opened.push({route,target})});
w.eval(coffee.compile(fs.readFileSync('app/modules/components/card/card-click.directive.coffee','utf8')));
const injector=w.angular.injector(['ng','taigaComponents']),root=injector.get('$rootScope'),scope=root.$new();let clicks=0,buttons=0;
scope.open=()=>{clicks++;};scope.button=()=>{buttons++;};
const el=injector.get('$compile')('<div tg-card-click="open($event)"><p>Free space</p><img src="/preview.png"><button ng-click="button()">Action</button><a href="/task">Title</a><input><span role="button">Arrow</span><video></video><div contenteditable="true">Text</div></div>')(scope);
w.$('body').append(el);root.$digest();
const send=(target,type,x=10,y=10,extra={})=>{const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y,...extra});target.dispatchEvent(event);root.$digest();return event;};
function click(target,extra={}){assert(!send(target,'pointerdown',10,10,extra).defaultPrevented);send(target,'pointerup',10,10,extra);return send(target,'click',10,10,extra);}
click(el.find('p')[0]);assert.equal(clicks,1);click(el.find('img')[0]);assert.equal(clicks,2);
for(const selector of ['button','a','input','[role="button"]','video','[contenteditable]']){click(el.find(selector)[0]);assert.equal(clicks,2,selector+' keeps its own action');}
assert.equal(buttons,1);
const free=el.find('p')[0];
send(free,'pointerdown');send(w.document,'pointermove',60,30);send(w.document,'pointermove',10,10);send(free,'pointerup');send(free,'click');assert.equal(clicks,2,'Dragging and returning to the original position must not open');
send(free,'pointerdown');send(w.document,'pointerup',70,10);send(free,'click');assert.equal(clicks,2,'Dragging outside the card must not open');
send(free,'pointerdown');send(w.document,'pointercancel');send(free,'click');assert.equal(clicks,2);
for(const modifier of [{ctrlKey:true},{shiftKey:true},{metaKey:true},{altKey:true},{button:2}])click(free,modifier);
assert.equal(clicks,2);click(free);assert.equal(clicks,3,'Normal clicks must still work after a drag');
const story=injector.get('$compile')('<div tg-card-click="{route: \'project-userstories-detail\', project: \'demo\', ref: 12}"><span>Story</span></div>')(scope);w.$('body').append(story);root.$digest();click(story.find('span')[0]);assert.equal(opened.length,1);assert.equal(opened[0].target.ref,12);
scope.$destroy();dom.window.close();console.log('PASS: card whitespace/images open; interactive controls remain independent; dragging, cancelled gestures and modifier clicks do not open; story popup dispatch');
