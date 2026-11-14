// ME-PB-08: classify real Rapier collision episode evidence, never a touch/owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {FOOT_CONTACT_TIMELINE_VERSION} from '../src/player-foot-contact-timeline.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from '../src/player-foot-contact-solver.mjs';
import {FOOT_MOMENTUM_AUDIT_VERSION} from '../src/player-foot-contact-momentum.mjs';
import {FOOT_CONTACT_QUALIFICATION_VERSION,FOOT_REPEAT_WINDOW_TICKS,
 createFootContactQualification} from '../src/player-foot-contact-qualification.mjs';
import {initializeRapier,createEngine,canonicalSnapshot}
 from '../src/core.mjs';
import {createPlayerMovement} from '../src/player-movement.mjs';

const canonical=INITIAL_PLAYERS.map(p=>p.id);
const order=list=>canonical.filter(id=>list.includes(id));
const empty=[];
function frame(tick,{starts=[],ends={},active={},forces=[]}={}){
 starts=order(starts);forces=order(forces);
 const endIds=order(Object.keys(ends)),activeIds=order(Object.keys(active));
 const participants=order([...starts,...endIds,...activeIds,...forces]);
 const timeline={
  version:FOOT_CONTACT_TIMELINE_VERSION,tick,
  onsets:starts.map(id=>({id,tick,relativeSpeedMps:2})),
  completed:endIds.map(id=>({
   id,startTick:ends[id],endTick:tick,durationTicks:tick-ends[id],
   kind:tick===ends[id]?'zero-sample':tick-ends[id]===1?'single-tick':'multi-tick'
  })),
  ongoing:activeIds.map(id=>({
   id,startTick:active[id],observedTicks:tick-active[id]+1
  })),
  simultaneous:activeIds.length>=2
 };
 const solver={
  version:FOOT_SOLVER_EVIDENCE_VERSION,tick,
  pairs:participants.map(id=>({
   id,beganThisTick:starts.includes(id),endedThisTick:endIds.includes(id),
   collisionActive:activeIds.includes(id),rapierForceReported:forces.includes(id)
  })),
  reportedForcePairs:forces.length,simultaneousSolverPairs:forces.length>=2
 };
 const momentum={
  version:FOOT_MOMENTUM_AUDIT_VERSION,tick,
  pairs:participants.map(id=>({
   id,rapierForceReported:forces.includes(id),
   pairImpulseMagnitudeNs:forces.includes(id)?0.1:null
  })),reportedFootPairCount:forces.length,
  attribution:'unresolved',exclusiveFootMomentumTransferProven:false
 };
 return [timeline,solver,momentum];
}
function observe(observer,tick,args){return observer.observe(...frame(tick,args));}

test('ME-PB-08 baseline and isolated real-event labels require no inferred force or ownership',()=>{
 const o=createFootContactQualification(),zero=o.snapshot();
 assert.equal(zero.version,FOOT_CONTACT_QUALIFICATION_VERSION);
 assert.equal(zero.tick,0);assert.equal(zero.category,'none');
 assert.equal(FOOT_REPEAT_WINDOW_TICKS,12);
 const a=observe(o,1,{starts:['home-10'],active:{'home-10':1}});
 assert.equal(a.category,'single-pair-event');
 assert.deepEqual(a.onsets,[{
  id:'home-10',tick:1,occurrence:'isolated',
  previousEndTick:null,rapierForceReported:false
 }]);
 assert.deepEqual(a.unreportedOnsetForceIds,['home-10']);
 assert.deepEqual(a.forceReportedIds,[]);
 assert.equal(a.attribution,'unresolved');
 assert.equal(a.possessionInferred,false);
 assert.equal(Object.hasOwn(a,'owner'),false);
 assert.equal(Object.hasOwn(a,'touch'),false);
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.onsets)&&
  Object.isFrozen(a.onsets[0])&&Object.isFrozen(a.ambiguityReasons));
 assert.equal(observe(o,2,{active:{'home-10':1}}).category,'single-pair-event');
 const end=observe(o,3,{ends:{'home-10':1}});
 assert.equal(end.category,'single-pair-event');
 assert.deepEqual(end.completions,[{
  id:'home-10',startTick:1,endTick:3,durationTicks:2,kind:'multi-tick'
 }]);
 assert.equal(observe(o,4).category,'none');
});

