import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const file=new URL('../assets/world-calendar-model.js',import.meta.url);
const getModel=()=>{
  assert.ok(existsSync(file),'CAL-IMP-01 requires the pure World Calendar model');
  return createRequire(import.meta.url)(file.pathname);
};
const copy=value=>JSON.parse(JSON.stringify(value));

test('QA-06 covers the entire 56-day cycle without counting transition as an active pause',()=>{
  const season=getModel().createSeason(1);
  assert.equal(season.model,'WORLD-TIME-QA-06');
  assert.equal(season.schemaVersion,1);
  assert.equal(season.days.length,56);
  assert.deepEqual(season.days.map(d=>d.day),Array.from({length:56},(_,i)=>i+1));
  assert.equal(season.days.filter(d=>d.events.length).length,39);
  assert.equal(season.days.flatMap(d=>d.events).length,47);
  assert.deepEqual(season.days.filter(d=>!d.events.length&&d.kind!=='transition').map(d=>d.day),
    [...Array.from({length:12},(_,i)=>i+1),32,33,51,55]);
  assert.ok(season.days.slice(0,12).every(d=>d.kind==='preseason'));
  assert.equal(season.days[55].kind,'transition');
  assert.ok([32,33,51,55].every(n=>season.days[n-1].kind==='pause'));
});

test('QA-06 fixes every national and international placement, including separate final pairings',()=>{
  const days=getModel().createSeason(1).days;
  const nationalDays=[13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,
    34,35,37,39,40,42,44,45,47,49,50,52,53,54];
  const internationalDays=[16,19,22,25,28,31,36,38,41,43,46,48];
  nationalDays.forEach((day,i)=>assert.ok(days[day-1].events.some(e=>e.marker==='N'+String(i+1).padStart(2,'0'))));
  internationalDays.forEach((day,i)=>assert.ok(days[day-1].events.some(e=>e.marker==='I'+String(i+1).padStart(2,'0'))));
  assert.deepEqual(days.filter(d=>d.pairing==='double').map(d=>d.day),[16,19,22,25,28,31]);
  assert.deepEqual(days.filter(d=>d.pairing==='final').map(d=>d.day),[53,54]);
  for(const d of days.filter(d=>d.events.length===2))assert.deepEqual(d.events.map(e=>e.family),['international','national']);
  assert.deepEqual(days[52].events.map(e=>e.marker),['FEDERATION-FINAL','N32']);
  assert.deepEqual(days[53].events.map(e=>e.marker),['SOVEREIGN-FINAL','N33']);
  assert.equal(days[51].events[0].phase,'postseason');
});

test('round markers preserve distinct competition identities without creating club fixtures',()=>{
  const events=getModel().createSeason(1).days.flatMap(d=>d.events);
  assert.equal(events.find(e=>e.marker==='N01').competitionIds.length,16);
  assert.deepEqual(events.find(e=>e.marker==='I01').competitionIds,['sovereign-cup','federation-cup']);
  assert.deepEqual(events.find(e=>e.marker==='FEDERATION-FINAL').competitionIds,['federation-cup']);
  assert.deepEqual(events.find(e=>e.marker==='SOVEREIGN-FINAL').competitionIds,['sovereign-cup']);
  assert.equal(events.find(e=>e.marker==='I07').phase,'playoffs');
  assert.equal(events.find(e=>e.marker==='I09').phase,'quarterfinals');
  assert.equal(events.find(e=>e.marker==='I11').phase,'semifinals');
  for(const e of events)for(const key of ['fixtures','score','result','kickoff','scheduledAt'])assert.equal(Object.hasOwn(e,key),false);
});

test('season/day/event identities are stable, season-qualified and deeply immutable',()=>{
  const m=getModel(),s=m.createSeason(3),again=m.createSeason(3),next=m.createSeason(4);
  assert.deepEqual(s,again);
  const ids=s.days.flatMap(d=>[d.id,...d.events.map(e=>e.id)]);
  assert.equal(new Set(ids).size,103);
  assert.ok(next.days.flatMap(d=>[d.id,...d.events.map(e=>e.id)]).every(id=>!ids.includes(id)));
  assert.ok(Object.isFrozen(s.days[15].events[0].competitionIds));
  assert.throws(()=>s.days[15].events[0].competitionIds.push('other'),TypeError);
  assert.throws(()=>s.days[0].day=100,TypeError);
});

