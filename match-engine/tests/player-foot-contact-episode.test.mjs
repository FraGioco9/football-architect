// ME-PB-11: complete REAL Rapier contact episode force coverage vs ball Δp.
// Deliberately reports two independent physical quantities, never possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RAPIER_MODULE from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,ENGINE_VERSION,
 FIXED_DT,BALL_MASS_KG} from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {FOOT_CONTACT_TIMELINE_VERSION} from '../src/player-foot-contact-timeline.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from '../src/player-foot-contact-solver.mjs';
import {FOOT_DIRECTIONAL_RESPONSE_VERSION,measureFootDirectionalResponse}
 from '../src/player-foot-contact-direction.mjs';
import {FOOT_EPISODE_AUDIT_VERSION,createFootContactEpisodeAudit}
 from '../src/player-foot-contact-episode.mjs';

const ids=INITIAL_PLAYERS.map(p=>p.id);
const sorted=arr=>ids.filter(id=>arr.includes(id));
const m=BALL_MASS_KG;
const v=(x,y=0,z=0)=>({x,y,z});
const snap=(tick,velocity)=>({
 version:ENGINE_VERSION,tick,time:tick*FIXED_DT,ball:{velocity}
});
const close=(a,b,tolerance=1e-8)=>Math.abs(a-b)<=tolerance;
function frame(tick,velBefore,velAfter,{
 starts=[],ends={},active={},force={},occurrences={}
}={}){
 const born=sorted(starts),done=sorted(Object.keys(ends));
 const ongoing=sorted(Object.keys(active)),report=sorted(Object.keys(force));
 const pairIds=sorted([...born,...done,...ongoing,...report]);
 const before=snap(tick-1,velBefore),after=snap(tick,velAfter);
 const timeline={
  version:FOOT_CONTACT_TIMELINE_VERSION,tick,
  onsets:born.map(id=>({id,tick})),
  completed:done.map(id=>({
   id,startTick:ends[id],endTick:tick,durationTicks:tick-ends[id],
   kind:tick===ends[id]?'zero-sample':tick-ends[id]===1?'single-tick':'multi-tick'
  })),
  ongoing:ongoing.map(id=>({
   id,startTick:active[id],observedTicks:tick-active[id]+1
  }))
 };
 const solver={
  version:FOOT_SOLVER_EVIDENCE_VERSION,tick,
  pairs:pairIds.map(id=>({
   id,collisionActive:ongoing.includes(id),
   beganThisTick:born.includes(id),endedThisTick:done.includes(id),
   rapierForceReported:report.includes(id),
   derivedNetImpulseWorldNs:report.includes(id)?force[id]:null
  })),
  reportedForcePairs:report.length,simultaneousSolverPairs:report.length>=2
 };
 const d={
  version:FOOT_DIRECTIONAL_RESPONSE_VERSION,tick,
  incomingBallVelocityWorldMps:velBefore,outgoingBallVelocityWorldMps:velAfter,
  ballDeltaVelocityWorldMps:v(velAfter.x-velBefore.x,
    velAfter.y-velBefore.y,velAfter.z-velBefore.z),
  collisionOnsetCount:born.length,
  reportedForcePairCount:report.length,
  perPair:pairIds.map(id=>({
   id,collisionActive:ongoing.includes(id),
   beganThisTick:born.includes(id),endedThisTick:done.includes(id),
   onsetOccurrence:born.includes(id)?(occurrences[id]??'isolated'):null,
   rapierForceReported:report.includes(id),
   reportedPairNetImpulseMagnitudeNs:report.includes(id)?
    Math.hypot(force[id].x,force[id].y,force[id].z):null,
   solverManifoldCount:report.includes(id)?1:0
  })),
  attribution:'unresolved',possessionInferred:false,causalFootImpulseProven:false
 };
 return [before,after,timeline,solver,d,m];
}

