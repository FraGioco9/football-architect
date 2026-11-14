// ME-PB-05 — timing and directional evidence is driven by Rapier event records,
// not reach candidates, fabricated touches or implied possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,FIXED_DT}
 from '../src/core.mjs';
import {createPlayerMovement,PLAYER_DT} from '../src/player-movement.mjs';
import {FOOT_CONTACT_VERSION,footProxyTransform,initialFootPositions}
 from '../src/player-foot-contact.mjs';
import {FOOT_CONTACT_TIMELINE_VERSION,createFootContactTimeline}
 from '../src/player-foot-contact-timeline.mjs';

const feet=initialFootPositions();
const empty=Object.freeze([]);
const event=(tick,started=empty,ended=empty,active=empty)=>({
 version:FOOT_CONTACT_VERSION,tick,started,ended,active
});
const ball=(x=-5.2,y=0,vx=4,vy=0)=>({
 position:{x,y,z:0.11},velocity:{x:vx,y:vy,z:0}
});
const ids=a=>a.map(x=>x.id);

test('ME-PB-05 baseline, single-tick and multi-tick durations use only consecutive Rapier transitions',()=>{
 const o=createFootContactTimeline(),zero=o.snapshot();
 assert.equal(zero.version,FOOT_CONTACT_TIMELINE_VERSION);
 assert.equal(zero.tick,0);
 assert.deepEqual(zero.onsets,[]);
 assert.deepEqual(zero.completed,[]);
 assert.deepEqual(zero.ongoing,[]);
 assert.ok(Object.isFrozen(zero)&&Object.isFrozen(zero.ongoing));
 const first=o.observe(event(1,['home-10'],[],['home-10']),ball(),feet);
 assert.deepEqual(ids(first.onsets),['home-10']);
 assert.equal(first.onsets[0].tick,1);
 assert.equal(first.onsets[0].geometry,'planar-centerline-projection');
 assert.ok(Math.abs(first.onsets[0].closingSpeedMps-4)<1e-12);
 assert.equal(first.onsets[0].separatingSpeedMps,0);
 assert.equal(first.onsets[0].tangentialSpeedMps,0);
 assert.deepEqual(first.completed,[]);
 assert.deepEqual(first.ongoing,[{id:'home-10',startTick:1,observedTicks:1,observedS:PLAYER_DT}]);
 assert.equal(first.simultaneous,false);
 const second=o.observe(event(2,[],[],['home-10']),ball(),feet);
 assert.deepEqual(second.onsets,[]);
 assert.deepEqual(second.completed,[]);
 assert.equal(second.ongoing[0].observedTicks,2);
 const third=o.observe(event(3,[],['home-10'],[]),ball(),feet);
 assert.deepEqual(third.ongoing,[]);
 assert.deepEqual(third.completed,[{id:'home-10',startTick:1,endTick:3,
  durationTicks:2,durationS:2*PLAYER_DT,kind:'multi-tick'}]);
 assert.equal(third.simultaneous,false);
 const restart=o.observe(event(4,['home-10'],[],['home-10']),ball(),feet);
 assert.equal(restart.ongoing[0].startTick,4,'new collider event is a new physical episode');
 const finish=o.observe(event(5,[],['home-10'],[]),ball(),feet);
 assert.equal(finish.completed[0].kind,'single-tick');
 assert.equal(finish.completed[0].durationTicks,1);
 assert.ok(Object.isFrozen(finish.completed[0]));
});