test('default projection leaves time and lifecycle unknown instead of inventing a live world',()=>{
  const s=getModel().projectSeason(1);
  assert.deepEqual(s.source,{kind:'unavailable',reference:null});
  assert.ok(s.days.every(d=>d.relative===null));
  assert.ok(s.days.flatMap(d=>d.events).flatMap(e=>e.competitions).every(c=>c.status===null));
});

test('relative time is separate from lifecycle and each cup has its own supplied state',()=>{
  const m=getModel(),season=m.createSeason(1),eventId=season.days[15].events[0].id;
  const states=[{eventId,competitionId:'sovereign-cup',status:'completed'},
    {eventId,competitionId:'federation-cup',status:'scheduled'}];
  const input={source:{kind:'dev',reference:'test snapshot'},current:{season:1,day:17},eventStates:states};
  const before=copy(input),out=m.projectSeason(1,input);
  assert.deepEqual(input,before);
  assert.equal(out.days[15].relative,'past');
  assert.equal(out.days[16].relative,'current');
  assert.equal(out.days[17].relative,'future');
  assert.deepEqual(out.days[15].events[0].competitions.map(c=>c.status),['completed','scheduled']);
  assert.equal(out.days[15].events[1].competitions[0].status,null);
  assert.deepEqual(out.source,input.source);
  input.eventStates[0].status='live';
  assert.equal(out.days[15].events[0].competitions[0].status,'completed');
  assert.ok(Object.isFrozen(out.source));
  assert.ok(Object.isFrozen(out.days[15].events[0].competitions));
  assert.ok(!JSON.stringify(out).includes('homeGoals'));
});

test('historical projections do not infer completion or alter previous snapshots',()=>{
  const m=getModel(),a=m.projectSeason(1,{source:{kind:'authoritative',reference:'snapshot A'},current:{season:2,day:1}});
  const before=copy(a);
  assert.ok(a.days.every(d=>d.relative==='past'));
  assert.ok(a.days.flatMap(d=>d.events).flatMap(e=>e.competitions).every(c=>c.status===null));
  const b=m.projectSeason(3,{source:{kind:'authoritative',reference:'snapshot B'},current:{season:2,day:56}});
  assert.ok(b.days.every(d=>d.relative==='future'));
  assert.deepEqual(a,before);
  const c=m.projectSeason(2,{source:{kind:'dev',reference:'transition fixture'},current:{season:2,day:56}});
  assert.equal(c.days[55].relative,'current');
});

test('invalid season, clock, provenance and event states fail closed without partial projection',()=>{
  const m=getModel(),source={kind:'dev',reference:'test'},eventId=m.createSeason(1).days[15].events[0].id;
  for(const season of [0,-1,1.2,'1',null,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>m.createSeason(season));
  const invalid=[null,[],{source:null},{source:{kind:'live',reference:'test'}},{source:{kind:'dev',reference:''}},
    {source:{kind:'unavailable',reference:'pretend'}},{current:{season:1,day:1}},
    {source,current:{season:1,day:0}},{source,current:{season:1,day:57}},
    {source,current:{season:'1',day:1}},{source,eventStates:null},{source,eventStates:[null]},
    {source,eventStates:[{eventId:'missing',competitionId:'sovereign-cup',status:'live'}]},
    {source,eventStates:[{eventId,competitionId:'unknown-cup',status:'live'}]},
    {source,eventStates:[{eventId,competitionId:'sovereign-cup',status:'in_progress'}]},
    {source,eventStates:[{eventId,competitionId:'sovereign-cup',status:'live',homeGoals:3}]},
    {eventStates:[{eventId,competitionId:'sovereign-cup',status:'live'}]},
    {source,eventStates:Array(2).fill({eventId,competitionId:'sovereign-cup',status:'live'})}];
  for(const input of invalid)assert.throws(()=>m.projectSeason(1,input),JSON.stringify(input));
});

test('Node and browser contracts are equivalent and work with no clock, DOM, network or storage APIs',()=>{
  const m=getModel(),browser={};
  const blocked=()=>{throw Error('Side effects forbidden in CAL-IMP-01')};
  runInNewContext(readFileSync(file,'utf8'),{window:browser,Date:blocked,fetch:blocked,setTimeout:blocked,
    localStorage:new Proxy({}, {get:blocked}),indexedDB:new Proxy({}, {get:blocked})});
  assert.deepEqual(copy(browser.faWorldCalendarModel.createSeason(1)),copy(m.createSeason(1)));
  assert.deepEqual(copy(browser.faWorldCalendarModel.projectSeason(2)),copy(m.projectSeason(2)));
});
