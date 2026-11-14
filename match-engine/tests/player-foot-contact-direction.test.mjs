// ME-PB-10 — real directional ball response at Rapier foot event onsets.
// No synthetic impulses, user steering, ownership, or claims of sole causation.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,FIXED_DT,ENGINE_VERSION,
 BALL_MASS_KG} from '../src/core.mjs';
import {createPlayerMovement} from '../src/player-movement.mjs';
import {FOOT_CONTACT_VERSION} from '../src/player-foot-contact.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from '../src/player-foot-contact-solver.mjs';
import {FOOT_MOMENTUM_AUDIT_VERSION} from '../src/player-foot-contact-momentum.mjs';
import {FOOT_CONTACT_QUALIFICATION_VERSION,FOOT_REPEAT_WINDOW_TICKS}
 from '../src/player-foot-contact-qualification.mjs';
import {FOOT_DIRECTIONAL_RESPONSE_VERSION,measureFootDirectionalResponse}
 from '../src/player-foot-contact-direction.mjs';

const round=n=>n===null?null:Math.round(n*1e5)/1e5;
const close=(a,b)=>Math.abs(a-b)<1e-9;
const makeBall=(tick,velocity)=>({
 version:ENGINE_VERSION,tick,time:tick*FIXED_DT,ball:{velocity}
});
const pre=makeBall(0,{x:2,y:0,z:0});
const post=makeBall(1,{x:-1,y:0,z:-0.1635});
function fixture({normal={x:1,y:0,z:0},force=true}={}){
 const ids=['home-10'];
 const events={version:FOOT_CONTACT_VERSION,tick:1,started:ids,ended:[],active:ids};
 const forceWorld=force?{x:60,y:0,z:0}:null;
 const impulse=force?{x:1,y:0,z:0}:null;
 const solver={
  version:FOOT_SOLVER_EVIDENCE_VERSION,tick:1,
  pairs:[{
   id:'home-10',beganThisTick:true,endedThisTick:false,
   collisionActive:true,rapierForceReported:force,
   totalForceWorldN:forceWorld,derivedNetImpulseWorldNs:impulse,
   derivedNetImpulseMagnitudeNs:force?1:null,
   manifolds:force?[{normalWorld:normal,solverContacts:1}]:[]
  }],
  reportedForcePairs:force?1:0,simultaneousSolverPairs:false
 };
 const delta={x:-3*BALL_MASS_KG,y:0,z:-0.1635*BALL_MASS_KG};
 const audit={
  version:FOOT_MOMENTUM_AUDIT_VERSION,tick:1,
  ballDeltaLinearMomentumWorldNs:delta,
  reportedFootPairCount:force?1:0,
  pairs:[{
   id:'home-10',rapierForceReported:force,
   pairImpulseMagnitudeNs:force?1:null,
   maxAbsForceNormalAlignment:force?1:null
  }],
  attribution:'unresolved',exclusiveFootMomentumTransferProven:false
 };
 const qualifier={
  version:FOOT_CONTACT_QUALIFICATION_VERSION,tick:1,
  onsets:[{id:'home-10',occurrence:'isolated'}],completions:[],
  activeIds:ids,forceReportedIds:force?ids:[],
  attribution:'unresolved',possessionInferred:false
 };
 return [events,solver,audit,qualifier];
}
const measure=(a=pre,b=post,rest=fixture(),mass=BALL_MASS_KG)=>
 measureFootDirectionalResponse(a,b,...rest,mass);

test('ME-PB-10 pure vector audit: 180-degree planar reversal is measured, never attributed',()=>{
 const sample=measure();
 assert.equal(sample.version,FOOT_DIRECTIONAL_RESPONSE_VERSION);
 assert.equal(sample.tick,1);
 assert.deepEqual(sample.ballDeltaVelocityWorldMps,{x:-3,y:0,z:-0.1635});
 assert.ok(close(sample.ballDeltaVelocityMagnitudeMps,Math.hypot(3,0.1635)));
 assert.equal(sample.planarDirectionCosine,-1);
 assert.equal(sample.planarTurningAngleDeg,180);
 assert.equal(sample.planarReversalObserved,true);
 assert.equal(sample.reportedForcePairCount,1);
 assert.equal(sample.collisionOnsetCount,1);
 assert.equal(sample.perPair.length,1);
 const p=sample.perPair[0];
 assert.equal(p.id,'home-10');
 assert.equal(p.beganThisTick,true);
 assert.equal(p.onsetOccurrence,'isolated');
 assert.equal(p.rapierForceReported,true);
 assert.equal(p.reportedPairNetImpulseMagnitudeNs,1);
 assert.ok(close(p.maxAbsBallDeltaVelocityNormalProjectionMps,3));
 assert.ok(p.absForceVsBallDeltaVelocityCosine>0.99);
 assert.ok(p.maxAbsBallDeltaVelocityVsNormalCosine>0.99);
 assert.equal(p.absForceVsNormalCosine,1);
 assert.equal(sample.attribution,'unresolved');
 assert.equal(sample.possessionInferred,false);
 assert.equal(sample.causalFootImpulseProven,false);
 assert.equal(Object.hasOwn(sample,'owner'),false);
 assert.equal(Object.hasOwn(sample,'kick'),false);
 assert.ok(Object.isFrozen(sample)&&Object.isFrozen(sample.perPair)&&
  Object.isFrozen(p)&&Object.isFrozen(sample.ballDeltaVelocityWorldMps));
});