test('ME-PB-11 aggregates actual pair-force event samples without equating them to whole-ball momentum',()=>{
 const ep=createFootContactEpisodeAudit();
 assert.equal(ep.snapshot().version,FOOT_EPISODE_AUDIT_VERSION);
 assert.deepEqual(ep.snapshot().openIds,[]);
 assert.equal(ep.observe(...frame(1,v(1),v(0.7),{
  starts:['home-10'],active:{'home-10':1},force:{'home-10':v(0.1)}
 })).completed.length,0);
 assert.deepEqual(ep.snapshot().openIds,['home-10']);
 ep.observe(...frame(2,v(0.7),v(0.2),{
  active:{'home-10':1},force:{'home-10':v(0.2)}
 }));
 const ending=ep.observe(...frame(3,v(0.2),v(-1),{
  ends:{'home-10':1}
 }));
 assert.deepEqual(ending.openIds,[]);
 assert.equal(ending.completed.length,1);
 const c=ending.completed[0];
 assert.equal(c.id,'home-10');
 assert.equal(c.startTick,1);
 assert.equal(c.endTick,3);
 assert.equal(c.durationTicks,2);
 assert.equal(c.kind,'multi-tick');
 assert.equal(c.sampledTickCount,3);
 assert.equal(c.reportedForceTickCount,2);
 assert.equal(c.unreportedForceTickCount,1);
 assert.equal(c.completeReportedForceCoverage,false);
 assert.equal(c.solverManifoldSamples,2);
 assert.ok(close(c.reportedPairNetImpulseWorldNs.x,0.3));
 assert.ok(close(c.reportedPairNetImpulseMagnitudeNs,0.3));
 assert.ok(close(c.reportedPairImpulseMagnitudesSumNs,0.3));
 assert.ok(close(c.observedBallMomentumDeltaWorldNs.x,-2*m));
 assert.ok(close(c.observedBallMomentumDeltaMagnitudeNs,2*m));
 assert.equal(c.observedBallPlanarTurnAngleDeg,180);
 assert.notEqual(c.observedBallMomentumDeltaMagnitudeNs,
  c.reportedPairNetImpulseMagnitudeNs);
 assert.equal(c.attribution,'unresolved');
 assert.equal(c.possessionInferred,false);
 assert.equal(c.exclusiveFootImpulseProven,false);
 assert.equal(Object.hasOwn(c,'kickForce'),false);
 assert.ok(Object.isFrozen(ending)&&Object.isFrozen(ending.completed)&&
  Object.isFrozen(c)&&Object.isFrozen(c.reportedPairNetImpulseWorldNs)&&
  Object.isFrozen(c.observedBallMomentumDeltaWorldNs));
 assert.deepEqual(ep.observe(...frame(4,v(-1),v(-1))).completed,[]);
 assert.deepEqual(ep.snapshot().openIds,[]);
});

test('ME-PB-11 same-player repeated REAL episodes cannot inherit earlier force integrals',()=>{
 const ep=createFootContactEpisodeAudit();
 ep.observe(...frame(1,v(1),v(0.8),{starts:['home-10'],active:{'home-10':1},
  force:{'home-10':v(0.1)}}));
 ep.observe(...frame(2,v(0.8),v(0.4),{ends:{'home-10':1}}));
 ep.observe(...frame(3,v(0.4),v(0.2)));
 ep.observe(...frame(4,v(0.2),v(-0.3),{starts:['home-10'],active:{'home-10':4},
  occurrences:{'home-10':'repeat-within-window'}}));
 const second=ep.observe(...frame(5,v(-0.3),v(-0.2),{ends:{'home-10':4}}))
  .completed[0];
 assert.equal(second.startTick,4);
 assert.equal(second.onsetOccurrence,'repeat-within-window');
 assert.equal(second.reportedForceTickCount,0);
 assert.equal(second.unreportedForceTickCount,2);
 assert.equal(second.reportedPairNetImpulseWorldNs,null);
 assert.equal(second.reportedPairNetImpulseMagnitudeNs,null);
 assert.equal(second.reportedPairImpulseMagnitudesSumNs,null);
 assert.equal(second.exclusiveFootImpulseProven,false);
});

test('ME-PB-11 zero-duration same-step start/end is not fabricated sustained contact',()=>{
 const ep=createFootContactEpisodeAudit();
 const report=ep.observe(...frame(1,v(0),v(0),{
  starts:['away-10'],ends:{'away-10':1}
 })).completed[0];
 assert.equal(report.durationTicks,0);
 assert.equal(report.kind,'zero-sample');
 assert.equal(report.sampledTickCount,1);
 assert.equal(report.unreportedForceTickCount,1);
 assert.equal(report.reportedPairNetImpulseWorldNs,null);
 assert.equal(report.observedBallPlanarTurnAngleDeg,null);
 assert.deepEqual(ep.snapshot().openIds,[]);
});

test('ME-PB-11 concurrent Home/Away episodes preserve separate force samples and mark overlap',()=>{
 const ep=createFootContactEpisodeAudit();
 const a=ep.observe(...frame(1,v(2),v(1.5),{
  starts:['home-10','away-10'],
  active:{'home-10':1,'away-10':1},
  force:{'home-10':v(0.3),'away-10':v(-0.2)}
 }));
 assert.deepEqual(a.openIds,['home-10','away-10']);
 const finished=ep.observe(...frame(2,v(1.5),v(0.5),{
  ends:{'home-10':1,'away-10':1}
 })).completed;
 assert.equal(finished.length,2);
 assert.deepEqual(finished.map(c=>c.id),['home-10','away-10']);
 assert.ok(finished.every(c=>c.observedOverlappingPair));
 assert.deepEqual(finished.map(c=>c.reportedPairNetImpulseWorldNs.x),[0.3,-0.2]);
 assert.ok(finished.every(c=>c.attribution==='unresolved'&&!c.exclusiveFootImpulseProven));
});

