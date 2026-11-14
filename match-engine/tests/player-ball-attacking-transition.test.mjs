// C2.3c: physical normal-formation attacking support AFTER a real pass.
// No scripted starting attackers, fake shoe events, or shot/goal claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {INITIAL_PLAYERS,observedFixtureAttackSupportRun,
 PLAYER_POST_PASS_ATTACK_RUN_MAX_TICKS}
 from '../src/player-movement.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const authenticatedPass=team=>Object.freeze({
 action:'pass',team,playerId:team+'-10',recipientId:team+'-7',
 tick:1,appliedByRapier:true,actualPhysicsImpulseApplied:true,
 physicalTrigger:'same-tick-real-rapier-shoe-start',
 officialMatchAction:false,
 passTarget:Object.freeze({
  physicsTick:1,originPlayerId:team+'-10',
  recipientId:team+'-7',team
 })
});
const choose=(team,overrides={})=>observedFixtureAttackSupportRun({
 players:INITIAL_PLAYERS,ball:{x:0,y:0},
 pass:authenticatedPass(team),physicsTick:2,...overrides
});

test('C2.3c real-pass-only off-ball support chooses live upfield forward for BOTH teams',()=>{
 assert.equal(PLAYER_POST_PASS_ATTACK_RUN_MAX_TICKS,240);
 for(const team of ['home','away']){
  const direction=team==='home'?1:-1;
  const a=choose(team);
  assert.ok(a);
  assert.equal(a.team,team);
  assert.equal(a.physicsTick,2);
  assert.equal(a.sourcePassTick,1);
  assert.equal(a.source,'prior-authenticated-exclusive-rapier-pass');
  assert.ok(INITIAL_PLAYERS.some(p=>p.id===a.playerId&&
   p.team===team&&p.role==='forward'));
  assert.notEqual(a.playerId,team+'-10');
  assert.notEqual(a.playerId,team+'-7');
  assert.equal(a.target.x,direction*14);
  assert.equal(Math.abs(a.target.y),8);
  assert.equal(a.footballActionExecuted,false);
  assert.equal(a.officialMatchPossession,false);
  assert.equal(a.officialMatchResult,null);
  assert.equal(a.passCompleted,null);
  assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.target));
  const same=choose(team,{incumbentId:a.playerId,ball:{x:6,y:3}});
  assert.equal(same.playerId,a.playerId);
  assert.equal(same.target.x,6+direction*14);
  assert.equal(same.target.y,
   a.target.y<0?3-8:3+8);
  assert.equal(choose(team,{
   physicsTick:1+PLAYER_POST_PASS_ATTACK_RUN_MAX_TICKS+1
  }),null);
 }
 assert.equal(observedFixtureAttackSupportRun({
  players:INITIAL_PLAYERS,ball:{x:0,y:0},
  pass:null,physicsTick:2
 }),null);
});

test('C2.3c forged, off-tick, wrong-side and contested pass intent cannot start an attacking run',()=>{
 const original=authenticatedPass('home');
 for(const pass of [
  {...original,appliedByRapier:false},
  {...original,actualPhysicsImpulseApplied:false},
  {...original,physicalTrigger:'mock-contact'},
  {...original,officialMatchAction:true},
  {...original,passTarget:{...original.passTarget,physicsTick:3}},
  {...original,passTarget:{...original.passTarget,team:'away'}},
  {...original,recipientId:'away-7'},
  {...original,playerId:'away-10'}
 ])assert.throws(()=>observedFixtureAttackSupportRun({
  players:INITIAL_PLAYERS,ball:{x:0,y:0},
  pass,physicsTick:2
 }),/Authenticated preceding/);
 assert.throws(()=>choose('home',{physicsTick:1}),/Authenticated preceding/);
 assert.throws(()=>choose('home',{ball:{x:NaN,y:0}}),/Authenticated preceding/);
 assert.equal(choose('home',{excludedIds:['home-9','home-11']}),null,
  'no available unassigned same-team forward must never fabricate a runner');
});

