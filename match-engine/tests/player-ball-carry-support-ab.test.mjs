// C2.3l — read-only A/B 22-player physical evidence for BOTH teams.
// Two genuinely independent Rapier worlds per team (baseline/carry relay).
// Original formations, kicks, ball dynamics and official outcomes untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_PITCH} from '../src/player-movement.mjs';
import {SHOT_MAX_RANGE_M} from '../src/player-ball-uniform-autonomous-action.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const CASES=Object.freeze([
 Object.freeze({team:'home',country:'IT',x:-4.96,vx:0.3}),
 Object.freeze({team:'away',country:'DE',x:4.96,vx:-0.3})
]);
const CHECK_TICKS=Object.freeze([292,480,520,532,533,546,547,
 567,600,640,680,690,693,694,695,700,720]);
const TICKS=720;
const rd=x=>Number(x.toFixed(3));
const fixture=country=>Object.freeze({
 id:'season:1:'+country+'-1:N01:'+country+'-1:'+country+'-2',
 competitionId:country+'-1',marker:'N01',day:1,round:1,
 homeClubId:country+'-1',awayClubId:country+'-2'
});
const scene=c=>Object.freeze({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});
const gap=(p,ball)=>Math.hypot(p.x-ball.x,p.y-ball.y);
function measuredActor(frame,id){
 const body=frame.physicalPlayerPositions.find(p=>p.engineId===id);
 const canonical=INITIAL_PLAYERS.find(p=>p.id===id);
 const duty=frame.contactDecisionObservation.duties.find(p=>p.engineId===id);
 assert.ok(body&&canonical&&duty&&body.engineId===canonical.id);
 assert.equal(duty.team,canonical.team);
 return Object.freeze({id,team:canonical.team,
  duty:duty.movementDuty,bodyBallGapM:rd(gap(body,frame.ball.position)),
  x:rd(body.x),y:rd(body.y)});
}
function geometry(frame,team){
 const direction=team==='home'?1:-1,ball=frame.ball.position;
 const distanceToGoalM=PLAYER_PITCH.lengthM/2-direction*ball.x;
 const shotShortfallM=Math.max(0,distanceToGoalM-SHOT_MAX_RANGE_M);
 const withinShotTerritory=distanceToGoalM>0&&
  distanceToGoalM<=SHOT_MAX_RANGE_M&&Math.abs(ball.y)<=20;
 const realActors=frame.physicalPlayerPositions.map((p,i)=>({
  ...p,team:INITIAL_PLAYERS[i].team,role:INITIAL_PLAYERS[i].role}));
 const nearest=side=>realActors.filter(p=>p.team===side&&
  p.role!=='goalkeeper').reduce((a,b)=>!a||gap(b,ball)<gap(a,ball)?b:a,null);
 const other=team==='home'?'away':'home';
 const attacker=nearest(team),defender=nearest(other);
 assert.ok(attacker&&defender);
 return Object.freeze({
  shotShortfallM,withinShotTerritory,
  nearestAttackerId:attacker.engineId,
  nearestAttackerGapM:gap(attacker,ball),
  nearestDefenderId:defender.engineId,
  nearestDefenderGapM:gap(defender,ball),
  ballX:ball.x,ballY:ball.y,ballVx:frame.ball.velocity.x
 });
}
function newSummary(c,mode){
 return {team:c.team,country:c.country,mode,initialBallX:c.x,
  maxGoalwardTravelM:0,minShotShortfallM:null,minShortfallTick:null,
  shotTerritoryFrames:0,nearestAttackerMinGapAfter546M:null,
  nearestDefenderMinGapAfter640M:null,
  authenticShoeStarts:0,genuineActions:[],genuineShots:[],
  verifiedSameTeamSupportFrames:0,postCarrySupportFrames:0,
  firstPostCarrySupport:null,physicalCarryTicks:[],
  checkpoints:[],at693:null,at694:null,finalBall:null};
}
function observe(summary,c,frame){
 const t=frame.physicsTick;
 assert.ok(Number.isSafeInteger(t)&&t>=1&&t<=TICKS);
 assert.equal(frame.officialMatchResult,null);
 assert.equal(frame.officialMatchPossession,false);
 assert.equal(frame.productionScoringConnected,false);
 assert.equal(frame.physicalShotBoundary.goalScored,null);
 assert.equal(frame.physicalBallVolumeBoundary.goalScored,null);
 const g=geometry(frame,c.team),support=frame.contactDecisionObservation.attackSupportRun;
 const forward=c.team==='home'?1:-1;
 summary.maxGoalwardTravelM=Math.max(summary.maxGoalwardTravelM,
  forward*(g.ballX-c.x));
 if(summary.minShotShortfallM===null||
    g.shotShortfallM<summary.minShotShortfallM){
  summary.minShotShortfallM=g.shotShortfallM;
  summary.minShortfallTick=t;
 }
 if(g.withinShotTerritory)summary.shotTerritoryFrames++;
 if(t>=546)summary.nearestAttackerMinGapAfter546M=Math.min(
  summary.nearestAttackerMinGapAfter546M??Infinity,
  g.nearestAttackerGapM);
 if(t>=640)summary.nearestDefenderMinGapAfter640M=Math.min(
  summary.nearestDefenderMinGapAfter640M??Infinity,
  g.nearestDefenderGapM);
 summary.authenticShoeStarts+=frame.physicalContactFeed.started.length;
 for(const shoe of frame.physicalContactFeed.started){
  assert.ok(frame.physicalContactFeed.active.some(x=>
   x.engineId===shoe.engineId&&x.team===shoe.team),
   'a real Rapier shoe START must be ACTIVE in the same frame');
 }
 const act=frame.localAutonomousAction;
 if(act){
  assert.equal(frame.physicalContactFeed.started.length,1);
  assert.equal(frame.physicalContactFeed.active.length,1);
  assert.equal(frame.physicalContactFeed.started[0].engineId,act.playerId);
  assert.equal(frame.physicalContactFeed.started[0].team,act.team);
  assert.equal(act.tick,t);
  assert.equal(act.physicalTrigger,'same-tick-real-rapier-shoe-start');
  assert.equal(act.actualPhysicsImpulseApplied,true);
  assert.equal(act.appliedByRapier,true);
  assert.equal(act.officialMatchAction,false);
  summary.genuineActions.push(Object.freeze({
   tick:t,id:act.playerId,team:act.team,action:act.action}));
  if(act.action==='carry'&&act.team===c.team)
   summary.physicalCarryTicks.push(t);
  if(act.action==='shot'){
   assert.ok(act.shotTarget&&act.shotTarget.shooterId===act.playerId);
   assert.equal(act.shotTarget.physicsTick,t);
   summary.genuineShots.push(Object.freeze({
    tick:t,playerId:act.playerId,team:act.team,
    shotTargetY:rd(act.shotTarget.targetY),
    officialGoalScored:null}));
  }
 }
 if(support?.team===c.team){
  summary.verifiedSameTeamSupportFrames++;
  assert.equal(support.physicalShoeStartObserved,false);
  assert.equal(support.shotExecuted,false);
  assert.equal(support.officialMatchResult,null);
 }
 if(support?.phase==='post-carry-support'){
  assert.equal(summary.mode,'carry-relay-enabled');
  assert.equal(support.possibleShotWindow,false);
  assert.equal(support.carryContinuation.team,support.team);
  assert.ok(support.carryContinuation.sourceCarryTick<t);
  assert.ok(t-support.carryContinuation.sourceCarryTick<=150);
  assert.ok(t-support.sourcePassTick>240&&t-support.sourcePassTick<=480);
  assert.equal(frame.contactDecisionObservation.duties.find(p=>
   p.engineId===support.playerId)?.movementDuty,'attack-support-intent');
  if(support.team===c.team){
   summary.postCarrySupportFrames++;
   if(!summary.firstPostCarrySupport)summary.firstPostCarrySupport=Object.freeze({
    tick:t,id:support.playerId,
    passTick:support.sourcePassTick,
    carryTick:support.carryContinuation.sourceCarryTick});
  }
 }
 if(CHECK_TICKS.includes(t)){
  const defenderTeam=c.team==='home'?'away':'home';
  const selected=[c.team+'-9',c.team+'-10',defenderTeam+'-7']
   .map(id=>measuredActor(frame,id));
  const checkpoint=Object.freeze({
   tick:t,ballX:rd(g.ballX),ballY:rd(g.ballY),
   ballVx:rd(g.ballVx),shotShortfallM:rd(g.shotShortfallM),
   shotTerritory:g.withinShotTerritory,
   nearestAttacker:Object.freeze({id:g.nearestAttackerId,
    gapM:rd(g.nearestAttackerGapM)}),
   nearestDefender:Object.freeze({id:g.nearestDefenderId,
    gapM:rd(g.nearestDefenderGapM)}),
   focus:Object.freeze(selected),
   support:support?Object.freeze({team:support.team,
    playerId:support.playerId,phase:support.phase,
    sourcePassTick:support.sourcePassTick,
    sourceCarryTick:support.carryContinuation?.sourceCarryTick??null}):null,
   realShoeStarts:Object.freeze(frame.physicalContactFeed.started.map(s=>s.engineId)),
   realAction:act?Object.freeze({
    team:act.team,id:act.playerId,kind:act.action}):null,
   postStepGeometryOnly:true,noOfficialOutcomeInferred:true
  });
  summary.checkpoints.push(checkpoint);
  if(t===693)summary.at693=checkpoint;
  if(t===694)summary.at694=checkpoint;
 }
 if(t===TICKS)summary.finalBall=Object.freeze({
  x:rd(g.ballX),y:rd(g.ballY),vx:rd(g.ballVx)
 });
}
function compact(s){
 return Object.freeze({
  team:s.team,mode:s.mode,
  maxGoalwardTravelM:rd(s.maxGoalwardTravelM),
  minShotShortfallM:rd(s.minShotShortfallM),
  minShortfallTick:s.minShortfallTick,
  shotTerritoryFrames:s.shotTerritoryFrames,
  nearestAttackerMinGapAfter546M:rd(s.nearestAttackerMinGapAfter546M),
  nearestDefenderMinGapAfter640M:rd(s.nearestDefenderMinGapAfter640M),
  verifiedSameTeamSupportFrames:s.verifiedSameTeamSupportFrames,
  postCarrySupportFrames:s.postCarrySupportFrames,
  firstPostCarrySupport:s.firstPostCarrySupport,
  authenticShoeStarts:s.authenticShoeStarts,
  physicalCarryTicks:s.physicalCarryTicks,
  genuineActions:s.genuineActions,
  genuineShots:s.genuineShots,
  focusCheckpoints:s.checkpoints.filter(x=>
   [532,533,546,547,600,680,693,694,720].includes(x.tick)),
  finalBall:s.finalBall
 });
}
test('C2.3l mirrored physical 720-tick baseline vs carry-support A/B, both teams',async()=>{
 const R=await initializeRapier(rapier),out=[];
 for(const c of CASES){
  const scenario=scene(c),id=fixture(c.country);
  const baseline=createPhysicalFixtureStepRuntime(R,id,scenario,
   {autonomousActions:true,autonomousCarry:true});
  const relay=createPhysicalFixtureStepRuntime(R,id,scenario,
   {autonomousActions:true,autonomousCarry:true,
    autonomousCarrySupport:true});
  const plain=newSummary(c,'baseline'),enhanced=newSummary(c,'carry-relay-enabled');
  let firstPhysicalDivergenceTick=null,firstObservedRelayTick=null;
  try{
   const p=baseline.snapshot(),q=relay.snapshot();
   assert.equal(p.physicsTick,0);
   assert.equal(q.physicsTick,0);
   assert.equal(p.autonomousCarrySupportMode,undefined);
   assert.equal(q.autonomousCarrySupportMode,true);
   assert.equal(p.localAutonomousAction,null);
   assert.equal(q.localAutonomousAction,null);
   assert.deepEqual(p.physicalPlayerPositions,q.physicalPlayerPositions,
    'initial canonical 22 bodies must be identical');
   for(let i=0;i<INITIAL_PLAYERS.length;i++){
    assert.equal(p.physicalPlayerPositions[i].engineId,INITIAL_PLAYERS[i].id);
    assert.equal(p.physicalPlayerPositions[i].x,INITIAL_PLAYERS[i].x);
    assert.equal(p.physicalPlayerPositions[i].y,INITIAL_PLAYERS[i].y);
   }
   for(let t=1;t<=TICKS;t++){
    const a=baseline.step(),b=relay.step();
    assert.equal(a.physicsTick,t);
    assert.equal(b.physicsTick,t);
    const activeRelay=b.contactDecisionObservation.attackSupportRun
     ?.phase==='post-carry-support';
    if(activeRelay&&firstObservedRelayTick===null)
     firstObservedRelayTick=t;
    // A new movement relay cannot retroactively affect preceding physics.
    if(firstObservedRelayTick===null){
     assert.deepEqual(a.ball,b.ball,'physical ball changes before verified carry relay');
     assert.deepEqual(a.physicalPlayerPositions,b.physicalPlayerPositions,
      'actor world changes before verified carry relay');
     assert.deepEqual(a.localAutonomousAction,b.localAutonomousAction,
      'authentic shoe action changes before verified carry relay');
     assert.deepEqual(a.physicalContactFeed,b.physicalContactFeed,
      'contact stream changes before verified carry relay');
     assert.deepEqual(a.contactDecisionObservation.duties,
      b.contactDecisionObservation.duties,
      'movement duties change before real carry relay');
    }
    if(firstPhysicalDivergenceTick===null&&(
      JSON.stringify(a.ball)!==JSON.stringify(b.ball)||
      JSON.stringify(a.physicalPlayerPositions)!==
       JSON.stringify(b.physicalPlayerPositions)
    ))firstPhysicalDivergenceTick=t;
    observe(plain,c,a);observe(enhanced,c,b);
   }
   assert.deepEqual(plain.checkpoints.map(x=>x.tick),CHECK_TICKS);
   assert.deepEqual(enhanced.checkpoints.map(x=>x.tick),CHECK_TICKS);
   assert.equal(plain.postCarrySupportFrames,0);
   assert.equal(plain.firstPostCarrySupport,null);
   assert.ok(plain.authenticShoeStarts>0&&enhanced.authenticShoeStarts>0);
   if(c.team==='away'){
    // Immutable C2.3j natural baseline, *not* an opt-in claim.
    assert.ok(Math.abs(plain.at693.shotShortfallM-0.681)<0.002);
    assert.deepEqual(plain.at694.realAction,
     {team:'home',id:'home-7',kind:'pass'});
    assert.ok(enhanced.postCarrySupportFrames>0);
    assert.equal(enhanced.firstPostCarrySupport.tick,547);
    assert.ok(firstPhysicalDivergenceTick>=firstObservedRelayTick);
   }
   out.push(Object.freeze({
    team:c.team,firstObservedRelayTick,firstPhysicalDivergenceTick,
    baseline:compact(plain),carrySupport:compact(enhanced),
    delta:Object.freeze({
     maxGoalwardTravelM:rd(enhanced.maxGoalwardTravelM-
      plain.maxGoalwardTravelM),
     minShotShortfallM:rd(enhanced.minShotShortfallM-
      plain.minShotShortfallM),
     shotTerritoryFrames:enhanced.shotTerritoryFrames-
      plain.shotTerritoryFrames,
     physicalShoeStarts:enhanced.authenticShoeStarts-
      plain.authenticShoeStarts,
     genuineShots:enhanced.genuineShots.length-plain.genuineShots.length,
     sameTeamSupportFrames:enhanced.verifiedSameTeamSupportFrames-
      plain.verifiedSameTeamSupportFrames
    })
   }));
  }finally{baseline.dispose();relay.dispose();}
 }
 assert.deepEqual(out.map(x=>x.team),['home','away']);
 assert.ok(out.every(x=>x.baseline.mode==='baseline'&&
  x.carrySupport.mode==='carry-relay-enabled'));
 // No forced shot or assumed improvement. Actual Rapier shoe outcomes win.
 console.log('C2_3L_HOME_AWAY_PHYSICAL_BASELINE_VS_CARRY_SUPPORT',
  JSON.stringify(out));
});
