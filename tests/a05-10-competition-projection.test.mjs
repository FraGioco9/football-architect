import test from 'node:test';
import assert from 'node:assert/strict';
import model from '../assets/world-calendar-model.js';

test('A05-10: competition projections isolate 33 national slots',()=>{
 const projected=model.projectCompetition(1,'IT-1');
 const events=projected.days.flatMap(d=>d.events);
 assert.equal(events.length,33);
 assert.ok(events.every(e=>e.family==='national'&&e.competitions.length===1&&e.competitions[0].competitionId==='IT-1'));
 assert.ok(Object.isFrozen(projected.days[12].events));
});

test('A05-10: international finals are scoped to their owning cup',()=>{
 const a=model.projectCompetition(2,'int-1'),b=model.projectCompetition(2,'int-2');
 const ea=a.days.flatMap(d=>d.events),eb=b.days.flatMap(d=>d.events);
 assert.equal(ea.length,13);assert.equal(eb.length,13);
 assert.ok(ea.some(e=>e.marker==='SOVEREIGN-FINAL'));
 assert.ok(!ea.some(e=>e.marker==='FEDERATION-FINAL'));
 assert.ok(eb.some(e=>e.marker==='FEDERATION-FINAL'));
 assert.ok(!eb.some(e=>e.marker==='SOVEREIGN-FINAL'));
 assert.ok(ea.every(e=>e.competitions.length===1&&e.competitions[0].competitionId==='int-1'));
});

test('A05-10: historical reading never changes World Progress or invents results',()=>{
 const options={source:{kind:'dev',reference:'fictional'},current:{season:3,day:22},eventStates:[]};
 const snapshot=JSON.stringify(options);
 const old=model.projectCompetition(2,'int-1',options),future=model.projectCompetition(4,'IT-1',options);
 assert.ok(old.days.flatMap(d=>d.events).every(e=>e.competitions[0].status===null));
 assert.ok(future.days.flatMap(d=>d.events).every(e=>e.competitions[0].status===null));
 assert.equal(old.days[15].relative,'past');assert.equal(future.days[15].relative,'future');
 assert.equal(JSON.stringify(options),snapshot);
});

test('A05-10: projection rejects unknown competition identity',()=>{
 for(const id of ['IT-3','int-3','',null])assert.throws(()=>model.projectCompetition(1,id));
});
