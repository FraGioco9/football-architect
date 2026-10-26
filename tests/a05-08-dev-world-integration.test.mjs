import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDevWorldClock} from '../tools/dev-world-clock.mjs';
import '../assets/world-calendar-model.js';
import '../assets/world-clock-adapter.js';

test('A05-08: protected DEV client owns world clock and dispatches public read-only clock snapshots',()=>{
 const client=readFileSync(new URL('../tools/dev-standings-preview-client.mjs',import.meta.url),'utf8');
 assert.match(client,/import \{ createDevWorldClock, nationalProgress, DAY_KEY \} from "\.\/dev-world-clock\.mjs"/);
 assert.match(client,/createDevWorldClock\(sessionStorage,\(name,detail\)=>/);
 assert.match(client,/window\.faDevWorldClockSnapshot=detail/);
 assert.match(client,/window\.dispatchEvent\(new CustomEvent\(name,\{detail\}\)\)/);
});

test('A05-08: DEV Season 0 dispatches a null public snapshot; reactivation remains read-only',()=>{
 const storageMap=new Map();
 const storage={getItem:k=>storageMap.get(k)??null,setItem:(k,v)=>storageMap.set(k,String(v)),removeItem:k=>storageMap.delete(k)};
 const dispatched=[];
 const clock=createDevWorldClock(storage,(name,detail)=>dispatched.push({name,detail}));
 assert.equal(clock.setSeason(0),true);
 assert.equal(clock.read().season,0);
 assert.equal(clock.nationalProgress(),0);
 assert.equal(clock.snapshot(),null);
 assert.equal(clock.setDay(25),false);
 assert.equal(dispatched.find(e=>e.name==='fa:world-clock-snapshot')?.detail,null);
 assert.equal(globalThis.faWorldClockAdapter.normalize(clock.snapshot()).current,null);
 assert.equal(clock.setSeason(1),true);
 assert.equal(clock.setDay(22),true);
 const normal=globalThis.faWorldClockAdapter.normalize(clock.snapshot());
 assert.deepEqual(normal.current,{season:1,day:22});
 assert.ok(globalThis.faWorldClockAdapter.project(1,clock.snapshot()).days.flatMap(d=>d.events).every(e=>e.competitions.every(c=>c.status===null)));
});