test('ME-PB-08 actual repeated collision onset inside 12 ticks and expiry after 12 ticks',()=>{
 const o=createFootContactQualification();
 observe(o,1,{starts:['away-10'],active:{'away-10':1},forces:['away-10']});
 observe(o,2,{ends:{'away-10':1}});
 observe(o,3);
 const repeat=observe(o,4,{starts:['away-10'],active:{'away-10':4}});
 assert.equal(repeat.category,'repeated-event');
 assert.deepEqual(repeat.onsets,[{
  id:'away-10',tick:4,occurrence:'repeat-within-window',
  previousEndTick:2,rapierForceReported:false
 }]);
 observe(o,5,{ends:{'away-10':4}});
 for(let tick=6;tick<=17;tick++)observe(o,tick);
 const boundary=observe(o,18,{starts:['away-10'],active:{'away-10':18}});
 assert.equal(boundary.category,'single-pair-event');
 assert.equal(boundary.onsets[0].previousEndTick,null,
  'last end was 13 ticks ago, so this is not a repeat within window');
 assert.equal(boundary.onsets[0].occurrence,'isolated');
});

test('ME-PB-08 true multi-pair evidence is ambiguous even if only one pair has force',()=>{
 const o=createFootContactQualification();
 const sample=observe(o,1,{
  starts:['home-10','away-10'],
  active:{'home-10':1,'away-10':1},forces:['away-10']
 });
 assert.equal(sample.category,'multi-pair-ambiguous');
 assert.deepEqual(sample.activeIds,['home-10','away-10']);
 assert.deepEqual(sample.forceReportedIds,['away-10']);
 assert.deepEqual(sample.unreportedOnsetForceIds,['home-10']);
 assert.deepEqual(sample.ambiguityReasons,
  ['multiple-active-pairs','multiple-onsets-same-tick']);
 assert.equal(sample.attribution,'unresolved');
 const next=observe(o,2,{
  active:{'home-10':1,'away-10':1},forces:['home-10','away-10']
 });
 assert.equal(next.category,'multi-pair-ambiguous');
 assert.deepEqual(next.ambiguityReasons,
  ['multiple-active-pairs','multiple-solver-force-pairs']);
 const end=observe(o,3,{ends:{'home-10':1,'away-10':1}});
 assert.deepEqual(end.completions.map(x=>x.id),['home-10','away-10']);
 assert.equal(end.category,'multi-pair-ambiguous');
 assert.deepEqual(end.ambiguityReasons,['multiple-completions-same-tick']);
});

test('ME-PB-08 zero-duration same-tick pair remains uncertain; no false active tick',()=>{
 const o=createFootContactQualification();
 const out=observe(o,1,{starts:['home-10'],ends:{'home-10':1}});
 assert.equal(out.category,'zero-sample-uncertain');
 assert.deepEqual(out.activeIds,[]);
 assert.equal(out.completions[0].durationTicks,0);
 assert.equal(out.completions[0].kind,'zero-sample');
 assert.equal(out.possessionInferred,false);
 const repeated=observe(o,2,{starts:['home-10'],active:{'home-10':2}});
 assert.equal(repeated.category,'repeated-event');
 assert.equal(repeated.onsets[0].previousEndTick,1);
});

test('ME-PB-08 frame validation is atomic across malformed timeline, force and momentum',()=>{
 const o=createFootContactQualification(),initial=o.snapshot();
 const good=frame(1,{starts:['home-10'],active:{'home-10':1},forces:['home-10']});
 const wrong=[
  [frame(2)[0],frame(2)[1],frame(2)[2]],
  [{...good[0],simultaneous:true},good[1],good[2]],
  [{...good[0],onsets:[...good[0].onsets,...good[0].onsets]},good[1],good[2]],
  [good[0],{...good[1],reportedForcePairs:0},good[2]],
  [good[0],{...good[1],pairs:[{...good[1].pairs[0],beganThisTick:false}]},good[2]],
  [good[0],good[1],{...good[2],attribution:'home-10'}],
  [good[0],good[1],{...good[2],pairs:[{...good[2].pairs[0],pairImpulseMagnitudeNs:null}]}],
  [good[0],good[1],{...good[2],tick:2}]
 ];
 for(const args of wrong){
  assert.throws(()=>o.observe(...args));
  assert.deepEqual(o.snapshot(),initial,'invalid input cannot advance history');
 }
 const one=o.observe(...good);
 assert.equal(one.tick,1);
 assert.throws(()=>o.observe(...good),/Consecutive/);
 assert.deepEqual(o.snapshot(),one);
 observe(o,2,{ends:{'home-10':1}});
});