test('C2.3c real default-formation 11v11 Rapier passes trigger upfield runners on both teams',async()=>{
 const R=await initializeRapier(rapier);
 const cases=[
  {team:'home',country:'IT',x:-4.96,vx:0.3},
  {team:'away',country:'DE',x:4.96,vx:-0.3}
 ];
 const output={};
 for(const c of cases){
  const fixture=Object.freeze({
   id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
   competitionId:c.country+'-1',marker:'N01',day:1,round:1,
   homeClubId:c.country+'-1',awayClubId:c.country+'-2'
  });
  const scenario=Object.freeze({
   preset:'roll',seed:'c23c-default-formation-'+c.team,
   x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
  });
  const opts={autonomousActions:true};
  const a=createPhysicalFixtureStepRuntime(R,fixture,scenario,opts);
  const independent=createPhysicalFixtureStepRuntime(R,fixture,scenario,opts);
  let firstPass=null,firstRun=null,runFrames=0,forwardAdvanceM=0;
  const direction=c.team==='home'?1:-1;
  try{
   const before=a.snapshot();
   assert.equal(before.contactDecisionObservation.attackSupportRun,null);
   assert.equal(before.localAutonomousAction,null);
   // Unlike C2.3b there is NO manually positioned forward.
   for(let i=0;i<22;i++){
    const p=before.physicalPlayerPositions[i],canonical=INITIAL_PLAYERS[i];
    assert.equal(p.engineId,canonical.id);
    assert.equal(p.x,canonical.x);
    assert.equal(p.y,canonical.y);
   }
   for(let tick=1;tick<=220;tick++){
    const x=a.step(),y=independent.step();
    assert.deepEqual(x,y,'independent actual Rapier+autonomous worlds replay');
    assert.equal(x.physicsTick,tick);
    assert.equal(x.officialMatchResult,null);
    assert.equal(x.officialMatchPossession,false);
    assert.equal(x.productionScoringConnected,false);
    const act=x.localAutonomousAction;
    if(act?.action==='pass'&&act.team===c.team&&!firstPass){
     firstPass=act;
     assert.equal(x.physicalContactFeed.started.length,1);
     assert.equal(x.physicalContactFeed.active.length,1);
     assert.equal(x.physicalContactFeed.started[0].engineId,act.playerId);
     assert.equal(act.appliedByRapier,true);
     assert.equal(act.actualPhysicsImpulseApplied,true);
     assert.equal(act.physicalTrigger,'same-tick-real-rapier-shoe-start');
     assert.notEqual(x.contactDecisionObservation.attackSupportRun?.sourcePassTick,
      act.tick,'same-tick pass cannot produce a retroactive support run');
    }
    const run=x.contactDecisionObservation.attackSupportRun;
    if(!run||run.team!==c.team||run.sourcePassTick!==firstPass?.tick)
     continue;
    assert.ok(firstPass,'support run must FOLLOW the authentic pass');
    assert.equal(run.physicsTick,tick);
    assert.ok(run.sourcePassTick<tick);
    assert.equal(run.source,'prior-authenticated-exclusive-rapier-pass');
    assert.equal(run.movementIntentOnly,true);
    assert.ok(['off-ball-support','live-shot-window-ball-approach']
     .includes(run.phase));
    assert.equal(run.possibleShotWindow,
     run.phase==='live-shot-window-ball-approach');
    assert.equal(run.physicalShoeStartObserved,false);
    assert.equal(run.shotExecuted,false);
    assert.equal(run.officialMatchPossession,false);
    assert.equal(run.officialMatchResult,null);
    assert.equal(x.localAutonomousAction?.goalScored??null,null);
    const duty=x.contactDecisionObservation.duties.find(d=>
     d.engineId===run.playerId);
    assert.equal(duty?.movementDuty,'attack-support-intent');
    assert.equal(duty?.team,c.team);
    assert.equal(duty?.actionExecuted,false);
    const actor=x.physicalPlayerPositions.find(p=>p.engineId===run.playerId);
    assert.ok(actor);
    if(!firstRun)firstRun={tick,playerId:actor.engineId,x:actor.x};
    if(firstRun.playerId===actor.engineId){
     forwardAdvanceM=Math.max(forwardAdvanceM,
      direction*(actor.x-firstRun.x));
     runFrames++;
    }
   }
   output[c.team]={firstPassTick:firstPass?.tick,
    firstRunTick:firstRun?.tick,runFrames,forwardAdvanceM};
   assert.ok(firstPass,'default 22-player formation must execute an authentic '+c.team+' pass');
   assert.ok(firstRun,'the actual prior '+c.team+' pass must trigger tactical run');
   assert.ok(runFrames>=12,'observed physical follow-through must last multiple steps');
   assert.ok(forwardAdvanceM>0.5,'actual off-ball forward must move toward opponent goal');
   const restarted=a.reset();
   try{
    for(let tick=1;tick<=Math.min(110,firstRun.tick+65);tick++){
     const z=restarted.step();
     assert.equal(z.physicsTick,tick);
     assert.equal(z.officialMatchResult,null);
     if(tick===firstRun.tick)
      assert.equal(z.contactDecisionObservation.attackSupportRun?.playerId,
       firstRun.playerId);
    }
   }finally{restarted.dispose();}
  }finally{a.dispose();independent.dispose();}
 }
 console.log('C2_3C_DEFAULT_FORMATION_ACTUAL_ATTACKING_RUN',JSON.stringify(output));
});

