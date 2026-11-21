import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCalendarDay,createCalendarLoader} from '../assets/authoritative-calendar.mjs';
const manifest=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url),'utf8'));
const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:1,seasonNumber:1,day:1,phase:'active'};
const empty=()=>({schemaVersion:1,providerId:'authoritative-world',scope:'calendar',selectedSeason:1,day:1,world,status:'empty',reason:'calendar-unpublished',provenance:{kind:'none',sourceRef:null,resultAuthority:null},data:null});
test('validates exact viewed season/day and rejects fake clock/source identities',()=>{
 assert.equal(validateCalendarDay(empty(),{season:1,day:1},manifest).data,null);
 for(const patch of [{selectedSeason:2},{day:2},{scope:'history'},{world:{...world,day:57}},{providerId:'dev-fictional'}])assert.throws(()=>validateCalendarDay({...empty(),...patch},{season:1,day:1},manifest));
});
test('does not commit a daily read after its selected day changes',async()=>{
 let selection={season:1,day:1},release,commits=0;const delayed=new Promise(resolve=>{release=resolve});
 const loader=createCalendarLoader({getSelection:()=>selection,clear:()=>{},commit:()=>{commits++},fetchJson:async path=>path==='/api/world'?{world}:delayed,manifest});
 const pending=loader.load();await Promise.resolve();await Promise.resolve();selection={season:1,day:2};release(empty());await pending;assert.equal(commits,0);
});
test('clears stale content and rejects a reset generation before committing day data',async()=>{
 let worldReads=0,clears=0,commits=0;
 const loader=createCalendarLoader({getSelection:()=>({season:1,day:1}),clear:()=>{clears++},commit:()=>{commits++},fetchJson:async path=>path==='/api/world'?{world:++worldReads===1?world:{...world,generation:'12345678-1234-4123-8123-123456789abc',revision:0,seasonNumber:0,day:0,phase:'unstarted'}}:empty(),manifest});
 await loader.load();assert.equal(clears,1);assert.equal(commits,0);
});
function published(day=1){
 const catalog=manifest.divisions.flatMap(d=>d.clubs);
 const competitions=manifest.competitions.map(def=>({id:def.id,rulesVersion:def.rules.version,clubIds:def.category==='domestic'?manifest.divisions.find(d=>d.id===def.id).clubs.map(c=>c.countryId+'-'+c.clubId):catalog.filter(c=>def.id==='int-1'?c.clubId>=1&&c.clubId<=3:c.clubId>=4&&c.clubId<=6).map(c=>c.countryId+'-'+c.clubId)}));
 const fixtures=day===13?manifest.divisions.flatMap(d=>Array.from({length:8},(_,i)=>{const h=d.clubs[i],a=d.clubs[15-i],home=h.countryId+'-'+h.clubId,away=a.countryId+'-'+a.clubId;return {id:`season:1:${d.id}:N01:${home}:${away}`,competitionId:d.id,day:13,marker:'N01',round:1,phaseId:'league',tieId:null,leg:null,neutral:false,homeClubId:home,awayClubId:away,result:null}})):[];
 return {...empty(),day,status:'partial',reason:null,provenance:{kind:'authoritative',resultAuthority:'temporary-lineup-v1',sourceRef:'world:'+world.generation+':season:1:'+'a'.repeat(64)},data:{season:1,day,calendarHash:'a'.repeat(64),rulesHash:'b'.repeat(64),competitions,fixtures}};
}
test('accepts canonical global future domestic fixtures and refuses missing/duplicate entries or future results',()=>{
 const raw=published(13);assert.equal(validateCalendarDay(raw,{season:1,day:13},manifest).data.fixtures.length,128);
 const changes=[r=>{r.data.fixtures.pop()},r=>{r.data.fixtures.push(r.data.fixtures[0])},r=>{r.data.competitions.pop()},r=>{r.data.fixtures[0].result={homeGoals:0,awayGoals:0,resolution:'regulation',extraTime:null,penalties:null,winnerClubId:null}},r=>{r.data.fixtures[0].marker='N02'}];
 for(const alter of changes){const value=published(13);alter(value);assert.throws(()=>validateCalendarDay(value,{season:1,day:13},manifest));}
});
test('loads a single daily source and commits only after a matching second world read',async()=>{
 const paths=[],committed=[];const loader=createCalendarLoader({getSelection:()=>({season:1,day:1}),clear:()=>{},commit:d=>committed.push(d),fetchJson:async path=>{paths.push(path);return path==='/api/world'?{world}:published()},manifest});
 assert.equal(await loader.load(),true);assert.equal(committed.length,1);
 assert.deepEqual(paths,['/api/world','/api/calendar/seasons/1/days/1','/api/world']);
});
test('validates archived Season1 scores against its closed state while actual world is Season2 day1',()=>{
 const value=published(13);value.world={...world,seasonNumber:2,day:1};value.status='available';value.data.seasonState={phase:'closed',day:56};
 for(const f of value.data.fixtures)f.result={homeGoals:0,awayGoals:0,resolution:'regulation',extraTime:null,penalties:null,winnerClubId:null};
 assert.equal(validateCalendarDay(value,{season:1,day:13},manifest).data.fixtures.length,128);
});