const RAPIER=await initializeRapier(rapierModule);
function replay(scenario,ticks,contacts=true){
 const engine=createEngine(RAPIER,scenario,{diagnosticPlayerFootContactsEnabled:contacts});
 const mover=contacts?createPlayerMovement():null;
 const series=[],ball=[],solver=[];
 try{
  if(contacts){
   assert.equal(engine.footContactQualificationSnapshot().tick,0);
   assert.equal(engine.footContactQualificationSnapshot().category,'none');
  }else assert.equal(engine.footContactQualificationSnapshot,undefined);
  for(let tick=1;tick<=ticks;tick++){
   const previous=engine.snapshot();
   const step=contacts?engine.step(mover.step(previous.ball.position)):engine.step();
   ball.push(canonicalSnapshot(step));
   if(!contacts)continue;
   const qual=engine.footContactQualificationSnapshot();
   const timeline=engine.footContactTimelineSnapshot();
   const force=engine.footContactSolverSnapshot();
   assert.equal(qual.tick,tick);
   assert.deepEqual(qual.activeIds,timeline.ongoing.map(x=>x.id));
   assert.equal(qual.forceReportedIds.length,force.reportedForcePairs);
   assert.deepEqual(qual.completions.map(x=>x.id),timeline.completed.map(x=>x.id));
   assert.equal(qual.possessionInferred,false);
   assert.equal(qual.attribution,'unresolved');
   assert.ok(Object.isFrozen(qual));
   series.push(qual);
   solver.push(force);
  }
  return {series,ball,solver};
 }finally{engine.dispose();}
}
test('ME-PB-08 actual 180-tick Rapier event classification exactly replays with no physics mutation',()=>{
 const input={preset:'roll',seed:'pb08-real',x:-6,y:0,z:0,vx:4,vy:0,vz:0};
 const a=replay(input,180),b=replay(input,180);
 assert.deepEqual(a.ball,b.ball);
 assert.deepEqual(a.solver,b.solver);
 assert.deepEqual(a.series,b.series);
 const first=a.series.find(s=>s.onsets.some(x=>x.id==='home-10'));
 assert.ok(first,'real ball must produce actual Rapier Home #10 collision');
 assert.equal(first.onsets.find(x=>x.id==='home-10').occurrence,'isolated');
 assert.ok(a.series.some(s=>s.completions.length>0));
 process.stdout.write('ME_PB_08_QUALIFICATION '+JSON.stringify({
  firstContactTick:first.tick,initialClassification:first.category,
  completedEpisodes:a.series.reduce((n,s)=>n+s.completions.length,0),
  repeatedObserved:a.series.filter(s=>s.category==='repeated-event').length,
  ambiguousObserved:a.series.filter(s=>s.category==='multi-pair-ambiguous').length,
  exactReplay:true,attribution:first.attribution
 })+'\n');
});
test('ME-PB-08 negative airborne and distant controls never fabricate classified contacts',()=>{
 for(const [scenario,ticks] of [
  [{preset:'launch',seed:'pb08-air',x:-4.8,y:0,z:4,vx:0,vy:0,vz:0},30],
  [{preset:'roll',seed:'pb08-far',x:0,y:0,z:0,vx:0,vy:0,vz:0},60]
 ]){
  const r=replay(scenario,ticks);
  assert.ok(r.series.every(s=>s.category==='none'&&
   s.onsets.length===0&&s.forceReportedIds.length===0));
  assert.deepEqual(r.series,replay(scenario,ticks).series);
 }
});
