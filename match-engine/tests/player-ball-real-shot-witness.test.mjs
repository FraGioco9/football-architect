// C2.3b: genuine HOME and AWAY Rapier shoe-origin shots only.
// No mock contacts, no fabricated player relocations, no score claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,FIXED_DT,BALL_RADIUS} from '../src/core.mjs';
import {createPhysicalFixtureStepRuntime} from '../src/physical-fixture-step-runtime.mjs';

const fixture=(country,index)=>Object.freeze({
 id:'season:1:'+country+'-1:N'+String(index).padStart(2,'0')+
  ':'+country+'-1:'+country+'-2',
 competitionId:country+'-1',marker:'N'+String(index).padStart(2,'0'),
 day:index,round:index,homeClubId:country+'-1',awayClubId:country+'-2'
});
const cases=[
 // Two deliberate attack-third STARTING formations: all 22 shoes
 // initialized consistently before tick zero. Rapier alone determines
 // whether an exclusive contact and a shot truly occur.
 {x:30,y:1,vx:0,seed:'c23b-home-attacking-third',
  researchShotAttacker:'home',ticks:110},
 {x:-30,y:-1,vx:0,seed:'c23b-away-attacking-third',
  researchShotAttacker:'away',ticks:110},
 // Real unchanged canonical formations are retained as counterfactuals;
 // no scenario can fake a shoe or an official goal merely by ball location.
 {x:19.96,y:4,vx:0,seed:'c23b-plus-mid',ticks:130},
 {x:-19.96,y:-4,vx:0,seed:'c23b-minus-mid',ticks:130}
];
const scenario=c=>Object.freeze({
 preset:'roll',seed:c.seed,x:c.x,y:c.y,z:0,vx:c.vx,vy:0,vz:0
});
const snapshotShot=frame=>{
 const action=frame.localAutonomousAction;
 if(action?.action!=='shot')return null;
 const source=frame.physicalContactFeed;
 assert.equal(frame.autonomousActionMode,true);
 assert.equal(source.realFootEventsOnly,true);
 assert.equal(source.physicsTick,frame.physicsTick);
 assert.equal(source.started.length,1);
 assert.equal(source.active.length,1);
 assert.equal(source.started[0].engineId,action.playerId);
 assert.equal(source.active[0].engineId,action.playerId);
 assert.equal(source.started[0].team,action.team);
 assert.equal(action.tick,frame.physicsTick);
 assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
 assert.equal(action.appliedByRapier,true);
 assert.equal(action.actualPhysicsImpulseApplied,true);
 assert.equal(action.officialMatchAction,false);
 assert.equal(action.officialMatchPossession,false);
 assert.equal(action.goalScored,undefined);
 assert.equal(frame.ballForceApplied,true);
 assert.equal(frame.officialGoalEvidence,false);
 assert.equal(frame.officialMatchResult,null);
 assert.equal(frame.productionScoringConnected,false);
 assert.ok(action.shotTarget,'authenticated measured shot aim');
 assert.equal(action.shotTarget.shooterId,action.playerId);
 assert.equal(action.shotTarget.physicsTick,frame.physicsTick);
 assert.equal(action.shotTarget.team,action.team);
 assert.equal(action.shotTarget.goalScored,null);
 assert.equal(action.shotTarget.shotOnTarget,null);
 assert.ok(action.shotTarget.laneClearanceM>=2.4);
 assert.ok(Math.abs(action.shotTarget.targetY)<=3.66-BALL_RADIUS);
 assert.equal(action.shotTarget.targetX,action.team==='home'?52.5:-52.5);
 const impulse=Math.hypot(...Object.values(action.impulseNs));
 assert.ok(impulse>0&&impulse<=3.000001);
 assert.ok(action.impulseNs.x*(action.team==='home'?1:-1)>0);
 assert.equal(frame.physicalShotBoundary.active?.shotTick,frame.physicsTick);
 assert.equal(frame.physicalShotBoundary.active?.shooterId,action.playerId);
 assert.equal(frame.physicalShotBoundary.active?.physicalSampleCount,1);
 assert.equal(frame.physicalShotBoundary.active?.goalScored,null);
 assert.equal(frame.physicalBallVolumeBoundary.goalScored,null);
 assert.ok(Object.isFrozen(frame.physicalShotBoundary.active.measuredBallCentres3D));
 return Object.freeze({
  team:action.team,playerId:action.playerId,physicsTick:frame.physicsTick,
  shotTarget:action.shotTarget,impulseNs:action.impulseNs,
  centreAtShot:frame.ball.position
 });
};
test('C2.3b actual 22-player Rapier worlds discover a verified physical shot for BOTH teams',async()=>{
 const R=await initializeRapier(rapier);
 const counts={home:0,away:0},witnesses={},diagnostics=[];
 for(const [i,c] of cases.entries()){
  const f=fixture(i%2?'IT':'ENG',i+1),settings={
   autonomousActions:true,
   ...(c.researchShotAttacker?{researchShotAttacker:c.researchShotAttacker}:{})
  };
  const run=createPhysicalFixtureStepRuntime(R,f,scenario(c),settings);
  if(c.researchShotAttacker){
   const actor=run.snapshot().physicalPlayerPositions.find(p=>
    p.engineId===c.researchShotAttacker+'-10');
   assert.ok(actor,'initial real player is part of the original 22');
   assert.ok(Math.abs(actor.x-c.x)<0.5);
   assert.ok(Math.abs(actor.y-c.y)<0.1);
   assert.deepEqual(run.snapshot().physicalContactFeed.started,[],
    'the preconfigured situation still has NO event at tick zero');
   assert.equal(run.snapshot().localAutonomousAction,null);
  }
  const observedShots=[];
  let lastObserved=null,afterFrames=0,passes=0,contacts=0;
  try{
   for(let tick=1;tick<=c.ticks;tick++){
    const frame=run.step();
    assert.equal(frame.physicsTick,tick);
    assert.ok(Math.abs(frame.elapsedSeconds-tick*FIXED_DT)<1e-8);
    if(frame.localAutonomousAction?.action==='pass')passes++;
    contacts+=frame.physicalContactFeed.started.length;
    const actual=snapshotShot(frame);
    if(actual){
     observedShots.push(actual);
     counts[actual.team]++;
     if(!witnesses[actual.team])witnesses[actual.team]={
      fixture:f,scenario:scenario(c),settings,shot:actual,tick
     };
     lastObserved=actual;
    }else if(lastObserved&&tick===lastObserved.physicsTick+1){
     const shot=frame.physicalShotBoundary.active??
       frame.physicalShotBoundary.lastResolved;
     assert.ok(shot,'the SAME Rapier shot has actual post-tick evidence');
     assert.equal(shot.shotTick,lastObserved.physicsTick);
     assert.ok(shot.physicalSampleCount>=2);
     assert.equal(shot.measuredBallCentres3D.length,shot.physicalSampleCount);
     assert.ok(shot.observedPath3DM>=0);
     assert.equal(shot.goalScored,null);
     assert.equal(shot.shotOnTarget,null);
     assert.equal(shot.physicallyObservedOnly,true);
     assert.ok(Object.isFrozen(shot.measuredBallCentres3D));
     afterFrames++;
     lastObserved=null;
    }
   }
   diagnostics.push({x:c.x,y:c.y,
    researchShotAttacker:c.researchShotAttacker??null,
    shots:observedShots.map(x=>({
     team:x.team,player:x.playerId,tick:x.physicsTick,
     targetY:x.shotTarget.targetY
    })),passes,contacts,afterFrames,finalTick:run.snapshot().physicsTick});
  }finally{run.dispose();}
 }
 console.log('C2_3B_REAL_RAPIER_SHOT_DISCOVERY',JSON.stringify({counts,diagnostics}));
 assert.ok(counts.home>0&&counts.away>0,
  'C2.3b requires genuine exclusive-contact HOME and AWAY shots');
 for(const side of ['home','away']){
  const original=witnesses[side];
  assert.ok(original,'a natural shoe + policy shot must exist');
  const a=createPhysicalFixtureStepRuntime(R,original.fixture,original.scenario,
   original.settings);
  const b=createPhysicalFixtureStepRuntime(R,original.fixture,original.scenario,
   original.settings);
  try{
   for(let tick=1;tick<=original.tick+2;tick++){
    const x=a.step(),y=b.step();
    assert.equal(x.canonicalBall,y.canonicalBall);
    assert.deepEqual(x.physicalContactFeed,y.physicalContactFeed);
    assert.deepEqual(x.physicalShotBoundary,y.physicalShotBoundary);
    assert.deepEqual(x.localAutonomousAction,y.localAutonomousAction);
    if(tick===original.tick){
     assert.equal(x.localAutonomousAction.action,'shot');
     assert.equal(x.localAutonomousAction.team,side);
     assert.deepEqual(snapshotShot(x),original.shot);
    }
   }
   const reset=a.reset(),referenceReset=b.reset();
   try{
    for(let tick=1;tick<=original.tick+2;tick++){
     const f=reset.step(),replayed=referenceReset.step();
     assert.equal(f.canonicalBall,replayed.canonicalBall);
     assert.deepEqual(f.physicalShotBoundary,replayed.physicalShotBoundary);
     if(tick===original.tick)
      assert.equal(f.localAutonomousAction?.team,side);
    }
   }finally{reset.dispose();referenceReset.dispose();}
  }finally{a.dispose();b.dispose();}
 }
});
test('C2.3b real noncontact worlds cannot generate authenticated shots or goals',async()=>{
 const R=await initializeRapier(rapier);
 const f=fixture('FR',4);
 const scenario={preset:'drop',seed:'c23b-no-contact',
  x:0,y:28,z:4,vx:0,vy:0,vz:0};
 const a=createPhysicalFixtureStepRuntime(R,f,scenario,{autonomousActions:true});
 const b=createPhysicalFixtureStepRuntime(R,f,scenario);
 try{
  for(let i=1;i<=75;i++){
   const x=a.step(),y=b.step();
   assert.equal(x.localAutonomousAction,null);
   assert.equal(x.physicalShotBoundary.active,null);
   assert.equal(x.physicalShotBoundary.lastResolved,null);
   assert.equal(y.physicalShotBoundary.active,null);
   assert.equal(x.officialMatchResult,null);
   assert.equal(y.officialMatchResult,null);
   assert.equal(x.physicalBallVolumeBoundary.goalScored,null);
  }
 }finally{a.dispose();b.dispose();}
});


test('C2.3b isolated research formation option rejects spoofing or ordinary ungrounded worlds',async()=>{
 const R=await initializeRapier(rapier);
 const f=fixture('FR',7);
 const real={preset:'roll',seed:'research-only',
  x:30,y:1,z:0,vx:0,vy:0,vz:0};
 for(const options of [
  {researchShotAttacker:'home'},
  {autonomousActions:true,researchShotAttacker:'referee'},
  {autonomousActions:true,researchShotAttacker:false},
  {autonomousActions:true,researchShotAttacker:null},
  {autonomousActions:true,researchShotAttacker:123}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(R,f,real,options),
  /canonical-shaped|never accepts|Untrusted|Isolated|grounded|Universal ball|Closed|trusted|Valid|research/i);
 for(const invalidBall of [
  {...real,x:0},{...real,x:46},{...real,y:20},
  {...real,z:2},{...real,preset:'launch'}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(R,f,invalidBall,{
  autonomousActions:true,researchShotAttacker:'home'
 }),/canonical-shaped|Valid|attacking|Universal|grounded|Isolated|research|closed/i);
});