test('#734: shared Calendar clock saves the initial world GET and preserves the final fence',async()=>{
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url),adapter=require('../assets/world-clock-adapter.js');
 const state=adapter.createWorldState();assert.equal(state.acceptWorld(world,state.beginRead()),true);
 const paths=[],committed=[];
 const loader=createCalendarLoader({worldState:state,getSelection:()=>({season:1,day:1}),
  clear:()=>{},commit:value=>committed.push(value),manifest,
  fetchJson:async path=>{paths.push(path);return path==='/api/world'?{world}:published()}});
 assert.equal(await loader.load(),true);
 assert.equal(committed.length,1);
 assert.deepEqual(paths,['/api/calendar/seasons/1/days/1','/api/world']);
 loader.dispose();
});

test('#734: verified day cache reuses earlier dates with a fresh world fence',async()=>{
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url),adapter=require('../assets/world-clock-adapter.js');
 const state=adapter.createWorldState();state.acceptWorld(world,state.beginRead());
 const selection={season:1,day:1},paths=[],committed=[];
 const loader=createCalendarLoader({worldState:state,getSelection:()=>selection,
  clear:()=>{},commit:value=>committed.push(value.day),manifest,
  fetchJson:async path=>{paths.push(path);return path==='/api/world'?{world}:published(selection.day)}});
 assert.equal(await loader.load(),true);
 selection.day=2;assert.equal(await loader.load(),true);
 selection.day=1;assert.equal(await loader.load(),true);
 assert.deepEqual(committed,[1,2,1]);
 assert.deepEqual(paths,['/api/calendar/seasons/1/days/1','/api/world',
  '/api/calendar/seasons/1/days/2','/api/world','/api/world']);
 loader.dispose();
});

test('#734: Calendar deduplicates in-flight loads of the same selected day',async()=>{
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url),adapter=require('../assets/world-clock-adapter.js');
 const state=adapter.createWorldState();state.acceptWorld(world,state.beginRead());
 let release,reads=0;const delayed=new Promise(resolve=>release=resolve);
 const loader=createCalendarLoader({worldState:state,getSelection:()=>({season:1,day:1}),
  clear:()=>{},commit:()=>{},manifest,
  fetchJson:async path=>{if(path==='/api/world')return {world};reads++;return delayed}});
 const first=loader.load(),again=loader.load();
 assert.strictEqual(first,again,'two consumers share the same pending Calendar read');
 await Promise.resolve();await Promise.resolve();release(published());
 assert.equal(await first,true);assert.equal(reads,1);
 loader.dispose();
});

test('#734: revision changes and explicit invalidation discard cached days',async()=>{
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url),adapter=require('../assets/world-clock-adapter.js');
 const state=adapter.createWorldState();state.acceptWorld(world,state.beginRead());
 let currentWorld=world,dayReads=0;
 const loader=createCalendarLoader({worldState:state,getSelection:()=>({season:1,day:1}),
  clear:()=>{},commit:()=>{},manifest,
  fetchJson:async path=>{if(path==='/api/world')return {world:currentWorld};dayReads++;return {...published(),world:currentWorld}}});
 assert.equal(await loader.load(),true);
 assert.equal(await loader.load(),true);assert.equal(dayReads,1);
 currentWorld={...world,revision:2};
 assert.equal(state.acceptWorld(currentWorld,state.beginRead()),true);
 assert.equal(await loader.load(),true);assert.equal(dayReads,2);
 loader.clearCache();
 assert.equal(await loader.load(),true);assert.equal(dayReads,3);
 loader.dispose();
});

test('#734: a reset discovered after a cached day cannot commit stale fixtures',async()=>{
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url),adapter=require('../assets/world-clock-adapter.js');
 const state=adapter.createWorldState();state.acceptWorld(world,state.beginRead());
 let serverWorld=world,dayReads=0,commits=0;
 const loader=createCalendarLoader({worldState:state,getSelection:()=>({season:1,day:1}),
  clear:()=>{},commit:()=>{commits++},manifest,
  fetchJson:async path=>{if(path==='/api/world')return {world:serverWorld};dayReads++;return published()}});
 assert.equal(await loader.load(),true);assert.equal(commits,1);
 serverWorld={...world,generation:'12345678-1234-4123-8123-123456789abc',revision:0,seasonNumber:0,day:0,phase:'unstarted'};
 assert.equal(await loader.load(),false);
 assert.equal(dayReads,1,'the previous day was reused but still revalidated');
 assert.equal(commits,1,'the old day was never committed after reset');
 assert.equal(state.get().world.generation,serverWorld.generation,'shell learns the new world');
 loader.dispose();
});

test('#734: LRU remains bounded to sixteen days',async()=>{
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url),adapter=require('../assets/world-clock-adapter.js');
 const state=adapter.createWorldState();state.acceptWorld(world,state.beginRead());
 const selection={season:1,day:1},counts=new Map();
 const loader=createCalendarLoader({worldState:state,getSelection:()=>selection,
  clear:()=>{},commit:()=>{},manifest,
  fetchJson:async path=>{
   if(path==='/api/world')return {world};
   counts.set(selection.day,(counts.get(selection.day)||0)+1);
   return {...empty(),day:selection.day};
  }});
 for(let day=1;day<=18;day++){selection.day=day;assert.equal(await loader.load(),true)}
 selection.day=3;assert.equal(await loader.load(),true);
 assert.equal(counts.get(3),1,'recent cached day is retained');
 selection.day=1;assert.equal(await loader.load(),true);
 assert.equal(counts.get(1),2,'oldest entry was evicted');
 loader.dispose();
});