test('ME-PB-10 world normal sign cannot change absolute directional alignment',()=>{
 const plus=measure();
 const minus=measure(pre,post,fixture({normal:{x:-1,y:0,z:0}}));
 assert.equal(plus.perPair[0].maxAbsBallDeltaVelocityVsNormalCosine,
  minus.perPair[0].maxAbsBallDeltaVelocityVsNormalCosine);
 assert.equal(plus.perPair[0].maxAbsBallDeltaVelocityNormalProjectionMps,
  minus.perPair[0].maxAbsBallDeltaVelocityNormalProjectionMps);
});

test('ME-PB-10 an absent force stays null, even during genuine onset with measured delta velocity',()=>{
 const report=measure(pre,post,fixture({force:false}));
 assert.equal(report.reportedForcePairCount,0);
 assert.equal(report.collisionOnsetCount,1);
 assert.ok(report.ballDeltaVelocityMagnitudeMps>0);
 assert.equal(report.perPair[0].rapierForceReported,false);
 assert.equal(report.perPair[0].reportedPairNetImpulseMagnitudeNs,null);
 assert.equal(report.perPair[0].absForceVsBallDeltaVelocityCosine,null);
 assert.equal(report.perPair[0].absForceVsNormalCosine,null);
 assert.equal(report.perPair[0].maxAbsBallDeltaVelocityVsNormalCosine,null);
 assert.equal(report.perPair[0].maxAbsBallDeltaVelocityNormalProjectionMps,null);
 assert.equal(report.causalFootImpulseProven,false);
});

test('ME-PB-10 stationary/zero-speed planar vectors have null turn angle, not invented 0 degrees',()=>{
 const resting=makeBall(0,{x:0,y:0,z:0});
 const falling=makeBall(1,{x:0,y:0,z:-0.1635});
 const rest=fixture({force:false});
 rest[2].ballDeltaLinearMomentumWorldNs={x:0,y:0,z:-0.1635*BALL_MASS_KG};
 const report=measure(resting,falling,rest);
 assert.equal(report.planarDirectionCosine,null);
 assert.equal(report.planarTurningAngleDeg,null);
 assert.equal(report.planarReversalObserved,null);
 assert.ok(report.ballDeltaVelocityMagnitudeMps>0);
});

test('ME-PB-10 rejects forged mass, ticks, event identity, impulse and fabricated attribution',()=>{
 const base=fixture();
 const failures=[
  [pre,{...post,tick:2},base,BALL_MASS_KG],
  [pre,post,base,0],
  [pre,post,base,NaN],
  [pre,{...post,ball:{velocity:{x:Infinity,y:0,z:0}}},base,BALL_MASS_KG],
  [pre,post,[{...base[0],started:[]},base[1],base[2],base[3]],BALL_MASS_KG],
  [pre,post,[base[0],{...base[1],pairs:[{...base[1].pairs[0],id:'invented'}]},base[2],base[3]],BALL_MASS_KG],
  [pre,post,[base[0],base[1],{...base[2],ballDeltaLinearMomentumWorldNs:{x:9,y:0,z:0}},base[3]],BALL_MASS_KG],
  [pre,post,[base[0],base[1],base[2],{...base[3],possessionInferred:true}],BALL_MASS_KG],
  [pre,post,[base[0],base[1],base[2],{...base[3],tick:2}],BALL_MASS_KG],
  [pre,post,[base[0],{...base[1],pairs:[{...base[1].pairs[0],derivedNetImpulseWorldNs:{x:100,y:0,z:0}}]},base[2],base[3]],BALL_MASS_KG],
  [pre,post,[base[0],{...base[1],pairs:[{...base[1].pairs[0],manifolds:[{normalWorld:{x:0,y:0,z:0},solverContacts:1}]}]},base[2],base[3]],BALL_MASS_KG]
 ];
 for(const args of failures)assert.throws(()=>measure(...args));
});