test('ME-PB-05 simultaneous Home/Away event evidence remains ambiguous, never ownership',()=>{
 // Synthetic event sequences test observer logic, NOT a fabricated Rapier fixture.
 const o=createFootContactTimeline();
 const concurrent=o.observe(event(1,['home-10','away-10'],[],
  ['home-10','away-10']),ball(),feet);
 assert.equal(concurrent.simultaneous,true);
 assert.deepEqual(ids(concurrent.onsets),['home-10','away-10']);
 assert.deepEqual(ids(concurrent.ongoing),['home-10','away-10']);
 assert.equal(Object.hasOwn(concurrent,'possessor'),false);
 assert.equal(Object.hasOwn(concurrent,'touch'),false);
 assert.equal(Object.hasOwn(concurrent,'contactOwner'),false);
 assert.deepEqual(concurrent.ongoing.map(x=>x.observedTicks),[1,1]);
 const half=o.observe(event(2,[],['home-10'],['away-10']),ball(),feet);
 assert.equal(half.simultaneous,false);
 assert.equal(half.completed[0].id,'home-10');
 assert.equal(half.completed[0].durationTicks,1);
 assert.equal(half.ongoing[0].id,'away-10');
 assert.equal(half.ongoing[0].observedTicks,2);
 const last=o.observe(event(3,[],['away-10'],[]),ball(),feet);
 assert.equal(last.completed[0].id,'away-10');
 assert.equal(last.completed[0].durationTicks,2);
 assert.deepEqual(last.ongoing,[]);
});

test('ME-PB-05 a begin/end within the same tick has ZERO observed complete solver ticks',()=>{
 const o=createFootContactTimeline();
 const s=o.observe(event(1,['home-10'],['home-10'],[]),ball(),feet);
 assert.deepEqual(s.ongoing,[]);
 assert.equal(s.onsets.length,1);
 assert.deepEqual(s.completed,[{id:'home-10',startTick:1,endTick:1,
  durationTicks:0,durationS:0,kind:'zero-sample'}]);
});

test('ME-PB-05 planar radial closing, separating, lateral and undefined directions reflect relative velocity',()=>{
 const home=o=>o.onsets[0];
 const make=(pre,next=feet,id='home-10')=>
  createFootContactTimeline().observe(event(1,[id],[],[id]),pre,next);
 const closing=home(make(ball(-5.2,0,4,0)));
 assert.ok(Math.abs(closing.closingSpeedMps-4)<1e-12);
 const receding=home(make(ball(-5.2,0,-4,0)));
 assert.ok(Math.abs(receding.separatingSpeedMps-4)<1e-12);
 assert.equal(receding.closingSpeedMps,0);
 const lateral=home(make(ball(-5.2,0,0,3)));
 assert.ok(Math.abs(lateral.tangentialSpeedMps-3)<1e-12);
 assert.equal(lateral.closingSpeedMps,0);
 const moved=feet.map((f,i)=>i===9?{...f,x:f.x+0.02}:f);
 const physical=home(make(ball(-5.2,0,4,0),moved));
 assert.ok(Math.abs(physical.closingSpeedMps-(4-0.02/PLAYER_DT))<1e-10);
 const away=make(ball(5.2,0,-4,0),feet,'away-10');
 assert.ok(Math.abs(away.onsets[0].closingSpeedMps-4)<1e-12);
 assert.equal(away.onsets[0].id,'away-10');
 const foot=footProxyTransform(feet[9]);
 const undefinedNormal=home(make(ball(foot.x,foot.y,4,0)));
 assert.equal(undefinedNormal.geometry,'indeterminate');
 assert.equal(undefinedNormal.closingSpeedMps,null);
 assert.equal(undefinedNormal.tangentialSpeedMps,null);
 assert.equal(undefinedNormal.relativeSpeedMps,4);
});