test('ME-PB-11 rejects fabricated source/mismatched identities and does not mutate on failure',()=>{
 const ep=createFootContactEpisodeAudit();
 const good=frame(1,v(1),v(0.5),{
  starts:['home-10'],active:{'home-10':1},force:{'home-10':v(0.1)}
 });
 const broken=[
  [good[0],{...good[1],tick:3},...good.slice(2)],
  [good[0],good[1],{...good[2],onsets:[]},...good.slice(3)],
  [good[0],good[1],good[2],
   {...good[3],pairs:[{...good[3].pairs[0],id:'invalid'}]},...good.slice(4)],
  [good[0],good[1],good[2],good[3],
   {...good[4],causalFootImpulseProven:true},m],
  [good[0],good[1],good[2],good[3],
   {...good[4],perPair:[{...good[4].perPair[0],reportedPairNetImpulseMagnitudeNs:99}]},m],
  [good[0],good[1],good[2],good[3],good[4],0],
  [good[0],good[1],good[2],good[3],
   {...good[4],ballDeltaVelocityWorldMps:v(40)},m],
  [good[0],good[1],{...good[2],ongoing:[{
   id:'home-10',startTick:1,observedTicks:5
  }]},...good.slice(3)]
 ];
 const original=ep.snapshot();
 for(const args of broken){
  assert.throws(()=>ep.observe(...args));
  assert.deepEqual(ep.snapshot(),original);
 }
 ep.observe(...good);
 assert.throws(()=>ep.observe(...good),/Consecutive/);
 assert.equal(ep.snapshot().tick,1);
 assert.throws(()=>ep.observe(...frame(2,v(0.5),v(0.3))),
  /vanished|lacks|mismatch|differs/);
 assert.equal(ep.snapshot().tick,1);
 const done=ep.observe(...frame(2,v(0.5),v(0.3),{
  ends:{'home-10':1}
 }));
 assert.equal(done.completed.length,1);
});