test('C2.3d bounded near-goal live-ball approach stays an INTENT, not a shot (both teams)',()=>{
 for(const team of ['home','away']){
  const attack=team==='home'?1:-1;
  const chosenId=team+'-11';
  const players=INITIAL_PLAYERS.map(p=>
   p.id===chosenId?{...p,x:attack*20,y:2}:p);
  const at=observedFixtureAttackSupportRun({
   players,ball:{x:attack*21,y:2},pass:authenticatedPass(team),
   physicsTick:2,incumbentId:chosenId
  });
  assert.ok(at,team+' must have an actual unassigned forward');
  assert.equal(at.playerId,chosenId);
  assert.equal(at.phase,'live-shot-window-ball-approach');
  assert.equal(at.possibleShotWindow,true);
  assert.ok(at.liveBallGapM<=12);
  assert.equal(at.target.x,attack*(21-0.26));
  assert.equal(at.target.y,2);
  assert.equal(at.shotExecuted,false);
  assert.equal(at.physicalShoeStartObserved,false);
  assert.equal(at.passCompleted,null);
  assert.equal(at.officialMatchPossession,false);
  assert.equal(at.officialMatchResult,null);
  assert.ok(Object.isFrozen(at)&&Object.isFrozen(at.target));
  for(const ball of [
   {x:attack*15,y:2}, // too far from the goal for a shot
   {x:attack*21,y:22},// outside the admitted shooting width
   {x:attack*37,y:2}  // farther than 12m from the real runner
  ]){
   const inactive=observedFixtureAttackSupportRun({
    players,ball,pass:authenticatedPass(team),
    physicsTick:2,incumbentId:chosenId
   });
   assert.equal(inactive.phase,'off-ball-support');
   assert.equal(inactive.possibleShotWindow,false);
   assert.equal(inactive.shotExecuted,false);
   assert.notDeepEqual(inactive.target,at.target);
  }
  assert.equal(observedFixtureAttackSupportRun({
   players,ball:{x:attack*21,y:2},pass:authenticatedPass(team),
   physicsTick:242,incumbentId:chosenId
  }),null,'intent must expire after the original 240 real ticks');
 }
});

test('C2.3c no actual pass or disabled action policy never yields a phantom attacking run',async()=>{
 const R=await initializeRapier(rapier);
 const fixture={
  id:'season:1:FR-1:N01:FR-1:FR-2',competitionId:'FR-1',
  marker:'N01',day:1,round:1,homeClubId:'FR-1',awayClubId:'FR-2'
 };
 const scenario={preset:'drop',seed:'c23c-noncontact',
  x:0,y:26,z:5,vx:0,vy:0,vz:0};
 for(const opts of [{},{autonomousActions:true}]){
  const a=createPhysicalFixtureStepRuntime(R,fixture,scenario,opts);
  try{
   for(let tick=1;tick<=75;tick++){
    const frame=a.step();
    assert.equal(frame.localAutonomousAction,null);
    assert.equal(frame.contactDecisionObservation.attackSupportRun,null);
    assert.equal(frame.contactDecisionObservation.duties.some(d=>
     d.movementDuty==='attack-support-intent'),false);
    assert.equal(frame.officialMatchResult,null);
   }
  }finally{a.dispose();}
 }
});
