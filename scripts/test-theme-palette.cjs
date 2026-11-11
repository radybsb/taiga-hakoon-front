const fs = require('fs');
const path = require('path');
const assert = require('assert');
const sass = require('node-sass');
const css = require('css');
process.chdir(path.resolve(__dirname, '..'));
const names = ['primary','primary-75','primary-50','primary-25','primary-10','primary-dark','primary-background',
 'secondary','secondary-75','secondary-50','secondary-25','secondary-dark','tertiary',
 'grey-02','grey-05','grey-10','grey-20','grey-30','grey-40','grey-50','grey-60','grey-70','grey-80','grey-90',
 'color-solid-primary','color-link-primary','color-link-tertiary','color-gray100','color-gray200','color-gray300','color-gray400','color-gray800',
 'color-black600','color-black700','color-black800','color-black900','card','card-hover','card-dark','highlight','default-tags',
 'red','red-25','red-10','green-light','my-sin','yellow-green','color-link-red','color-link-orange','color-link-yellow','color-link-green','color-link-purple','tribe-primary'];
const tokenRules = names.map(n=>`.token-${n} { r: red($${n}); g: green($${n}); b: blue($${n}); }`).join('\n');
const compiled = sass.renderSync({data:`@import 'dependencies';
${tokenRules}
.palette-light { @include workspace-palette(light); }
.palette-dark { @include workspace-palette(dark); }
.generic-popover { @include popover(12rem); }
.custom-popover { @include popover(12rem, $background-color: $color-link-red, $text-color: $color-white, $hover-background: $color-link-orange); }
`,includePaths:['app/styles/extras','app/themes/taiga']}).css.toString();
const rules=css.parse(compiled).stylesheet.rules.filter(r=>r.type==='rule');
const declarations=selector=>Object.fromEntries(rules.find(r=>r.selectors.includes(selector)).declarations.filter(d=>d.type==='declaration').map(d=>[d.property,d.value]));
const tokens=Object.fromEntries(names.map(name=>{const d=declarations('.token-'+name);return [name,'#'+['r','g','b'].map(k=>Number(d[k]).toString(16).padStart(2,'0')).join('')];}));
const light=declarations('.palette-light'),dark=declarations('.palette-dark');
assert.equal(tokens.primary,'#4e56d9');assert.equal(tokens.secondary,'#535bdc');assert.equal(tokens.tertiary,'#dce3ee');
assert.equal(tokens['primary-dark'],'#444bc2');assert.equal(tokens['primary-10'],'#eeedff');assert.equal(tokens['color-link-primary'],tokens.primary);assert.equal(tokens['color-link-tertiary'],'#637189');
assert.equal(tokens['color-gray400'],tokens.tertiary);assert.equal(tokens['color-black900'],'#243047');assert.equal(tokens['grey-50'],'#637189');assert.equal(tokens['card'],'#ffffff');
const preserved={red:'#ff6363','red-25':'#ffa5a5','red-10':'#ffe7e7','green-light':'#d1dfc5','my-sin':'#fcaf3e','yellow-green':'#9dce0a','color-link-red':'#e44057','color-link-orange':'#ea7b4b','color-link-yellow':'#f6c95c','color-link-green':'#93c45d','color-link-purple':'#ca81be','tribe-primary':'#107a8a'};
for(const [name,value] of Object.entries(preserved))assert.equal(tokens[name],value,'Preserve state/brand color '+name);
for(const [name,value] of Object.entries({bg:'#f4f6fa',surface:'#fff',soft:'#edf1f7',hover:'#e5eaf3',text:'#243047',muted:'#637189',border:'#dce3ee',accent:'#4e56d9','accent-soft':'#eeedff'}))assert.equal(light['--workspace-'+name],value);
for(const [name,value] of Object.entries({bg:'#111722',surface:'#1b2331',soft:'#151d2a',hover:'#29354a',text:'#e6ecf5',muted:'#a2b0c6',border:'#334158',accent:'#b2b5ff','accent-soft':'#303356'}))assert.equal(dark['--workspace-'+name],value);
for(const mode of [light,dark]){
 assert.equal(mode['--workspace-button-primary'],'#535bdc');assert.equal(mode['--workspace-button-primary-hover'],'#444bc2');assert.equal(mode['--workspace-button-primary-text'],'#fff');
}
function rgb(value){if(value.length===4)value='#'+[...value.slice(1)].map(c=>c+c).join('');return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255);}
function luminance(value){return rgb(value).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);}
for(const mode of [light,dark]){
 for(const role of ['text','muted','accent'])assert(contrast(mode['--workspace-'+role],mode['--workspace-surface'])>=4.5,role+' must remain readable');
 for(const role of ['button-primary','button-primary-hover'])assert(contrast(mode['--workspace-button-primary-text'],mode['--workspace-'+role])>=4.5,role+' must have readable text');
}
assert(declarations('.generic-popover').background.includes('var(--workspace-surface'));
assert(declarations('.generic-popover').color.includes('var(--workspace-accent'));
assert.equal(declarations('.custom-popover').background,'#E44057');assert.equal(declarations('.custom-popover').color,'#FFFFFF');
assert.equal(declarations('.custom-popover li:hover').background,'#EA7B4B');
console.log('PASS: legacy aliases use modern palette; light/dark token values remain consistent; status and brand colors are preserved; text/action contrast is at least 4.5:1; popovers respect custom colors.');
if(process.argv.includes('--values'))console.log(JSON.stringify(tokens,null,2));
