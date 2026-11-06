import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/world-clock-adapter.js';
import {createDevWorldClock} from '../tools/dev-world-clock.mjs';
const api=globalThis.faWorldClockAdapter;
const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:2,seasonNumber:2,day:14,phase:'active'};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
test('canonical validation preserves real Season 0 and rejects inconsistent phases',()=>{
 assert.equal(typeof api.validPublicWorld,'function');
 assert.equal(api.validPublicWorld({...world,revision:0,seasonNumber:0,day:0,phase:'unstarted'}),true);
 for(const patch of [{day:0},{seasonNumber:0},{day:55,phase:'closed'},{revision:-1},{phase:'preparing',day:1}])assert.equal(api.validPublicWorld({...world,...patch}),false);
});
test('viewed season is not current world and source round trips invalidate leases',()=>{
 assert.equal(typeof api.createWorldState,'function');
 const state=api.createWorldState();
 const ticket=state.beginRead();assert.equal(state.acceptWorld(world,ticket),true);
 assert.equal(state.get().current.season,2);
 state.setSource({kind:'dev',current:{season:0,day:0}});
 assert.equal(state.get().current.season,0);assert.equal(state.get().world,null);
 state.setSource({kind:'authoritative'});
 assert.equal(state.acceptWorld({...world,day:15},ticket),false);
 assert.equal(state.get().current,null);
 assert.equal(state.acceptWorld(world,state.beginRead()),true);
 assert.ok(Object.isFrozen(state.get().world));
});
test('newer accepted world cannot be overwritten by an older read, including generation reset',()=>{
 const state=api.createWorldState(),old=state.beginRead(),latest=state.beginRead();
 const reset={...world,generation:'12345678-1234-4123-8123-123456789abc',revision:0,seasonNumber:0,day:0,phase:'unstarted'};
 assert.equal(state.acceptWorld(reset,latest),true);
 assert.equal(state.acceptWorld(world,old),false);
 assert.equal(state.get().world.generation,reset.generation);
 assert.equal(state.acceptWorld({...reset,day:7},state.beginRead()),false);
});
test('guarded read rejects a delayed selection and a changed world without committing',async()=>{
 assert.equal(typeof api.createSnapshotReader,'function');
 let identity='IT-1:1',committed=[];const held=deferred(),started=deferred();
 const reader=api.createSnapshotReader({getIdentity:()=>identity,isEnabled:()=>true,clear:()=>{},onState:()=>{},
  fetchWorld:async()=>world,read:async()=>{started.resolve();return held.promise},validate:x=>x,commit:x=>{committed.push(x);return true}});
 const pending=reader.load();await started.promise;identity='int-1:2';held.resolve({world});
 assert.equal(await pending,false);assert.deepEqual(committed,[]);
 let n=0;
 const changed=api.createSnapshotReader({getIdentity:()=>identity,isEnabled:()=>true,clear:()=>{},fetchWorld:async()=>({...world,revision:++n}),read:async()=>({world:{...world,revision:1}}),validate:x=>x,commit:()=>{throw Error('must not commit')}});
 assert.equal(await changed.load(),false);
});
test('guarded read publishes only coherent data and cancellation releases no stale status',async()=>{
 const held=deferred(),started=deferred(),statuses=[];let committed=0;
 const reader=api.createSnapshotReader({getIdentity:()=>1,isEnabled:()=>true,clear:()=>{},fetchWorld:async()=>world,read:async()=>{started.resolve();return held.promise},validate:x=>x,commit:()=>{committed++;return true},onState:s=>statuses.push(s)});
 const pending=reader.load();await started.promise;reader.cancel();held.resolve({world,status:'partial'});await pending;
 assert.equal(committed,0);assert.deepEqual(statuses,['loading']);
 const accepted=api.createSnapshotReader({getIdentity:()=>1,isEnabled:()=>true,clear:()=>{},fetchWorld:async()=>world,read:async()=>({world,status:'empty',data:null}),validate:x=>x,commit:x=>{assert.equal(x.data,null);committed++;return true}});
 assert.equal(await accepted.load(),true);assert.equal(committed,1);
});
test('Debug reset retains isolated Season 0 across reload instead of defaulting to Season 1',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const clock=createDevWorldClock(storage);clock.setSeason(3);clock.setDay(45);clock.reset();
 assert.equal(clock.read().season,0);assert.equal(clock.snapshot(),null);
 assert.equal(createDevWorldClock(storage).read().season,0);
});
test('a source round trip during a request cannot commit old API data',async()=>{
 const state=api.createWorldState(),held=deferred(),started=deferred();let commits=0;
 const reader=api.createSnapshotReader({getIdentity:()=>1,getSource:()=>state.get(),clear:()=>{},fetchWorld:async()=>world,
  read:async()=>{started.resolve();return held.promise},validate:x=>x,commit:()=>{commits++;return true}});
 const pending=reader.load();await started.promise;
 state.setSource({kind:'dev',current:{season:1,day:1}});state.setSource({kind:'authoritative'});
 held.resolve({world,status:'empty'});assert.equal(await pending,false);assert.equal(commits,0);
});
test('an accepted global reset or newer revision invalidates an older coherent sporting read',async()=>{
 for(const newer of [{...world,revision:5},{...world,generation:'12345678-1234-4123-8123-123456789abc',revision:0,seasonNumber:0,day:0,phase:'unstarted'}]){
  const state=api.createWorldState(),held=deferred(),started=deferred();let committed=0;
  const reader=api.createSnapshotReader({worldState:state,getIdentity:()=>1,clear:()=>{},fetchWorld:async()=>world,
   read:async()=>{started.resolve();return held.promise},validate:x=>x,commit:()=>{committed++;return true}});
  const pending=reader.load();await started.promise;state.acceptWorld(newer,state.beginRead());held.resolve({world,status:'partial'});
  assert.equal(await pending,false);assert.equal(committed,0);assert.deepEqual(state.get().world,newer);
 }
});
test('protected shell switches OFF to real API and ON to isolated Season 0 without losing Debug progress',async()=>{
 const previous=globalThis.sessionStorage,values=new Map([['football-architect:standings-dev-season','0']]);
 globalThis.sessionStorage={getItem:k=>values.get(k)??null};
 try{
  const state=api.createWorldState(),events={};let calls=0;
  const window={faWorldState:state,faDevPreviewMode:true,faDebugEnabled:true,addEventListener:(n,fn)=>events[n]=fn,fetch:async()=>{calls++;return {ok:true,json:async()=>({world})}}};
  api.mountWorldState({window,document:{documentElement:{dataset:{}}}});
  assert.deepEqual(state.get().current,{season:0,day:0});assert.equal(calls,0);
  window.faDebugEnabled=false;await events['fa:source-change']();assert.equal(state.get().source,'authoritative');assert.deepEqual(state.get().current,{season:2,day:14});
  window.faDebugEnabled=true;await events['fa:source-change']();assert.equal(state.get().source,'dev');assert.deepEqual(state.get().current,{season:0,day:0});
  assert.equal(values.get('football-architect:standings-dev-season'),'0');
 }finally{if(previous===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=previous}
});
test('focus is passive while explicit invalidation and tab visibility revalidate safely',async()=>{
 const state=api.createWorldState(),events={},docEvents={};
 let calls=0;
 const window={faWorldState:state,addEventListener:(n,fn)=>events[n]=fn,
  fetch:async()=>{calls++;return {ok:true,json:async()=>({world})}}};
 const document={documentElement:{dataset:{}},visibilityState:'visible',addEventListener:(n,fn)=>docEvents[n]=fn};
 api.mountWorldState({window,document});
 await events['fa:world-invalidated']();
 assert.equal(events.focus,undefined,'focus must not trigger an unnecessary world poll');
 const before=calls;
 document.visibilityState='hidden';docEvents.visibilitychange();
 assert.equal(calls,before,'hidden page cannot revalidate');
 const newer={...world,revision:9,day:21};state.acceptWorld(newer,state.beginRead());
 document.visibilityState='visible';docEvents.visibilitychange();
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(calls>before,'real browser-tab reactivation revalidates');
 assert.deepEqual(state.get().world,newer,'older world cannot erase accepted revision');
});
test('browser populated fixtures satisfy real authoritative validators before browser execution',async()=>{
 const {published,calendarPublished}=await import('./canonical-state-browser.mjs');
 const {readFileSync}=await import('node:fs');
 const manifest=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url),'utf8'));
 const {validateAuthoritativeSeason}=await import('../assets/authoritative-season.mjs');
 const {validateCalendarDay}=await import('../assets/authoritative-calendar.mjs');
 const context={definition:manifest.competitions.find(c=>c.id==='IT-1'),selectedSeason:2};
 assert.equal(validateAuthoritativeSeason(published('IT-1',2,world),context,manifest).data.fixtures.length,240);
 assert.equal(validateCalendarDay(calendarPublished(2,13,world),{season:2,day:13},manifest).data.fixtures.length,128);
});
test('disabled calendar clears once even when world notification re-enters selection handling',async()=>{
 const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
 const source=readFileSync(new URL('../assets/authoritative-calendar.mjs',import.meta.url),'utf8');
 const snippet=source.slice(source.indexOf(' const reload=event=>'),source.indexOf(" window.addEventListener('fa:calendar-selection-change'"));
 let reload,cancels=0,clears=0;
 const scope={isEnabled:()=>false,disabledCleared:false,loader:{cancel(){cancels++}},payload:null,selectionKey:'',loadedSelection:'',render(){},onWorld(){clears++;reload()},getSelection:()=>({season:1,day:1})};
 reload=runInNewContext(snippet+';reload',scope);
 assert.doesNotThrow(()=>reload());reload();assert.equal(cancels,1);assert.equal(clears,1);
});
test('a stalled API snapshot reaches unavailable within the client deadline',async()=>{
 const states=[];
 const reader=api.createSnapshotReader({timeoutMs:10,getIdentity:()=>1,clear:()=>{},fetchWorld:({signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true})),read:async()=>{throw Error('must not read sport data')},validate:x=>x,commit:()=>{throw Error('must not commit')},onState:s=>states.push(s)});
 assert.equal(await reader.load(),false);assert.deepEqual(states,['loading','unavailable']);
});
test('the shared header shows canonical current progress rather than a historical URL or stale no-season label',async()=>{
 const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
 const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8'),start=source.indexOf('  function renderWorldProgress() {'),end=source.indexOf('  function activeView()',start);
 assert.ok(start>=0&&end>start);
 for(const [lang,seasonLabel,dayLabel] of [['en','Season','Day'],['de','Saison','Tag'],['es','Temporada','Día'],['fr','Saison','Jour'],['it','Stagione','Giorno']]){
  const full={textContent:'stale'},short={textContent:'stale'};
  let snapshot={source:'authoritative',current:{season:2,day:21}};
  const paint=runInNewContext(source.slice(start,end)+';renderWorldProgress',{window:{faWorldState:{get:()=>snapshot}},copies:{[lang]:{historySeasonLabel:seasonLabel,noSeason:'inactive'}},language:()=>lang,document:{querySelectorAll:selector=>selector==='.fa-shell-date-full'?[full]:selector==='.fa-shell-date-short'?[short]:[]}});
  paint();assert.equal(full.textContent,seasonLabel+' 2 · '+dayLabel+' 21/56');assert.equal(short.textContent,'2 · 21/56');
  snapshot={source:'dev',current:{season:0,day:0}};paint();assert.equal(full.textContent,'Debug · inactive');
  snapshot={source:'authoritative',current:null};paint();assert.equal(full.textContent,'—');assert.equal(short.textContent,'—');
 }
});
test('a newly mounted shell consumes an already accepted world immediately',()=>{
 const state=api.createWorldState();state.acceptWorld(world,state.beginRead());const seen=[];
 const window={faWorldState:state,addEventListener(){},fetch:async()=>({ok:true,json:async()=>({world})})};
 api.mountWorldState({window,document:{documentElement:{dataset:{}}},onChange:()=>seen.push(state.get().current)});
 assert.deepEqual(seen[0],{season:2,day:14});
});