const RAPIER=await initializeRapier(rapierModule);
const cases=Object.freeze([
 {name:'slow-roll',x:-5.18,y:0,vx:0.8,vy:0,ticks:85},
 {name:'medium-roll',x:-6,y:0,vx:4,vy:0,ticks:100},
 {name:'fast-roll',x:-6,y:0,vx:16,vy:0,ticks:55},
 {name:'lateral-roll',x:-4.78,y:-0.55,vx:0,vy:3.5,ticks:95},
 {name:'mirrored-away',x:6,y:0,vx:-4,vy:0,ticks:110,target:'away-10'},
 {name:'grazing-recontacts',x:-5.25,y:-0.14,vx:2,vy:0.1,ticks:200,target:'home-10'},
 {name:'continuous-foot',x:-4.96,y:0,vx:0.3,vy:0,ticks:90,target:'home-10'},
 {name:'turf-bounces',preset:'bounce',x:0,y:0,z:2,vx:0,vy:0,ticks:115,negative:true},
 {name:'airborne',preset:'launch',x:-4.78,y:0,z:3,vx:0,vy:0,ticks:30,negative:true},
 {name:'distant-rest',x:0,y:0,vx:0,vy:0,ticks:60,negative:true}
].map(x=>Object.freeze(x)));

function run(c,enabled=true){
 const world=createEngine(RAPIER,{
  preset:c.preset??'roll',seed:'pb10-'+c.name,
  x:c.x,y:c.y,z:c.z??0,vx:c.vx,vy:c.vy,vz:0
 },{diagnosticPlayerFootContactsEnabled:enabled});
 const mover=enabled?createPlayerMovement():null;
 const trace=[],events=[],direction=[],episodes=[],endedAt=new Map(),recontacts=[];
 let turfOnlyReversals=0;
 try{
  if(!enabled)assert.equal(world.footContactSnapshot,undefined);
  for(let tick=1;tick<=c.ticks;tick++){
   const before=world.snapshot();
   const current=enabled?world.step(mover.step(before.ball.position)):world.step();
   trace.push(canonicalSnapshot(current));
   if(!enabled)continue;
   const contact=world.footContactSnapshot();
   const solver=world.footContactSolverSnapshot();
   const audit=world.footContactMomentumAuditSnapshot();
   const qualified=world.footContactQualificationSnapshot();
   const dir=measureFootDirectionalResponse(before,current,
    contact,solver,audit,qualified,world.ballProperties.massKg);
   assert.equal(dir.tick,tick);
   assert.equal(dir.version,FOOT_DIRECTIONAL_RESPONSE_VERSION);
   assert.equal(dir.collisionOnsetCount,contact.started.length);
   assert.equal(dir.reportedForcePairCount,solver.reportedForcePairs);
   assert.equal(dir.attribution,'unresolved');
   assert.equal(dir.possessionInferred,false);
   assert.equal(dir.causalFootImpulseProven,false);
   assert.ok(Object.isFrozen(dir)&&Object.isFrozen(dir.perPair));
   assert.ok(dir.planarTurningAngleDeg===null||
    dir.planarTurningAngleDeg>=0&&dir.planarTurningAngleDeg<=180);
   for(const p of dir.perPair){
    assert.ok(Object.isFrozen(p));
    for(const v of [
     p.absForceVsBallDeltaVelocityCosine,
     p.absForceVsNormalCosine,
     p.maxAbsBallDeltaVelocityVsNormalCosine
    ])assert.ok(v===null||v>=0&&v<=1+1e-8);
    if(p.maxAbsBallDeltaVelocityNormalProjectionMps!==null)
     assert.ok(p.maxAbsBallDeltaVelocityNormalProjectionMps<=
      dir.ballDeltaVelocityMagnitudeMps*1.005+1e-6);
    if(!p.rapierForceReported){
     assert.equal(p.reportedPairNetImpulseMagnitudeNs,null);
     assert.equal(p.absForceVsBallDeltaVelocityCosine,null);
    }
    if(p.beganThisTick){
     assert.ok(contact.started.includes(p.id));
     const previous=endedAt.get(p.id);
     if(previous!==undefined){
      const gap=tick-previous;
      const short=gap<=FOOT_REPEAT_WINDOW_TICKS;
      assert.equal(p.onsetOccurrence,short?'repeat-within-window':'isolated');
      recontacts.push(Object.freeze({
       id:p.id,tick,previousEndTick:previous,gapTicks:gap,
       short,ballTurnAngleDeg:dir.planarTurningAngleDeg,
       ballDeltaVelocityMagnitudeMps:dir.ballDeltaVelocityMagnitudeMps,
       pairForceObserved:p.rapierForceReported,
       absNormalProjectionMps:p.maxAbsBallDeltaVelocityNormalProjectionMps
      }));
     }
    }
   }
   const timeline=world.footContactTimelineSnapshot();
   for(const ended of timeline.completed){
    assert.ok(contact.ended.includes(ended.id));
    endedAt.set(ended.id,tick);
    episodes.push(Object.freeze({
     id:ended.id,start:ended.startTick,end:tick,duration:ended.durationTicks
    }));
   }
   if(before.ball.velocity.z< -0.05&&current.ball.velocity.z>0.05&&
      contact.started.length===0&&contact.active.length===0&&
      solver.reportedForcePairs===0)turfOnlyReversals++;
   events.push(contact);direction.push(dir);
  }
  return Object.freeze({
   trace:Object.freeze(trace),events:Object.freeze(events),
   direction:Object.freeze(direction),episodes:Object.freeze(episodes),
   recontacts:Object.freeze(recontacts),turfOnlyReversals
  });
 }finally{world.dispose();}
}
for(const c of cases){
 test('ME-PB-10 real 60Hz '+c.name+' directional force/normal vs ball response and replay',()=>{
  const a=run(c),b=run(c);
  assert.deepEqual(a.trace,b.trace);
  assert.deepEqual(a.events,b.events);
  assert.deepEqual(a.direction,b.direction);
  assert.deepEqual(a.recontacts,b.recontacts);
  assert.deepEqual(a.episodes,b.episodes);
  if(c.negative){
   assert.ok(a.direction.every(x=>x.collisionOnsetCount===0&&
    x.reportedForcePairCount===0&&x.perPair.length===0),
    'a terrain-only or high/distant ball must not fabricate foot contact');
   assert.equal(a.recontacts.length,0);
  }
  if(c.name==='turf-bounces')assert.ok(a.turfOnlyReversals>=1);
  if(c.target)assert.ok(a.events.some(e=>e.started.includes(c.target)));
  if(c.name==='continuous-foot'){
   assert.equal(a.episodes.length,1);
   assert.ok(a.episodes[0].duration>=10);
   assert.equal(a.recontacts.length,0);
  }
  if(c.name==='medium-roll'){
   const positive=a.direction.some(d=>d.perPair.some(p=>
    p.beganThisTick&&p.rapierForceReported&&
    p.reportedPairNetImpulseMagnitudeNs>0&&
    p.solverManifoldCount>0&&
    p.absForceVsBallDeltaVelocityCosine!==null&&
    p.maxAbsBallDeltaVelocityVsNormalCosine!==null));
   assert.ok(positive,'at least one REAL onsetting pair with force and manifold directional evidence');
  }
  if(c.name==='grazing-recontacts'){
   const home=a.recontacts.filter(p=>p.id==='home-10');
   assert.ok(home.filter(p=>p.short).length>=2);
   assert.ok(home.filter(p=>!p.short).length>=1);
   assert.deepEqual(home.slice(0,3).map(p=>[p.tick,p.gapTicks]),[
    [15,6],[32,3],[167,113]
   ]);
   assert.ok(home.every(p=>p.ballDeltaVelocityMagnitudeMps>=0));
  }
  const onsetDetails=a.direction.flatMap(d=>
   d.perPair.filter(p=>p.beganThisTick).map(p=>({
    tick:d.tick,id:p.id,turnAngleDeg:round(d.planarTurningAngleDeg),
    deltaSpeed3DMps:round(d.ballDeltaVelocityMagnitudeMps),
    solverForce:p.rapierForceReported,
    pairImpulseNs:round(p.reportedPairNetImpulseMagnitudeNs),
    normalProjectionMps:round(p.maxAbsBallDeltaVelocityNormalProjectionMps),
    forceDeltaAbsCos:round(p.absForceVsBallDeltaVelocityCosine),
    normalDeltaAbsCos:round(p.maxAbsBallDeltaVelocityVsNormalCosine)
   })));
  process.stdout.write('ME_PB_10_REAL '+JSON.stringify({
   scenario:c.name,onsets:onsetDetails.length,
   onsetEvidence:onsetDetails.slice(0,5),
   shortRecontacts:a.recontacts.filter(x=>x.short).length,
   longRecontacts:a.recontacts.filter(x=>!x.short).length,
   turfOnlyReversals:a.turfOnlyReversals,
   identicalReplay:true,attribution:'unresolved'
  })+'\n');
 });
}
test('ME-PB-10 ordinary default physics is deterministic with no foot event observer',()=>{
 const c=cases.find(x=>x.name==='medium-roll');
 const a=run(c,false),b=run(c,false);
 assert.deepEqual(a.trace,b.trace);
 assert.equal(a.direction.length,0);
 assert.equal(a.events.length,0);
});
