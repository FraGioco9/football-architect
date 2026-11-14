// C3.3a: real-frame per-tick ball/actor proximity between authenticated carry shoes.
// It measures possible continuous control, NEVER infers possession or dribble.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createPhysicalFixtureStepRuntime} from '../src/physical-fixture-step-runtime.mjs';
import {createPhysicalCarryProximityObserver,CARRY_PROXIMITY_VERSION,
 PROXIMITY_MEASURE_RADIUS_M} from '../src/player-ball-physical-carry-proximity.mjs';

const fixture=country=>({
 id:`season:1:${country}-1:N01:${country}-1:${country}-2`,
 competitionId:country+'-1',marker:'N01',day:1,round:1,
 homeClubId:country+'-1',awayClubId:country+'-2'
});
test('C3.3a rejects missing or invented same-tick Rapier inputs',()=>{
 const audit=createPhysicalCarryProximityObserver(fixture('IT').id);
 assert.throws(()=>audit.observe({
  physicsTick:0,ballSnapshot:{tick:0,ball:{position:{x:0,y:0,z:0.11}}}
 }),/Closed same-tick/);
 assert.throws(()=>audit.observe({}),/Closed same-tick/);
 assert.equal(PROXIMITY_MEASURE_RADIUS_M,1.25);
});

