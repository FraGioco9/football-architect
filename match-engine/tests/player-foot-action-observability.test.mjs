// ME-PB-17 — real Rapier checks: physical contact, positional pressing and
// force samples cannot establish deliberate pass/shot/touch/possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';
import {FOOT_ACTION_OBSERVABILITY_VERSION,inspectFootActionObservability}
 from '../src/player-foot-action-observability.mjs';

const RAPIER=await initializeRapier(rapierModule);
const EPS=1e-6;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const cases=Object.freeze([
 Object.freeze({name:'medium-home',x:-6,y:0,vx:4,vy:0,ticks:110,target:'home-10'}),
 Object.freeze({name:'fast-home-ccd',x:-6,y:0,vx:16,vy:0,ticks:70,target:'home-10',
  fixedReferencePath:true,clampTick:4,firstStartTick:5}),
 Object.freeze({name:'grazing-real-recontacts',x:-5.25,y:-0.14,vx:2,vy:0.1,ticks:200,
  target:'home-10',forceGapTick:32}),
 Object.freeze({name:'sustained-episode',x:-4.96,y:0,vx:0.3,vy:0,ticks:210,
  target:'home-10',longContact:true}),
 Object.freeze({name:'mirrored-away',x:6,y:0,vx:-4,vy:0,ticks:110,target:'away-10'}),
 Object.freeze({name:'turf-only',preset:'bounce',x:0,y:0,z:2,vx:0,vy:0,
  ticks:140,negative:true}),
 Object.freeze({name:'high-airborne',preset:'launch',x:-4.78,y:0,z:3,vx:0,vy:0,
  ticks:35,negative:true}),
 Object.freeze({name:'distant',x:0,y:0,vx:0,vy:0,ticks:70,negative:true})
]);
function run(c){
 const input={preset:c.preset??'roll',seed:'pb17-'+c.name,x:c.x,y:c.y,
  z:c.z??0,vx:c.vx,vy:c.vy,vz:0};
 const engine=createEngine(RAPIER,input,{
  diagnosticPlayerFootContactsEnabled:true});
 const control=c.fixedReferencePath?createEngine(RAPIER,input):null;
 const mover=createPlayerMovement();
 const trace=[];
 try{
  for(let tick=1;tick<=c.ticks;tick++){
   const pos=c.fixedReferencePath?control.snapshot().ball.position:
    engine.snapshot().ball.position;
   const movement=mover.step(pos);
   const frame=engine.step(movement);
   const noShoes=control?.step();
   const events=engine.footContactSnapshot();
   const solver=engine.footContactSolverSnapshot();
   const timeline=engine.footContactTimelineSnapshot();
   const result=inspectFootActionObservability(movement,timeline,solver);
   assert.equal(frame.tick,tick);
   assert.equal(result.tick,tick);
   assert.equal(result.version,FOOT_ACTION_OBSERVABILITY_VERSION);
   assert.equal(result.realCollisionStarts,events.started.length);
   assert.equal(result.reportedPairForceSamples,solver.reportedForcePairs);
   assert.equal(result.attribution,'unresolved');
   assert.equal(result.actionEligibility,'not-established');
   assert.equal(result.sourceHasExplicitBallActionCommand,false);
   assert.equal(result.confirmedTouch,false);
   assert.equal(result.playerIntentInferred,false);
   assert.equal(result.possessionInferred,false);
   assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.observations));
   assert.ok(result.observations.every(p=>Object.isFrozen(p)&&
    p.explicitBallActionCommand===null&&
    p.actionCommandProvenance==='absent'&&
    p.playerIntentInferred===false&&
    p.confirmedTouch===false&&p.possessionInferred===false));
   trace.push(Object.freeze({
    tick,ball:canonicalSnapshot(frame),
    starts:Object.freeze([...events.started]),
    ends:Object.freeze([...events.ended]),
    active:Object.freeze([...events.active]),
    pairForceIds:Object.freeze(solver.pairs.filter(p=>p.rapierForceReported)
     .map(p=>p.id)),
    audit:result,
    ...(noShoes?{
     noShoeBall:canonicalSnapshot(noShoes),
     positionalDeltaM:distance(frame.ball.position,noShoes.ball.position),
     velocityDeltaMps:distance(frame.ball.velocity,noShoes.ball.velocity)
    }:{})
   }));
  }
  return Object.freeze(trace);
 }finally{engine.dispose();control?.dispose();}
}
const count=(trace,selector)=>trace.reduce((n,x)=>n+selector(x),0);
test('ME-PB-17 pure audit rejects injected action claims and stale or forged sources',()=>{
 const e=createEngine(RAPIER,{preset:'roll',x:-4.96,y:0,z:0,
  vx:0.3,vy:0,vz:0},{diagnosticPlayerFootContactsEnabled:true});
 const mover=createPlayerMovement();
 try{
  const frame=mover.step(e.snapshot().ball.position);
  e.step(frame);
  const timeline=e.footContactTimelineSnapshot();
  const solver=e.footContactSolverSnapshot();
  assert.ok(inspectFootActionObservability(frame,timeline,solver));
  for(const field of ['ballAction','kickCommand','ballActionCommand',
   'passCommand','confirmedTouch','ballOwner']){
   assert.throws(()=>inspectFootActionObservability(
    {...frame,[field]:{id:'home-10'}},timeline,solver),/Unsupported/);
   const forged=frame.players.map((p,i)=>i===0?{...p,[field]:'shoot'}:p);
   assert.throws(()=>inspectFootActionObservability(
    {...frame,players:forged},timeline,solver),/Unsupported/);
  }
  assert.throws(()=>inspectFootActionObservability(
   {...frame,tick:2},timeline,solver),/Aligned/);
  assert.throws(()=>inspectFootActionObservability(
   {...frame,players:frame.players.slice(1)},timeline,solver),/Canonical 22/);
  assert.throws(()=>inspectFootActionObservability(
   {...frame,pressers:{home:'away-10',away:'away-10'}},
   timeline,solver),/presser/);
  const clone=[...frame.players];
  clone[0]={...clone[0],id:'fake-player'};
  assert.throws(()=>inspectFootActionObservability(
   {...frame,players:clone},timeline,solver),/Canonical finite/);
  assert.throws(()=>inspectFootActionObservability(frame,timeline,
   {...solver,reportedForcePairs:solver.reportedForcePairs+1}),/Inconsistent|Missing/);
  if(solver.pairs.length){
   const fabricated=solver.pairs.map((p,i)=>i===0?
    {...p,rapierForceReported:false,derivedNetImpulseMagnitudeNs:1}:p);
   assert.throws(()=>inspectFootActionObservability(
    frame,timeline,{...solver,pairs:fabricated}),/Absent|reconcile/);
  }
 }finally{e.dispose();}
});
test('ME-PB-17 default physics never supplies an action or shoe observer',()=>{
 const input={preset:'roll',x:-6,y:0,z:0,vx:4,vy:0,vz:0};
 const a=createEngine(RAPIER,input),b=createEngine(RAPIER,input);
 try{
  assert.equal(a.footContactTimelineSnapshot,undefined);
  assert.equal(a.footContactSolverSnapshot,undefined);
  for(let i=0;i<65;i++)
   assert.equal(canonicalSnapshot(a.step()),canonicalSnapshot(b.step()));
 }finally{a.dispose();b.dispose();}
});
for(const c of cases){
 test('ME-PB-17 real Rapier cannot infer ball intent '+c.name,()=>{
  const a=run(c),b=run(c);
  assert.deepEqual(a,b,'two full independent Rapier replays are deterministic');
  const starts=count(a,x=>x.starts.length);
  const forces=count(a,x=>x.pairForceIds.length);
  const pressingStarts=count(a,x=>x.audit.observations.filter(p=>
   p.phase==='start'&&p.positionalPressingRole).length);
  const forcePressing=count(a,x=>x.audit.observations.filter(p=>
   p.rapierForceReported&&p.positionalPressingRole).length);
  const firstStart=a.find(x=>x.starts.length>0)?.tick??null;
  if(c.target){
   assert.ok(a.some(x=>x.starts.includes(c.target)));
   assert.ok(a.some(x=>x.pairForceIds.includes(c.target)));
   assert.ok(starts>0&&forces>0);
   assert.ok(pressingStarts>=1,
    'a positional presser can really contact without an action command');
   assert.ok(forcePressing>=1,
    'actual physical pressers can exert force without a kick command');
  }
  if(c.forceGapTick){
   const row=a[c.forceGapTick-1];
   assert.ok(row.starts.includes(c.target));
   const p=row.audit.observations.find(p=>p.id===c.target);
   assert.ok(p);
   assert.equal(p.rapierForceReported,false);
   assert.equal(p.reportedPairNetForceIntegralNs,null);
   assert.equal(p.actionCommandProvenance,'absent');
  }
  if(c.longContact){
   const activeCount=count(a,x=>x.active.includes(c.target)?1:0);
   const startCount=count(a,x=>x.starts.includes(c.target)?1:0);
   const forceCount=count(a,x=>x.pairForceIds.includes(c.target)?1:0);
   assert.equal(startCount,1);
   assert.ok(activeCount>=10);
   assert.ok(forceCount>1,'one real prolonged episode can have many force reports');
  }
  if(c.clampTick){
   const first=a[c.clampTick-1];
   assert.equal(firstStart,c.firstStartTick);
   assert.ok(first.positionalDeltaM>0.08);
   assert.ok(first.velocityDeltaMps<EPS);
   assert.ok(first.starts.length===0&&first.pairForceIds.length===0);
   assert.equal(first.audit.actionEligibility,'not-established');
  }
  if(c.negative){
   assert.equal(starts,0);
   assert.equal(forces,0);
   assert.ok(a.every(x=>x.audit.physicalPairCount===0));
  }
  process.stdout.write('ME_PB_17_INTENT_BOUNDARY '+JSON.stringify({
   scenario:c.name,firstRealCollisionStartTick:firstStart,
   trueRapierStarts:starts,realPairForceSamples:forces,
   positionalPresserStartSamples:pressingStarts,
   positionalPresserForceSamples:forcePressing,
   explicitBallActionCommands:0,confirmedTouches:0,
   inferredPossessions:0,exactReplay:true
  })+'\n');
 });
}