const RAPIER=await initializeRapier(RAPIER_MODULE);
const scenarios=Object.freeze([
 {name:'grazing-repeat',x:-5.25,y:-0.14,vx:2,vy:0.1,ticks:200},
 {name:'sustained-shoe',x:-4.96,y:0,vx:0.3,vy:0,ticks:90},
 {name:'medium-roll',x:-6,y:0,vx:4,vy:0,ticks:100},
 {name:'fast-roll',x:-6,y:0,vx:16,vy:0,ticks:65},
 {name:'mirrored-away',x:6,y:0,vx:-4,vy:0,ticks:115},
 {name:'ground-only',preset:'bounce',x:0,y:0,z:2,vx:0,vy:0,ticks:140,negative:true},
 {name:'airborne',preset:'launch',x:-4.78,y:0,z:3,vx:0,vy:0,ticks:30,negative:true},
 {name:'distant',x:0,y:0,vx:0,vy:0,ticks:70,negative:true}
].map(x=>Object.freeze(x)));
function simulate(c,optIn=true){
 const input={preset:c.preset??'roll',seed:'pb11-'+c.name,
  x:c.x,y:c.y,z:c.z??0,vx:c.vx,vy:c.vy,vz:0};
 const engine=createEngine(RAPIER,input,
  {diagnosticPlayerFootContactsEnabled:optIn});
 const mover=optIn?createPlayerMovement():null;
 const observer=optIn?createFootContactEpisodeAudit():null;
 const ball=[],completed=[],samples=[];
 let observedFootStarts=0,terrainOnlyBounces=0;
 try{
  if(!optIn)assert.equal(engine.footContactSnapshot,undefined);
  for(let tick=1;tick<=c.ticks;tick++){
   const before=engine.snapshot();
   const after=optIn?engine.step(mover.step(before.ball.position)):engine.step();
   ball.push(canonicalSnapshot(after));
   if(!optIn)continue;
   const events=engine.footContactSnapshot();
   const timeline=engine.footContactTimelineSnapshot();
   const solver=engine.footContactSolverSnapshot();
   const momentum=engine.footContactMomentumAuditSnapshot();
   const qualifier=engine.footContactQualificationSnapshot();
   const directional=measureFootDirectionalResponse(
    before,after,events,solver,momentum,qualifier,engine.ballProperties.massKg);
   const episode=observer.observe(before,after,timeline,solver,directional,
    engine.ballProperties.massKg);
   assert.equal(episode.tick,tick);
   assert.deepEqual(episode.openIds,timeline.ongoing.map(x=>x.id));
   assert.deepEqual(episode.completed.map(x=>x.id),
    timeline.completed.map(x=>x.id));
   assert.equal(episode.attribution,'unresolved');
   assert.equal(episode.possessionInferred,false);
   assert.equal(episode.exclusiveFootImpulseProven,false);
   assert.ok(Object.isFrozen(episode)&&Object.isFrozen(episode.completed));
   for(const e of episode.completed){
    assert.equal(e.durationTicks,e.endTick-e.startTick);
    assert.equal(e.sampledTickCount,e.durationTicks+1);
    assert.equal(e.reportedForceTickCount+e.unreportedForceTickCount,
     e.sampledTickCount);
    assert.equal(e.completeReportedForceCoverage,e.unreportedForceTickCount===0);
    assert.equal(e.attribution,'unresolved');
    if(e.reportedForceTickCount===0){
     assert.equal(e.reportedPairNetImpulseMagnitudeNs,null);
     assert.equal(e.reportedPairImpulseMagnitudesSumNs,null);
    }else{
     assert.ok(Number.isFinite(e.reportedPairNetImpulseMagnitudeNs));
     assert.ok(e.reportedPairImpulseMagnitudesSumNs>=
      e.reportedPairNetImpulseMagnitudeNs-1e-8);
    }
    assert.ok(e.observedBallMomentumDeltaMagnitudeNs>=0);
    assert.ok(Object.isFrozen(e));
   }
   completed.push(...episode.completed);
   samples.push(episode);
   observedFootStarts+=events.started.length;
   if(before.ball.velocity.z< -0.05&&after.ball.velocity.z>0.05&&
      events.active.length===0&&events.started.length===0&&
      solver.reportedForcePairs===0)terrainOnlyBounces++;
  }
  return {ball,completed,samples,observedFootStarts,terrainOnlyBounces};
 }finally{engine.dispose();}
}
for(const c of scenarios){
 test('ME-PB-11 real Rapier '+c.name+' full collision lifetime, force coverage, deterministic replay',()=>{
  const a=simulate(c),b=simulate(c);
  assert.deepEqual(a,b,'real 60Hz ball + independent episode report must replay exactly');
  if(c.negative){
   assert.equal(a.observedFootStarts,0);
   assert.deepEqual(a.completed,[]);
   assert.ok(a.samples.every(e=>e.openIds.length===0));
  }
  if(c.name==='ground-only')assert.ok(a.terrainOnlyBounces>=1);
  if(c.name==='sustained-shoe'){
   assert.equal(a.observedFootStarts,1);
   assert.equal(a.completed.length,1);
   assert.ok(a.completed[0].durationTicks>=10);
  }
  if(c.name==='grazing-repeat'){
   const home=a.completed.filter(x=>x.id==='home-10');
   assert.ok(home.length>=3,'multiple REAL Rapier start-end episodes required');
   assert.deepEqual(home.slice(0,3).map(x=>x.startTick),[6,15,32]);
   assert.equal(home[1].onsetOccurrence,'repeat-within-window');
   assert.equal(home[2].onsetOccurrence,'repeat-within-window');
   assert.ok(a.observedFootStarts>=4,'long-gap real Rapier restart required');
  }
  if(c.name==='medium-roll'){
   assert.ok(a.completed.some(x=>x.id==='home-10'&&
    x.reportedForceTickCount>0&&
    x.reportedPairNetImpulseMagnitudeNs!==null));
  }
  const evidence=a.completed.slice(0,5).map(e=>({
   id:e.id,start:e.startTick,end:e.endTick,duration:e.durationTicks,
   measuredBallDeltaMomentumNs:Math.round(e.observedBallMomentumDeltaMagnitudeNs*1e5)/1e5,
   reportedPairImpulseNs:e.reportedPairNetImpulseMagnitudeNs===null?null:
    Math.round(e.reportedPairNetImpulseMagnitudeNs*1e5)/1e5,
   reportedForceTicks:e.reportedForceTickCount,
   missingForceTicks:e.unreportedForceTickCount,
   overlapping:e.observedOverlappingPair
  }));
  process.stdout.write('ME_PB_11_REAL '+JSON.stringify({
   scenario:c.name,physicalStarts:a.observedFootStarts,
   completedEpisodes:a.completed.length,
   exampleEpisodes:evidence,turfOnlyReversals:a.terrainOnlyBounces,
   identicalReplay:true,attribution:'unresolved'
  })+'\n');
 });
}
test('ME-PB-11 baseline non-opt-in world has NO episode or foot observations',()=>{
 const c=scenarios.find(x=>x.name==='medium-roll');
 const a=simulate(c,false),b=simulate(c,false);
 assert.deepEqual(a.ball,b.ball);
 assert.deepEqual(a.completed,[]);
 assert.equal(a.observedFootStarts,0);
});