test('C3.3a mirrored 22-player real Rapier HOME/AWAY physical close-carry windows',async()=>{
 const R=await initializeRapier(rapier),evidence=[];
 for(const c of [
  {team:'home',country:'IT',x:-4.96,vx:0.3},
  {team:'away',country:'DE',x:4.96,vx:-0.3}
 ]){
  const scene={preset:'roll',seed:'c3-2a-real-'+c.team,
   x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0};
  const opts={autonomousActions:true,autonomousCarry:true};
  const a=createPhysicalFixtureStepRuntime(R,fixture(c.country),scene,opts);
  const b=createPhysicalFixtureStepRuntime(R,fixture(c.country),scene,opts);
  let firstWindow=null,windowCount=0,realOpposingStarts=0,
   realOpponentInterruptions=0,realTeammateInterruptions=0;
  try{
   assert.equal(a.snapshot().physicalCarryProximity.measuredWindows,0);
   for(let tick=1;tick<=600;tick++){
    const before=a.snapshot().physicalCarryProximity;
    const f=a.step(),g=b.step();
    const obs=f.physicalCarryProximity;
    realOpposingStarts+=f.physicalContactFeed.started.filter(x=>
     x.team!==c.team).length;
    assert.deepEqual(obs,g.physicalCarryProximity,'identical independent Rapier snapshots');
    assert.equal(obs.version,CARRY_PROXIMITY_VERSION);
    assert.equal(obs.physicsTick,tick);
    assert.equal(obs.readOnly,true);
    assert.equal(obs.ballControlConfirmed,null);
    assert.equal(obs.dribbleConfirmed,null);
    assert.equal(obs.officialMatchPossession,false);
    assert.equal(obs.officialMatchResult,null);
    assert.ok(obs.measuredWindows<=f.physicalCarryContactSequence.verifiedGroundCarryRecontacts);
    assert.ok(obs.interruptedWindows>=0);
    assert.equal(Object.values(obs.interruptionReasons).reduce(
     (a,b)=>a+b,0),obs.interruptedWindows,
     'interruption cause counts must exhaust exactly the interrupted windows');
    assert.ok(Object.isFrozen(obs.interruptionReasons));
    if(obs.interruptionReasons['opponent-shoe']>
       before.interruptionReasons['opponent-shoe']){
     const beforeActive=before.activeMeasurement;
     assert.ok(beforeActive,'real opponent interrupts a pre-existing carry');
     assert.equal(obs.latestInterruptedWindow.reason,'opponent-shoe');
     assert.ok([...f.physicalContactFeed.started,
      ...f.physicalContactFeed.active].some(shoe=>
       shoe.engineId!==beforeActive.engineId&&
       shoe.team!==beforeActive.team));
     realOpponentInterruptions++;
    }
    if(obs.interruptionReasons['teammate-shoe']>
       before.interruptionReasons['teammate-shoe']){
     const beforeActive=before.activeMeasurement;
     assert.ok(beforeActive,'real teammate interrupts a pre-existing carry');
     assert.equal(obs.latestInterruptedWindow.reason,'teammate-shoe');
     assert.ok([...f.physicalContactFeed.started,
      ...f.physicalContactFeed.active].some(shoe=>
       shoe.engineId!==beforeActive.engineId&&
       shoe.team===beforeActive.team));
     realTeammateInterruptions++;
    }
    const interrupted=obs.latestInterruptedWindow;
    if(interrupted){
     assert.equal(interrupted.dribbleConfirmed,null);
     assert.equal(interrupted.officialMatchPossession,false);
     assert.equal(interrupted.officialMatchResult,null);
     assert.equal(interrupted.realRapierInterruptionObserved,
      ['opponent-shoe','teammate-shoe','ambiguous-shoes'].includes(
       interrupted.reason));
    }
    if(obs.measuredWindows>windowCount){
     assert.equal(obs.measuredWindows,windowCount+1);
     const proof=obs.latestMeasuredWindow;
     assert.ok(proof.team==='home'||proof.team==='away');
     assert.equal(proof.secondShoeTick,tick);
     assert.equal(proof.sameActorGenuineContactPair,true);
     assert.equal(proof.physicalRapierProofOnly,true);
     assert.equal(proof.dribbleConfirmed,null);
     assert.equal(proof.ballControlConfirmed,null);
     assert.equal(proof.officialMatchResult,null);
     assert.ok(proof.sampledFrames>2);
     assert.ok(proof.nearFrames>=1);
     assert.ok(proof.nearFrameFraction>0&&proof.nearFrameFraction<=1);
     assert.equal(proof.nearFrames+proof.farFrames,proof.sampledFrames);
     assert.ok(proof.ballBehindActorFrames>=0);
     assert.ok(proof.ballBehindActorFrames<=proof.sampledFrames);
     assert.ok(proof.lateralSeparatedFrames>=0);
     assert.ok(proof.lateralSeparatedFrames<=proof.sampledFrames);
     assert.ok(proof.maxConsecutiveFarFrames<=proof.farFrames);
     assert.ok(proof.maxConsecutiveFarFrames>=0);
     assert.equal(proof.lateralDiagnosticBandM,0.75);
     assert.ok(proof.minGapM<=1.25);
     assert.ok(proof.maxGapM>=proof.minGapM);
     assert.ok(proof.averageGapM>=proof.minGapM-1e-7);
     assert.ok(proof.averageGapM<=proof.maxGapM+1e-7);
     assert.ok(proof.measuredActorPathM>0.01,
      'player actually moves during the observed physical carry window');
     assert.ok(proof.measuredBallPath3DM>=0.2);
     assert.ok(proof.measuredAttackingProgressM>=0.2);
     const verified=f.physicalCarryContactSequence.latestVerifiedGroundCarryRecontact;
     assert.equal(proof.engineId,verified.engineId);
     assert.equal(proof.firstShoeTick,verified.firstShoeTick);
     assert.equal(proof.shoeEndTick,verified.shoeEndTick);
     assert.equal(proof.secondShoeTick,verified.secondShoeTick);
     if(proof.team===c.team&&!firstWindow)firstWindow=proof;
     windowCount++;
    }
   }
   assert.ok(firstWindow,'real HOME/AWAY physical carry MUST yield a measured gap window');
   assert.ok(windowCount>=1);
   // A physical carry scenario can legitimately contain ZERO opponent shoe
   // STARTs. Do not manufacture one, force a duel, or mistake proximity
   // to opposing actors for physical contact. The independent C3.1
   // natural-contact fixture tests real opposing shoe events separately.
   const last=a.snapshot().physicalCarryProximity;
   evidence.push({team:c.team,measuredWindows:windowCount,realOpposingStarts,
    realOpponentInterruptions,realTeammateInterruptions,
    firstWindow,final: {measuredWindows:last.measuredWindows,
      interruptedWindows:last.interruptedWindows}});
  }finally{a.dispose();b.dispose();}
 }
 console.log('C3_3A_REAL_RAPIER_CARRY_PROXIMITY_DIAGNOSTIC',JSON.stringify(evidence));
});

