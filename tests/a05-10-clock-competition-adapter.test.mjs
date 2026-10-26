import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/world-calendar-model.js';
import '../assets/world-clock-adapter.js';
const adapter=globalThis.faWorldClockAdapter;

test('A05-10 adapter competition view isolates events but does not alter world snapshot',()=>{
 const world={source:{kind:'dev',reference:'test fixture'},current:{season:3,day:22}};
 const before=JSON.stringify(world);
 const one=adapter.projectCompetition(3,'IT-1',world),other=adapter.projectCompetition(2,'int-1',world);
 assert.equal(one.competitionId,'IT-1');assert.equal(other.competitionId,'int-1');
 assert.equal(one.days.length,56);assert.equal(other.days.length,56);
 assert.ok(one.days.flatMap(d=>d.events).every(e=>e.competitions.length===1&&e.competitions[0].competitionId==='IT-1'));
 assert.ok(other.days.flatMap(d=>d.events).every(e=>e.competitions.length===1&&e.competitions[0].competitionId==='int-1'));
 assert.ok(one.days.flatMap(d=>d.events).every(e=>e.competitions[0].status===null));
 assert.equal(JSON.stringify(world),before);
});
test('A05-10 adapter Season 0 never authorizes results and rejects untrusted lifecycle',()=>{
 const empty=adapter.projectCompetition(1,'IT-1',null);
 assert.ok(empty.days.flatMap(d=>d.events).every(e=>e.competitions[0].status===null));
 const forged={source:{kind:'dev',reference:'test'},current:{season:1,day:54},eventStates:[{id:'forged',status:'completed'}]};
 assert.throws(()=>adapter.projectCompetition(1,'IT-1',forged),/Lifecycle data/);
 assert.throws(()=>adapter.projectCompetition(1,'NOT-A-CUP',null));
});
