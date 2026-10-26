import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/world-calendar-model.js';
import '../assets/world-clock-adapter.js';
import {createDevWorldClock,nationalProgress} from '../tools/dev-world-clock.mjs';

const calendar=globalThis.faWorldCalendarModel;
const adapter=globalThis.faWorldClockAdapter;
const national=[13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,34,35,37,39,40,42,44,45,47,49,50,52,53,54];
const international=[16,19,22,25,28,31,36,38,41,43,46,48];

test('A05-07 calendar baseline: exact 56-day national/international marker layout is unchanged',()=>{
 const s=calendar.createSeason(2);
 assert.equal(s.days.length,56);
 const nationalEvents=s.days.flatMap(d=>d.events.filter(e=>e.family==='national').map(e=>({day:d.day,marker:e.marker})));
 assert.deepEqual(nationalEvents,national.map((day,i)=>({day,marker:'N'+String(i+1).padStart(2,'0')})));
 const cupEvents=s.days.flatMap(d=>d.events.filter(e=>e.family==='international').map(e=>({day:d.day,marker:e.marker})));
 assert.deepEqual(cupEvents,[
  ...international.map((day,i)=>({day,marker:'I'+String(i+1).padStart(2,'0')})),
  {day:53,marker:'FEDERATION-FINAL'},{day:54,marker:'SOVEREIGN-FINAL'}
 ]);
 assert.equal(s.days[52].pairing,'final');
 assert.equal(s.days[53].pairing,'final');
 assert.ok(Object.isFrozen(s.days[15].events[0]));
});

test('A05-07 viewed season only changes temporal projection, never clock state or completion',()=>{
 const input={source:{kind:'dev',reference:'DEV fictional clock'},current:{season:2,day:22}};
 const before=JSON.stringify(input);
 for(const viewed of [1,2,3]){
  const p=adapter.project(viewed,input);
  assert.equal(p.season,viewed);
  assert.equal(p.days.length,56);
  assert.equal(p.days[21].relative,viewed===2?'current':viewed<2?'past':'future');
  assert.ok(p.days.every(day=>day.events.every(event=>event.competitions.every(c=>c.status===null))));
 }
 assert.equal(JSON.stringify(input),before);
 assert.deepEqual(adapter.normalize(input).current,{season:2,day:22});
});

test('A05-07 unavailable clock preserves event identity but cannot imply completion',()=>{
 const projected=adapter.project(1,null);
 assert.equal(projected.days.length,56);
 assert.ok(projected.days.every(d=>d.relative===null));
 assert.ok(projected.days.flatMap(d=>d.events).every(e=>e.competitions.every(c=>c.status===null)));
 assert.throws(()=>adapter.normalize({source:{kind:'dev',reference:'test'},current:{season:1,day:22},eventStates:[{eventId:'season:1:I01',competitionId:'int-1',status:'completed'}]}));
});

test('A05-07 protected DEV clock: effective transitions, no-op and Season 0 preserve revision semantics',()=>{
 const map=new Map();
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
 const events=[];
 const clock=createDevWorldClock(storage,(name,detail)=>events.push([name,detail]));
 const initial=clock.revision();
 assert.equal(clock.commit({season:1,day:13}),true);
 assert.equal(clock.revision(),initial+1);
 assert.equal(clock.nationalProgress(),nationalProgress(13));
 const count=events.length;
 assert.equal(clock.commit({season:1,day:13}),true);
 assert.equal(clock.revision(),initial+1);
 assert.equal(events.length,count);
 assert.equal(clock.commit({season:0,day:55}),true);
 assert.equal(clock.read().day,1);
 assert.equal(clock.snapshot(),null);
 assert.equal(clock.nationalProgress(),0);
 assert.equal(clock.setDay(22),false);
 assert.equal(clock.commit({season:9,day:1}),false);
});