test('C3.3a real no-contact ball cannot create proximity or possession evidence',async()=>{
 const R=await initializeRapier(rapier);
 const f=createPhysicalFixtureStepRuntime(R,fixture('FR'),{
  preset:'drop',seed:'c3-3a-no-contact',
  x:0,y:28,z:4,vx:0,vy:0,vz:0
 },{autonomousActions:true,autonomousCarry:true});
 try{
  for(let t=1;t<=75;t++){
   const obs=f.step().physicalCarryProximity;
   assert.equal(obs.measuredWindows,0);
   assert.equal(obs.latestMeasuredWindow,null);
   assert.equal(obs.activeMeasurement,null);
   assert.equal(obs.dribbleConfirmed,null);
  }
 }finally{f.dispose();}
});

const options=Object.freeze({autonomousActions:true,autonomousCarry:true});
const nonOfficial=f=>{
 assert.equal(f.physicalCarryProximity.dribbleConfirmed,null);
 assert.equal(f.physicalCarryContactSequence.dribbleConfirmed,null);
 assert.equal(f.physicalCarryProximity.officialMatchPossession,false);
 assert.equal(f.physicalCarryContactSequence.officialMatchPossession,false);
 assert.equal(f.officialMatchResult,null);
 assert.equal(f.productionScoringConnected,false);
};
const replay=(R,country,scenario)=>{
 const a=createPhysicalFixtureStepRuntime(R,fixture(country),scenario,options);
 const b=createPhysicalFixtureStepRuntime(R,fixture(country),scenario,options);
 return {a,b,dispose(){a.dispose();b.dispose();}};
};

test('C3.4a HOME/AWAY two real carry STARTs with genuine END and live co-motion replay, no dribble verdict',async()=>{
 const R=await initializeRapier(rapier);
 for(const side of [
  {team:'home',country:'IT',x:-4.96,vx:0.3},
  {team:'away',country:'DE',x:4.96,vx:-0.3}
 ]){
  const scenario={preset:'roll',seed:'c3-2a-real-'+side.team,
   x:side.x,y:0,z:0,vx:side.vx,vy:0,vz:0};
  const {a,b,dispose}=replay(R,side.country,scenario);
  let previousCount=0,proof=null;
  try{
   for(let tick=1;tick<=600;tick++){
    const fa=a.step(),fb=b.step();
    const p=fa.physicalCarryProximity,s=fa.physicalCarryContactSequence;
    assert.deepEqual(fa.physicalContactFeed,fb.physicalContactFeed,
     'independent 60Hz actual shoe/ball contacts must match');
    assert.deepEqual(p,fb.physicalCarryProximity,
     'independent physical actor-ball co-motion must match');
    assert.deepEqual(s,fb.physicalCarryContactSequence,
     'independent real repeated shoe STARTs must match');
    nonOfficial(fa);
    if(p.measuredWindows>previousCount){
     assert.equal(p.measuredWindows,previousCount+1);
     previousCount=p.measuredWindows;
     const w=p.latestMeasuredWindow,r=s.latestVerifiedGroundCarryRecontact;
     assert.equal(w.engineId,r.engineId);
     assert.equal(w.firstShoeTick,r.firstShoeTick);
     assert.equal(w.shoeEndTick,r.shoeEndTick);
     assert.equal(w.secondShoeTick,r.secondShoeTick);
     assert.ok(w.firstShoeTick<w.shoeEndTick&&w.shoeEndTick<w.secondShoeTick);
     assert.equal(fa.physicalContactFeed.started.length,1);
     assert.equal(fa.physicalContactFeed.started[0].engineId,w.engineId);
     assert.equal(fa.localAutonomousAction?.action,'carry');
     assert.equal(r.secondRealBoundedCarryImpulseApplied,true);
     assert.ok(w.measuredActorPathM>0.01);
     assert.ok(w.measuredBallPath3DM>=0.2);
     assert.ok(w.measuredAttackingProgressM>=0.2);
     assert.equal(w.nearFrames+w.farFrames,w.sampledFrames);
     assert.ok(w.nearFrames>0);
     assert.equal(w.dribbleConfirmed,null);
     assert.equal(w.officialMatchPossession,false);
     if(w.team===side.team){proof={team:w.team,tick,actor:w.engineId};break;}
    }
   }
   assert.ok(proof,'real '+side.team+' clean same-player Rapier carry window required');
  }finally{dispose();}
 }
});

