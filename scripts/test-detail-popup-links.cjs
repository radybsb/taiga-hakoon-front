const fs=require('fs'),path=require('path'),assert=require('assert');
process.chdir(path.resolve(__dirname,'..'));
const {JSDOM}=require('jsdom'),coffee=require('coffeescript');
const dom=new JSDOM('<body></body>',{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window;
w.$=require('jquery')(w);w._=require('lodash');w.taiga={Service:class{},trim:(value,chars)=>w._.trim(value,chars),bindOnce:(scope,attr,cb)=>cb(scope.$eval(attr))};
w.eval(fs.readFileSync('node_modules/angular/angular.js','utf8'));
const app=w.angular.module('taigaBase',[]),opens=[];let closes=0;
app.value('$tgAuth',{getUser:()=>null});app.value('$tgLocation',{url:()=>{throw Error('Popup link must not route');}});
app.value('lightboxService',{closeAll:()=>closes++});app.value('$tgSections',{});app.value('tgDetailPopup',{open:(route,options)=>opens.push({route,options})});
w.eval(coffee.compile(fs.readFileSync('app/coffee/modules/base/navurls.coffee','utf8')));
const injector=w.angular.injector(['ng','taigaBase']),root=injector.get('$rootScope'),scope=root.$new();
injector.get('$tgNavUrls').update({'project-userstories-detail':'/project/:project/us/:ref'});
scope.project={slug:'demo'};scope.item={ref:12};
const el=injector.get('$compile')('<a tg-nav="project-userstories-detail:project=project.slug,ref=item.ref" tg-detail-popup-link>Story</a>')(scope);w.$('body').append(el);root.$digest();
(async()=>{
 el.trigger('pointerenter');
 for(let i=0;i<5;i++){root.$digest();await Promise.resolve();}
 assert.equal(el.attr('href'),'project/demo/us/12');
 function click(options={}){const e=new w.MouseEvent('click',{bubbles:true,cancelable:true,button:0,...options});el[0].dispatchEvent(e);root.$digest();return e;}
 assert(click().defaultPrevented);assert.equal(opens.length,1);assert.equal(opens[0].options.ref,12);assert.equal(closes,0);
 for(const options of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{button:2}])assert.equal(click(options).defaultPrevented,false);
 assert.equal(opens.length,1);scope.$destroy();dom.window.close();console.log('PASS: popup link keeps real href, opens without routing/closing parent, and preserves modified/middle/right browser clicks');
})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1;});
