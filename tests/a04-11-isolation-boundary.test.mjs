import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planPublicFiles,isAllowlistedPublicPath} from '../tools/publication-guard.mjs';
import {createDevWorldClock} from '../tools/dev-world-clock.mjs';
import '../assets/world-calendar-model.js';
import '../assets/world-clock-adapter.js';

const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('A04-11: only pure selectors cross the publication boundary',()=>{
 const publicPaths=new Set(planPublicFiles());
 for(const path of ['assets/provider-selectors.mjs','assets/provider-selectors-bootstrap.mjs']){
  assert.equal(publicPaths.has(path),true,path);
  assert.equal(isAllowlistedPublicPath(path),true,path);
 }
 for(const path of ['assets/provider-contract.mjs','assets/static-provider.mjs',
  'assets/verified-history-provider.mjs','tools/dev-fictional-provider.mjs',
  'tools/dev-world-clock.mjs','tools/dev-standings-preview-client.mjs']){
  assert.equal(publicPaths.has(path),false,path);
  assert.equal(isAllowlistedPublicPath(path),false,path);
 }
 const bootstrap=text('assets/provider-selectors-bootstrap.mjs');
 assert.match(bootstrap,/from '\.\/provider-selectors\.mjs'/);
 assert.doesNotMatch(bootstrap,/__fa_dev__|\/tools\/|fetch\(|sessionStorage|localStorage/);
 const selectors=text('assets/provider-selectors.mjs');
 assert.doesNotMatch(selectors,/__fa_dev__|\/tools\/|fetch\(|sessionStorage|localStorage/);
});

test('A04-11: calendar adapter never authorizes DEV event results',()=>{
 const adapter=globalThis.faWorldClockAdapter;
 const snapshot={source:{kind:'dev',reference:'fictional DEV clock'},current:{season:1,day:17}};
 const normalized=adapter.normalize(snapshot);
 assert.equal(normalized.eventStates.length,0);
 for(const unauthorized of [
  {...snapshot,eventStates:[{eventId:'ghost',competitionId:'int-1',status:'completed'}]},
  {...snapshot,eventStates:[{eventId:'ghost',competitionId:'int-1',status:'scheduled'}]}
 ])assert.throws(()=>adapter.normalize(unauthorized));
});

test('A04-11: DEV clock Season 0 cannot authorize progress or generate published results',()=>{
 const state=new Map();
 const storage={getItem:key=>state.get(key)??null,setItem:(key,value)=>state.set(key,String(value)),removeItem:key=>state.delete(key)};
 const events=[];
 const clock=createDevWorldClock(storage,(name,detail)=>events.push({name,detail}));
 assert.equal(clock.commit({season:0,day:33}),true);
 assert.equal(clock.read().season,0);
 assert.equal(clock.read().day,1);
 assert.equal(clock.snapshot(),null);
 assert.equal(clock.nationalProgress(),0);
 assert.equal(clock.setDay(17),false);
 assert.equal(events.find(e=>e.name==='fa:world-clock-snapshot')?.detail,null);
});