test('C3.4a real AWAY prior-carry window is physically interrupted by HOME rival, not clean dribble',async()=>{
 const R=await initializeRapier(rapier);
 const scenario={preset:'roll',seed:'c3-3k-oblique-away-1-1',
  x:8,y:-3,z:0,vx:-0.48,vy:0.2,vz:0};
 const {a,b,dispose}=replay(R,'DE',scenario);
 let witnessed=null;
 try{
  for(let tick=1;tick<=280;tick++){
   const before=a.snapshot().physicalCarryProximity;
   const fa=a.step(),fb=b.step();
   const p=fa.physicalCarryProximity,feed=fa.physicalContactFeed;
   assert.deepEqual(p,fb.physicalCarryProximity);
   assert.deepEqual(feed,fb.physicalContactFeed);
   nonOfficial(fa);
   if(p.interruptedWindows>before.interruptedWindows&&
      p.latestInterruptedWindow.reason==='opponent-shoe'&&
      p.latestInterruptedWindow.team==='away'&&
      p.latestInterruptedWindow.otherPhysicalShoeIds.includes('home-10')){
    const i=p.latestInterruptedWindow;
    assert.equal(p.measuredWindows,before.measuredWindows,
     'an opposing shoe START must never manufacture a clean carry window');
    assert.ok(feed.started.some(shoe=>
     shoe.engineId==='home-10'&&shoe.team==='home'));
    assert.ok(feed.active.some(shoe=>
     shoe.engineId==='home-10'&&shoe.team==='home'));
    assert.equal(i.realRapierInterruptionObserved,true);
    assert.equal(i.dribbleConfirmed,null);
    assert.equal(i.officialMatchPossession,false);
    witnessed={tick,carrier:i.engineId,first:i.firstShoeTick,
     interruption:i.reason};
    break;
   }
  }
  assert.deepEqual(witnessed,{tick:261,carrier:'away-10',
   first:190,interruption:'opponent-shoe'},
   'independent real physical worlds must match the exact AWAY interruption');
 }finally{dispose();}
});

test('C3.4a a ball with no physical shoe event has zero carry-chain evidence',async()=>{
 const R=await initializeRapier(rapier);
 const scenario={preset:'drop',seed:'c3-4a-no-contact',
  x:0,y:28,z:4,vx:0,vy:0,vz:0};
 const {a,b,dispose}=replay(R,'FR',scenario);
 try{
  for(let tick=1;tick<=75;tick++){
   const f=a.step(),g=b.step();
   assert.deepEqual(f.physicalCarryProximity,g.physicalCarryProximity);
   assert.equal(f.physicalCarryProximity.measuredWindows,0);
   assert.equal(f.physicalCarryProximity.interruptedWindows,0);
   assert.equal(f.physicalCarryProximity.latestMeasuredWindow,null);
   assert.equal(f.physicalCarryProximity.latestInterruptedWindow,null);
   assert.equal(f.physicalCarryContactSequence.authenticatedCarryImpulses,0);
   nonOfficial(f);
  }
 }finally{dispose();}
});
