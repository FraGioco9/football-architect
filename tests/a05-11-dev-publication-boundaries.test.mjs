import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planPublicFiles,isAllowlistedPublicPath} from '../tools/publication-guard.mjs';
import {createDevWorldClock} from '../tools/dev-world-clock.mjs';
import '../assets/world-calendar-model.js';
import '../assets/world-clock-adapter.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('A05-11 publication guard: public projections allowed, protected clocks and providers excluded',()=>{
 const published=new Set(planPublicFiles());
 for(const p of ['assets/world-calendar-model.js','assets/world-clock-adapter.js','assets/competition-fixtures.js','assets/competition-stats.js','assets/competition-history.js','assets/world-calendar.js']){
  assert.equal(published.has(p),true,p);assert.equal(isAllowlistedPublicPath(p),true,p);
 }
 for(const p of ['tools/dev-world-clock.mjs','tools/dev-standings-preview-client.mjs','tools/dev-fictional-provider.mjs','assets/static-provider.mjs','assets/verified-history-provider.mjs']){
  assert.equal(published.has(p),false,p);assert.equal(isAllowlistedPublicPath(p),false,p);
 }
});

test('A05-11 public consumer entrypoints cannot import protected DEV modules',()=>{
 for(const p of ['assets/world-calendar.js','assets/competition-fixtures.js','assets/competition-stats.js','assets/competition-history.js','assets/world-clock-adapter.js','assets/world-calendar-model.js']){
  const source=read(p);
  assert.doesNotMatch(source,/\/__fa_dev__\/|(?:import\s*|require\s*\()\s*['"][^'"]*(?:tools\/dev-|dev-competition-stats|dev-standings-preview)/,p);
 }
});

test('A05-11 fake DEV clock cannot authorize lifecycle records or persist across Season 0',()=>{
 const db=new Map(),storage={getItem:k=>db.get(k)??null,setItem:(k,v)=>db.set(k,String(v)),removeItem:k=>db.delete(k)};
 const events=[],clock=createDevWorldClock(storage,(name,detail)=>events.push({name,detail}));
 assert.equal(clock.setSeason(0),true);
 assert.equal(clock.snapshot(),null);assert.equal(clock.setDay(25),false);
 const adapter=globalThis.faWorldClockAdapter;
 const disabled=adapter.projectCompetition(1,'IT-1',clock.snapshot());
 assert.ok(disabled.days.flatMap(d=>d.events).every(e=>e.competitions.every(c=>c.status===null)));
 assert.equal(clock.setSeason(2),true);assert.equal(clock.setDay(28),true);
 const snap=clock.snapshot();
 assert.equal(snap.source.kind,'dev');
 assert.throws(()=>adapter.projectCompetition(2,'IT-1',{...snap,eventStates:[{id:'forged',status:'completed'}]}),/Lifecycle data/);
 assert.equal(events.some(e=>e.name==='fa:world-clock-snapshot'&&e.detail===null),true);
});