test('ME-PB-05 all malformed event frames fail atomically with no false timeline advance',()=>{
 const o=createFootContactTimeline(),before=o.snapshot();
 const wrong=[
  [event(2,['home-10'],[],['home-10']),ball(),feet,/Consecutive/],
  [event(1,['home-10','home-10'],[],['home-10']),ball(),feet,/ordered unique/],
  [event(1,['away-10','home-10'],[],['away-10','home-10']),ball(),feet,/ordered unique/],
  [event(1,['fake-99'],[],['fake-99']),ball(),feet,/ordered unique/],
  [event(1,[],['home-10'],[]),ball(),feet,/without matching start/],
  [event(1,['home-10'],[],[]),ball(),feet,/do not reconcile/],
  [event(1,['home-10'],[],['home-10']),ball(0,0,Infinity),feet,/finite/],
  [event(1,['home-10'],[],['home-10']),ball(),feet.slice(0,21),/22-foot/]
 ];
 for(const [e,b,f,msg] of wrong){
  assert.throws(()=>o.observe(e,b,f),msg);
  assert.deepEqual(o.snapshot(),before);
 }
 const live=o.observe(event(1,['home-10'],[],['home-10']),ball(),feet);
 assert.throws(()=>o.observe(event(2,['home-10'],[],['home-10']),ball(),feet),
  /Duplicate Rapier start/);
 assert.throws(()=>o.observe(event(2,[],[],[]),ball(),feet),/do not reconcile/);
 assert.throws(()=>o.observe(event(1,[],[],['home-10']),ball(),feet),/Consecutive/);
 assert.deepEqual(o.snapshot(),live);
 assert.equal(o.observe(event(2,[],['home-10'],[]),ball(),feet).tick,2);
});

test('ME-PB-05 real 60Hz Rapier trials preserve physics and exact independent contact timeline replay',async()=>{
 const RAPIER=await initializeRapier(rapierModule);
 const scenario={preset:'roll',seed:'pb05-real-evidence',x:-6,y:0,z:0,vx:4,vy:0,vz:0};
 const trial=()=>{
  const engine=createEngine(RAPIER,scenario,{diagnosticPlayerFootContactsEnabled:true});
  const motion=createPlayerMovement(),trajectory=[],timeline=[],completed=[];
  try{
   const zero=engine.footContactTimelineSnapshot();
   assert.equal(zero.tick,0);
   assert.deepEqual(zero.ongoing,[]);
   for(let tick=1;tick<=150;tick++){
    const players=motion.step(engine.snapshot().ball.position);
    const result=engine.step(players);
    const evidence=engine.footContactTimelineSnapshot();
    const contact=engine.footContactSnapshot();
    assert.equal(result.tick,tick);
    assert.equal(evidence.tick,tick);
    assert.equal(contact.tick,tick);
    assert.deepEqual(ids(evidence.onsets),contact.started);
    assert.deepEqual(ids(evidence.completed),contact.ended);
    assert.deepEqual(ids(evidence.ongoing),contact.active);
    for(const onset of evidence.onsets){
     assert.ok(Number.isFinite(onset.relativeSpeedMps));
     if(onset.geometry==='planar-centerline-projection'){
      assert.ok(Number.isFinite(onset.closingSpeedMps));
      assert.ok(Number.isFinite(onset.tangentialSpeedMps));
     }
    }
    for(const episode of evidence.completed){
     assert.ok(episode.durationTicks>=0);
     assert.ok(Math.abs(episode.durationS-episode.durationTicks*FIXED_DT)<1e-9);
     completed.push(episode);
    }
    assert.ok(Object.isFrozen(evidence)&&Object.isFrozen(evidence.ongoing));
    assert.equal(Object.hasOwn(evidence,'possessor'),false);
    trajectory.push(canonicalSnapshot(result));
    timeline.push(evidence);
   }
   return {trajectory,timeline,completed};
  }finally{engine.dispose();}
 };
 const one=trial(),again=trial();
 assert.deepEqual(one.trajectory,again.trajectory);
 assert.deepEqual(one.timeline,again.timeline);
 assert.ok(one.timeline.some(x=>x.onsets.some(e=>e.id==='home-10')),
  'real Rapier event must actually start for Home forward');
 const real=one.timeline.find(x=>x.onsets.some(e=>e.id==='home-10'));
 const home=real.onsets.find(x=>x.id==='home-10');
 assert.ok(home.relativeSpeedMps>=0);
 process.stdout.write('ME_PB_05_REAL '+JSON.stringify({
  firstRealHomeContactTick:real.tick,firstRealHomeContactClosingMps:home.closingSpeedMps,
  completedEpisodes:one.completed.length,
  maxSimultaneous:Math.max(...one.timeline.map(x=>x.ongoing.length)),
  exactReplay:true
 })+'\n');
});
