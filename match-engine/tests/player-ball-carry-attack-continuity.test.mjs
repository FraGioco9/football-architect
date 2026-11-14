// C2.3k: real shoe-gated local tactical carry relay, not a goal or shot.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {INITIAL_PLAYERS,observedFixtureAttackSupportRun,
 PLAYER_POST_PASS_ATTACK_RUN_MAX_TICKS,
 PLAYER_POST_CARRY_SUPPORT_MAX_TICKS}
 from '../src/player-movement.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const pass=team=>Object.freeze({
 action:'pass',team,playerId:team+'-10',recipientId:team+'-7',tick:1,
 appliedByRapier:true,actualPhysicsImpulseApplied:true,
 physicalTrigger:'same-tick-real-rapier-shoe-start',
 officialMatchAction:false,
 passTarget:Object.freeze({physicsTick:1,originPlayerId:team+'-10',
  recipientId:team+'-7',team})
});
const carry=(team,tick)=>Object.freeze({
 action:'carry',team,playerId:team+'-9',tick,
 appliedByRapier:true,actualPhysicsImpulseApplied:true,
 physicalTrigger:'same-tick-real-rapier-shoe-start',
 officialMatchAction:false,
 carryTarget:Object.freeze({actorId:team+'-9',team,physicsTick:tick,
  shortGroundTouchOnly:true,physicalRecontactObserved:false,
  dribbleConfirmed:null,officialMatchResult:null}),
 impulseNs:Object.freeze({x:0.42,y:0,z:0})
});
const select=(team,override={})=>{
 const dir=team==='home'?1:-1;
 const players=INITIAL_PLAYERS.map(p=>p.id===team+'-11'?
  {...p,x:dir*15,y:3}:p);
 return observedFixtureAttackSupportRun({
  players,ball:{x:dir*14,y:3},pass:pass(team),physicsTick:245,
  carry:carry(team,243),incumbentId:team+'-11',...override
 });
};
test('C2.3k bounded mirrored pure real-source contract and invalid source rejection',()=>{
 assert.equal(PLAYER_POST_PASS_ATTACK_RUN_MAX_TICKS,240);
 assert.equal(PLAYER_POST_CARRY_SUPPORT_MAX_TICKS,150);
 for(const team of ['home','away']){
  const run=select(team);
  assert.ok(run,team+' must have available genuine-carry support');
  assert.equal(run.phase,'post-carry-support');
  assert.equal(run.possibleShotWindow,false);
  assert.equal(run.carryContinuation.sourceCarryTick,243);
  assert.equal(run.carryContinuation.carrierId,team+'-9');
  assert.equal(run.target.x,(team==='home'?1:-1)*16);
  assert.equal(run.physicalShoeStartObserved,false);
  assert.equal(run.shotExecuted,false);
  assert.equal(run.officialMatchPossession,false);
  assert.equal(run.officialMatchResult,null);
  assert.ok(Object.isFrozen(run)&&Object.isFrozen(run.carryContinuation));
  assert.equal(select(team,{carry:null}),null);
  assert.equal(select(team,{physicsTick:482}),null);
  assert.equal(select(team,{ball:{x:0,y:24}}),null);
  assert.equal(select(team,{ball:{x:0,y:0}}),null);
  const genuine=carry(team,243);
  for(const forged of [
   {...genuine,team:team==='home'?'away':'home'},
   {...genuine,actualPhysicsImpulseApplied:false},
   {...genuine,physicalTrigger:'synthetic-shoe'},
   {...genuine,carryTarget:{...genuine.carryTarget,physicsTick:0}},
   {...genuine,impulseNs:{x:5,y:0,z:0}},
   {...genuine,tick:1}
  ])assert.throws(()=>select(team,{carry:forged}),
   /genuine later same-team Rapier carry/);
  assert.equal(select(team,{physicsTick:394}),null,
   'authentic 151-tick-old carry has no tactical authority');
  assert.equal(select(team,{physicsTick:395}),null);
  const priorCarry={...genuine,tick:1,
   carryTarget:{...genuine.carryTarget,physicsTick:1}};
  assert.equal(select(team,{carry:priorCarry}),null,
   'pre-PASS carry cannot authorize a later relay');
  assert.throws(()=>select(team,{carry:{...genuine,tick:245,
   carryTarget:{...genuine.carryTarget,physicsTick:245}}}),
   /genuine later same-team Rapier carry/,
   'same-tick/future physical carry is still untrusted');
  assert.throws(()=>select(team,{physicsTick:200,carry:genuine}),
   /Post-carry continuation/);
 }
});
test('C2.3k opt-in sealed; independent natural 720-tick real 22-player Rapier replay',async()=>{
 const R=await initializeRapier(rapier);
 const fixture={id:'season:1:DE-1:N01:DE-1:DE-2',
  competitionId:'DE-1',marker:'N01',day:1,round:1,
  homeClubId:'DE-1',awayClubId:'DE-2'};
 const scenario={preset:'roll',seed:'c2-3e-natural-physical-away-DE',
  x:4.96,y:0,z:0,vx:-0.3,vy:0,vz:0};
 for(const bad of [
  {autonomousCarrySupport:true},
  {autonomousActions:true,autonomousCarrySupport:true},
  {autonomousActions:true,autonomousCarry:true,autonomousCarrySupport:false}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(R,fixture,scenario,bad));
 const options={autonomousActions:true,autonomousCarry:true,
  autonomousCarrySupport:true};
 const a=createPhysicalFixtureStepRuntime(R,fixture,scenario,options);
 const b=createPhysicalFixtureStepRuntime(R,fixture,scenario,options);
 let realPass=false,realCarry=false,relayFrames=0,firstRelay=null,realShots=0;
 try{
  assert.deepEqual(a.snapshot(),b.snapshot());
  for(let tick=1;tick<=720;tick++){
   const x=a.step(),y=b.step();
   assert.deepEqual(x,y,'independent genuine 22-player Rapier tick '+tick);
   assert.equal(x.autonomousCarrySupportMode,true);
   assert.equal(x.physicsTick,tick);
   assert.equal(x.officialMatchResult,null);
   assert.equal(x.officialMatchPossession,false);
   assert.equal(x.productionScoringConnected,false);
   const action=x.localAutonomousAction;
   if(action){
    assert.equal(x.physicalContactFeed.started.length,1);
    assert.equal(x.physicalContactFeed.active.length,1);
    assert.equal(x.physicalContactFeed.started[0].engineId,action.playerId);
    assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
    if(action.action==='pass'&&action.team==='away')realPass=true;
    if(action.action==='carry'&&action.team==='away'&&realPass)realCarry=true;
    if(action.action==='shot')realShots++;
   }
   const support=x.contactDecisionObservation.attackSupportRun;
   if(support?.phase!=='post-carry-support')continue;
   assert.equal(support.team,'away');
   assert.ok(realPass&&realCarry);
   assert.ok(tick-support.sourcePassTick>240);
   assert.ok(tick-support.carryContinuation.sourceCarryTick<=150);
   assert.ok(tick-support.carryContinuation.sourceCarryTick<tick);
   assert.equal(support.carryContinuation.team,'away');
   assert.equal(support.possibleShotWindow,false);
   assert.equal(support.shotExecuted,false);
   assert.equal(support.officialMatchResult,null);
   assert.equal(x.contactDecisionObservation.duties.find(d=>
    d.engineId===support.playerId)?.movementDuty,'attack-support-intent');
   relayFrames++;
   if(!firstRelay)firstRelay={tick,playerId:support.playerId,
    sourcePassTick:support.sourcePassTick,
    sourceCarryTick:support.carryContinuation.sourceCarryTick};
  }
  assert.ok(realPass&&realCarry,'genuine AWAY pass and carry required');
  assert.ok(relayFrames>0,'real same-team carry must relay into eligible support');
  const reset=a.reset();
  try{
   assert.equal(reset.snapshot().physicsTick,0);
   assert.equal(reset.snapshot().contactDecisionObservation.attackSupportRun,null);
   for(let i=0;i<60;i++)reset.step();
  }finally{reset.dispose();}
 }finally{a.dispose();b.dispose();}
 console.log('C2_3K_REAL_RAPIER_CARRY_SUPPORT',JSON.stringify({
  firstRelay,relayFrames,realShots,realPass,realCarry
 }));
});

test('C2-a DEV attack continuity: genuine post-PASS/CARRY Rapier replay',async()=>{
 const R=await initializeRapier(rapier);
 const fixture={id:'season:1:DE-1:N01:DE-1:DE-2',
  competitionId:'DE-1',marker:'N01',day:1,round:1,
  homeClubId:'DE-1',awayClubId:'DE-2'};
 const scenario={preset:'roll',seed:'c2-3e-natural-physical-away-DE',
  x:4.96,y:0,z:0,vx:-0.3,vy:0,vz:0};
 const base={autonomousActions:true,autonomousCarry:true,
  autonomousCarrySupport:true,autonomousCarrySupportPressHandoff:true};
 for(const bad of [{autonomousCarryAttackContinuity:true},
  {...base,autonomousCarryAttackContinuity:false},
  {autonomousActions:true,autonomousCarry:true,
   autonomousCarrySupport:true,autonomousCarryAttackContinuity:true}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(R,fixture,scenario,bad));
 const candidate={...base,autonomousCarryAttackContinuity:true};
 const worlds=[createPhysicalFixtureStepRuntime(R,fixture,scenario,base),
  createPhysicalFixtureStepRuntime(R,fixture,scenario,candidate),
  createPhysicalFixtureStepRuntime(R,fixture,scenario,candidate)];
 let pass=false,carry=false,retained=0,first=null,shotCount=0;
 let eligibleFrames=0,baselineSupportFrames=0;
 let baselineDutyConflicts=0,firstEligible=null,firstConflict=null;
 try{
  assert.equal(worlds[1].snapshot().autonomousCarryAttackContinuityMode,true);
  assert.equal(Boolean(worlds[0].snapshot().autonomousCarryAttackContinuityMode),false);
  for(let tick=1;tick<=720;tick++){
   const [prior,real,replay]=worlds.map(w=>w.step());
   assert.deepEqual(real,replay,'independent real 22-player tick '+tick);
   assert.equal(real.officialMatchResult,null);
   assert.equal(real.officialMatchPossession,false);
   const action=real.localAutonomousAction;
   if(action){
    assert.equal(real.physicalContactFeed.started.length,1);
    assert.equal(real.physicalContactFeed.active.length,1);
    assert.equal(real.physicalContactFeed.started[0].engineId,action.playerId);
    assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
    if(action.action==='pass'&&action.team==='away')pass=true;
    if(pass&&action.action==='carry'&&action.team==='away')carry=true;
    if(action.action==='shot')shotCount++;
   }
   if(!carry){
    assert.equal(real.canonicalBall,prior.canonicalBall);
    assert.deepEqual(real.physicalPlayerPositions,prior.physicalPlayerPositions);
   }
   const run=real.contactDecisionObservation.attackSupportRun;
   if(run?.phase!=='post-carry-support')continue;
   assert.ok(pass&&carry);
   assert.equal(run.carryContinuation.team,'away');
   assert.ok(tick-run.sourcePassTick>240);
   assert.ok(tick-run.carryContinuation.sourceCarryTick<=150);
   assert.equal(real.contactDecisionObservation.duties.find(d=>
    d.engineId===run.playerId)?.movementDuty,'attack-support-intent');
   eligibleFrames++;
   if(!firstEligible)firstEligible={tick,playerId:run.playerId};
   const original=prior.contactDecisionObservation.attackSupportRun;
   if(original?.phase==='post-carry-support')baselineSupportFrames++;
   const baselineDuty=prior.contactDecisionObservation.duties.find(d=>
    d.engineId===run.playerId)?.movementDuty??null;
   if(baselineDuty!=='attack-support-intent'){
    baselineDutyConflicts++;
    if(!firstConflict)firstConflict={tick,playerId:run.playerId,baselineDuty};
   }
   if(original?.playerId!==run.playerId){
    retained++;
    if(!first)first={tick,playerId:run.playerId,
     baselineDuty:prior.contactDecisionObservation.duties.find(d=>
      d.engineId===run.playerId)?.movementDuty};
   }
  }
  assert.ok(pass&&carry,'real physical PASS and later CARRY source required');
  console.log('C2_A_REAL_RAPIER_HANDOFF_DIAGNOSTICS',JSON.stringify({
   pass,carry,eligibleFrames,baselineSupportFrames,
   baselineDutyConflicts,retained,firstEligible,firstConflict,shotCount
  }));
  // This ordinary-formation AWAY replay is a negative/parity control:
  // a real PASS and later CARRY authorize 148 support frames, but none
  // collides with the selected presser. No change is expected from C2-a
  // when its narrowly scoped precondition never occurs.
  const audit=worlds[1].snapshot().continuityAudit;
  assert.ok(audit.eligible>0,'authentic source-qualified candidates required');
  assert.equal(audit.preHandoffConflicts,0,
   'negative replay must not contain preliminary press collision');
  assert.equal(audit.c23nResolved,0,
   'negative replay has no C2.3n collision to resolve');
  assert.equal(audit.residualConflicts,0,
   'negative replay must not contain residual press collision');
  assert.equal(audit.c2aResolved,0,
   'negative replay must not invoke C2-a reassignment');
  assert.equal(audit.retainedSupport,0,
   'negative replay must not count any retained conflict resolution');
  assert.equal(audit.excludedAfterReassignment,0,
   'negative replay must not lose a forward after C2-a');
  console.log('C2_A_REAL_RAPIER_PRESS_SELECTION_AUDIT',JSON.stringify(audit));
  assert.ok(eligibleFrames>0,'genuine post-carry support must be exercised');
  assert.equal(baselineDutyConflicts,0,
   'this baseline replay must not contain a lost support duty');
  assert.equal(retained,0,
   'continuity opt-in must not change an already healthy handoff');
  const [a,b]=worlds.slice(1).map(w=>w.reset());
  try{
   assert.equal(a.snapshot().autonomousCarryAttackContinuityMode,true);
   assert.equal(a.snapshot().contactDecisionObservation.attackSupportRun,null);
   for(let i=0;i<30;i++)assert.deepEqual(a.step(),b.step());
  }finally{a.dispose();b.dispose();}
 }finally{worlds.forEach(w=>w.dispose());}
 console.log('C2_A_REAL_RAPIER_ATTACK_CONTINUITY',JSON.stringify({
  pass,carry,retained,first,shotCount
 }));
});
