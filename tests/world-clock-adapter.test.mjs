import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const model=require('../assets/world-calendar-model.js');
globalThis.faWorldCalendarModel=model;
const adapter=require('../assets/world-clock-adapter.js');
test('CAL-IMP-05A unavailable clock never invents progress',()=>{
 const x=adapter.normalize(null);assert.equal(x.current,null);
 const p=adapter.project(1,null);assert.equal(p.days[0].relative,null);
 assert.equal(p.days[15].events[0].competitions[0].status,null);
});
test('CAL-IMP-05A explicit DEV current day and immutable projection',()=>{
 const x=adapter.normalize({source:{kind:'dev',reference:'fictional test'},current:{season:1,day:16}});
 const p=adapter.project(1,x);
 assert.equal(p.days[15].relative,'current');
 assert.equal(p.days[14].relative,'past');assert.equal(p.days[16].relative,'future');
 assert.equal(p.days[15].events[0].competitions[0].status,null);
 assert.ok(Object.isFrozen(x));assert.ok(Object.isFrozen(x.current));
});
test('CAL-IMP-05A fail closed for malformed or untrusted lifecycle',()=>{
 for(const current of [{season:1,day:0},{season:1,day:57},{season:'1',day:2},null])
  assert.throws(()=>adapter.normalize({source:{kind:'dev',reference:'x'},current}));
 assert.throws(()=>adapter.normalize({source:{kind:'dev',reference:'x'},current:{season:1,day:1},eventStates:[{status:'completed'}]}));
});
