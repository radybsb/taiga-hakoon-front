// Run: node scripts/test-backlog-bulk.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
process.chdir(path.resolve(__dirname, '..'));
const coffee = require('coffeescript');
const factories = {}, directives = {};
const context = {angular: {module: () => ({factory: (name, value) => factories[name] = value, directive: (name, value) => directives[name] = value})}, _: require('lodash'), taiga: {trim: text => text.trim()}};
vm.runInNewContext(coffee.compile(fs.readFileSync('app/coffee/modules/backlog/bulk-actions.coffee', 'utf8')), context);
const originals = new Map([
 [1, {id:1, version:4, tags:[['existing','#abc']], assigned_users:[8], assigned_to:8, status:1, sprint_order:3, epics:[{id:9}]}],
 [2, {id:2, version:7, tags:[], assigned_users:[], assigned_to:null, status:1, sprint_order:4, epics:[]}]
]);
const structuredClone = value => JSON.parse(JSON.stringify(value));
const calls = [], failures = new Set();
const repo = {
 queryOne: async (type,id,params) => {assert.equal(type,'userstories');assert.equal(params.project,10);return structuredClone(originals.get(id));},
 save: async us => {calls.push(['save',structuredClone(us)]);if(failures.has(us.id))throw Error('conflict');originals.set(us.id,structuredClone(us));return us;},
 remove: async us => {calls.push(['delete',us.id]);if(failures.has(us.id))throw Error('forbidden');}
};
const rs = {userstories:{bulkUpdateMilestone: async (...args) => calls.push(['sprint',...args])}};
const rs2 = {epics:{addRelatedUserstory: async (epic,id) => {calls.push(['epic',epic,id]);if(failures.has(id))throw Error('forbidden');}}};
const service = factories.tgBacklogBulkActions({when:()=>Promise.resolve(),all:values=>Promise.all(values)},repo,rs,rs2);
(async()=>{
 let result = await service.run(10,[1,2,1],'tag',{name:' New ',color:'#def'});
 assert.deepEqual(Array.from(result.succeeded),[1,2]);
 assert.deepEqual(originals.get(1).tags,[['existing','#abc'],['new','#def']]);
 assert.equal(originals.get(1).version,4);
 await service.run(10,[1,2],'tag',{name:'NEW',color:'#def'});
 assert.equal(originals.get(1).tags.length,2);
 await service.run(10,[1,2],'assigned',[8,11]);
 assert.deepEqual(originals.get(1).assigned_users,[8,11]);
 assert.equal(originals.get(1).assigned_to,8);
 assert.equal(originals.get(2).assigned_to,8);
 failures.add(2);
 result = await service.run(10,[1,2],'status',5);
 assert.deepEqual(Array.from(result.succeeded),[1]);
 assert.deepEqual(Array.from(result.failed),[2]);
 assert.equal(originals.get(1).status,5);
 assert.equal(originals.get(2).status,1);
 failures.clear();
 calls.length=0;
 await service.run(10,result.failed,'status',5);
 assert.equal(calls.length,1);
 assert.equal(calls[0][1].id,2);
 calls.length=0;
 await service.run(10,[1,2],'epic',9);
 assert.deepEqual(calls,[['epic',9,2]]);
 calls.length=0;
 await service.run(10,[1,2],'sprint',77);
 assert.equal(calls.length,1);
 assert.equal(calls[0][1],10);
 assert.equal(calls[0][2],77);
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0][3])),[{us_id:1,order:3},{us_id:2,order:4}]);
 failures.add(2);
 result=await service.run(10,[1,2],'delete');
 assert.deepEqual(Array.from(result.succeeded),[1]);
 assert.deepEqual(Array.from(result.failed),[2]);
 console.log('PASS: additive tags/assignees, fresh versions, status, existing epic links, batch sprint destination, partial failures and retry');
})().catch(error=>{console.error(error);process.exitCode=1;});
