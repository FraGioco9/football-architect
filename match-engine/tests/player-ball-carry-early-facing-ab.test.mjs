// C2.3u — authentic PASS→CARRY-bound early-facing Rapier experiment.
// A distinct DEV opt-in can turn an existing runner's shoe toward the
// PREVIOUS real ball at <=6rad/s; no future look-ahead, forced shoe START,
// extra movement, artificial pass/shot, scoring, or physical shortcut.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {PLAYER_DT,PLAYER_MAX_SPEED_MPS,PLAYER_TURN_RAD_PER_S,
 PLAYER_PITCH,INITIAL_PLAYERS,createPlayerMovement}
 from '../src/player-movement.mjs';
import {SHOT_MAX_RANGE_M}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {measureOrientedCarryShoeBallGeometry}
 from '../src/player-ball-carry-oriented-shoe-geometry.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const CASES=Object.freeze([
 Object.freeze({team:'home',country:'IT',x:-4.96,vx:0.3}),
 Object.freeze({team:'away',country:'DE',x:4.96,vx:-0.3})
]);
const BASE=Object.freeze({
 autonomousActions:true,autonomousCarry:true,autonomousCarrySupport:true,
 autonomousCarrySupportPressHandoff:true,
 autonomousCarrySupportBallAccess:true,
 autonomousCarrySupportLateralAlign:true
});
const OPT=Object.freeze({
 aligned:BASE,
 early:Object.freeze({...BASE,autonomousCarrySupportEarlyFacing:true})
});
const checkpoint=new Set([292,546,547,567,600,634,635,640,650,
 657,660,664,665,675,680,683,693,694,700,720]);
const r3=x=>Number(x.toFixed(3));
const xy=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
const fixture=c=>Object.freeze({
 id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
 competitionId:c.country+'-1',marker:'N01',day:1,round:1,
 homeClubId:c.country+'-1',awayClubId:c.country+'-2'
});
const scene=c=>Object.freeze({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});
function study(R,c,mode){
 const engine=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),OPT[mode]);
 const shadow=createPlayerMovement({
  experimentalAiKickApproach:true,
  experimentalAutonomousFixtureContactChase:true,
  experimentalAutonomousFixtureCarry:true,
  experimentalAutonomousFixtureCarrySupport:true,
  experimentalAutonomousFixtureCarrySupportPressHandoff:true,
  experimentalAutonomousFixtureCarrySupportBallAccess:true,
  experimentalAutonomousFixtureCarrySupportLateralAlign:true,
  ...(mode==='early'?{
   experimentalAutonomousFixtureCarrySupportEarlyFacing:true}:{})
 });
 return {mode,team:c.team,engine,shadow,pass:null,carry:null,
  lastMove:null,
  stats:{earlyFrames:0,firstEarly:null,lastEarly:null,
   sourceBoundAccess:0,maxActualTurnRad:0,
   realShoeSTART:0,newForwardShoeSTART:0,
   physicalAction:[],naturalShots:[],
   minStaticClearanceM:Infinity,minStaticClearanceTick:null,
   maxBallAdvance:0,minShotRangeShortfall:Infinity,
   checkpoints:[]}};
}
function replayStep(s,c){
 const before=s.engine.snapshot(),prior=s.shadow.snapshot();
 const tick=before.physicsTick+1;
 assert.equal(prior.tick,tick-1);
 const moved=s.shadow.step(before.ball.position);
 const frame=s.engine.step();
 s.lastMove=moved;
 assert.equal(frame.physicsTick,tick);
 assert.equal(moved.tick,tick);
 assert.equal(frame.officialMatchResult,null);
 assert.equal(frame.officialMatchPossession,false);
 assert.equal(frame.productionScoringConnected,false);
 assert.equal(frame.physicalShotBoundary.goalScored,null);
 assert.equal(frame.autonomousCarrySupportEarlyFacingMode,s.mode==='early'?true:undefined);
 assert.equal(frame.physicalPlayerPositions.length,22);
 assert.equal(moved.players.length,22);
 for(let i=0;i<22;i++){
  const p=moved.players[i],old=prior.players[i];
  const real=frame.physicalPlayerPositions[i];
  assert.equal(p.id,INITIAL_PLAYERS[i].id);
  assert.equal(real.engineId,p.id);
  assert.equal(real.team,p.team);
  assert.ok(Math.abs(p.x-real.x)<1e-9);
  assert.ok(Math.abs(p.y-real.y)<1e-9);
  assert.ok(xy(p,old)<=PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-5);
  const turned=Math.abs(wrap(p.facingRad-old.facingRad));
  assert.ok(turned<=PLAYER_TURN_RAD_PER_S*PLAYER_DT+1e-5,
   'no actor may turn faster than the real 6rad/s shoe limit');
  s.stats.maxActualTurnRad=Math.max(s.stats.maxActualTurnRad,turned);
 }
 const actor=moved.players.find(p=>p.id===s.team+'-10');
 const old=prior.players.find(p=>p.id===actor.id);
 assert.ok(old);
 const access=moved.provisionalCarrySupportBallAccess??null;
 const early=access?.earlyFacing??null;
 if(s.mode==='aligned')assert.equal(early,null);
 if(s.mode==='early')assert.equal(
  Object.hasOwn(moved,'provisionalCarrySupportBallAccess'),true);
 if(access){
  assert.equal(access.playerId,actor.id);
  assert.equal(access.team,s.team);
  assert.equal(access.sourcePassTick,s.pass?.tick);
  assert.equal(access.sourceCarryTick,s.carry?.tick);
  assert.ok(s.pass.tick<s.carry.tick&&s.carry.tick<tick);
  assert.ok(tick-s.carry.tick<=150&&tick-s.pass.tick<=480);
  assert.ok(access.bodyBallGapM<=4+1e-9);
  assert.equal(access.physicalShoeStartObserved,false);
  assert.equal(access.footballActionExecuted,false);
  assert.equal(access.officialMatchPossession,false);
  s.stats.sourceBoundAccess++;
 }
 if(s.mode==='early')assert.equal(!!early,!!access);
 if(early){
  assert.equal(early.source,'previous-actual-rapier-ball-and-authentic-carry-support');
  assert.equal(early.sourcePassTick,s.pass.tick);
  assert.equal(early.sourceCarryTick,s.carry.tick);
  assert.equal(early.orientationOnly,true);
  assert.equal(early.bodyTargetUnchanged,true);
  assert.equal(early.futureBallSampleUsed,false);
  assert.equal(early.physicalContactInferred,false);
  assert.equal(early.footballActionExecuted,false);
  assert.equal(early.officialMatchResult,null);
  assert.equal(early.preStepFacingRad,old.facingRad);
  assert.ok(Math.abs(wrap(early.desiredFacingRad-
   Math.atan2(before.ball.position.y-old.y,
    before.ball.position.x-old.x)))<1e-10);
  assert.equal(early.maxTurnRad,PLAYER_TURN_RAD_PER_S*PLAYER_DT);
  const expected=wrap(old.facingRad+Math.max(-early.maxTurnRad,
   Math.min(early.maxTurnRad,
    wrap(early.desiredFacingRad-old.facingRad))));
  assert.ok(Math.abs(wrap(actor.facingRad-expected))<1e-9,
   'only rate-limited turn, never forced heading');
  s.stats.earlyFrames++;
  if(s.stats.firstEarly===null)s.stats.firstEarly=tick;
  s.stats.lastEarly=tick;
 }
 // All actions must be triggered by genuine same-step Rapier shoe
 // START+ACTIVE. Angular and static geometry never count as contact.
 const starts=frame.physicalContactFeed.started;
 s.stats.realShoeSTART+=starts.length;
 for(const start of starts){
  assert.ok(frame.physicalContactFeed.active.some(active=>
   active.engineId===start.engineId&&active.team===start.team));
  if(start.engineId===actor.id&&tick>1)
   s.stats.newForwardShoeSTART++;
 }
 const action=frame.localAutonomousAction;
 if(action){
  assert.equal(starts.length,1);
  assert.equal(frame.physicalContactFeed.active.length,1);
  assert.equal(starts[0].engineId,action.playerId);
  assert.equal(starts[0].team,action.team);
  assert.equal(action.tick,tick);
  assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
  assert.equal(action.appliedByRapier,true);
  assert.equal(action.actualPhysicsImpulseApplied,true);
  assert.equal(action.officialMatchAction,false);
  const record={tick,id:action.playerId,team:action.team,
   kind:action.action};
  s.stats.physicalAction.push(record);
  if(action.action==='shot'){
   assert.equal(action.decisionContext.shotRange,true);
   assert.equal(action.shotTarget?.physicsTick,tick);
   assert.equal(action.shotTarget?.shooterId,action.playerId);
   assert.ok(action.shotTarget.laneClearanceM>=2.4);
   s.stats.naturalShots.push(record);
  }
 }
 const shoe=measureOrientedCarryShoeBallGeometry(actor,
  frame.ball.position);
 assert.equal(shoe.actualRapierCollisionInferred,false);
 if(tick>=600&&shoe.estimatedStaticSurfaceClearanceM<
    s.stats.minStaticClearanceM){
  s.stats.minStaticClearanceM=shoe.estimatedStaticSurfaceClearanceM;
  s.stats.minStaticClearanceTick=tick;
 }
 const direction=s.team==='home'?1:-1;
 s.stats.maxBallAdvance=Math.max(s.stats.maxBallAdvance,
  direction*(frame.ball.position.x-c.x));
 const goalX=direction*PLAYER_PITCH.lengthM/2;
 const shortfall=Math.max(0,
  Math.abs(goalX-frame.ball.position.x)-SHOT_MAX_RANGE_M);
 s.stats.minShotRangeShortfall=Math.min(
  s.stats.minShotRangeShortfall,shortfall);
 if(checkpoint.has(tick)||(early&&tick===s.stats.firstEarly)){
  s.stats.checkpoints.push({
   tick,early:!!early,authenticated:!!access,
   desiredFacing:early?r3(early.desiredFacingRad):null,
   facing:r3(actor.facingRad),headingDelta:r3(
    Math.abs(wrap(actor.facingRad-old.facingRad))),
   bodyGap:r3(shoe.bodyBallXYGapM),
   staticShoeGap:r3(shoe.estimatedStaticSurfaceClearanceM),
   realForwardSTART:starts.some(x=>x.engineId===actor.id),
   source:access?{pass:access.sourcePassTick,
    carry:access.sourceCarryTick}:null,
   ball:{x:r3(frame.ball.position.x),y:r3(frame.ball.position.y)},
   realAction:action?{id:action.playerId,kind:action.action}:null
  });
 }
 if(action?.action==='pass'){
  s.shadow.observeAuthenticFixturePass(action);
  s.pass=action;s.carry=null;
 }else if(action?.action==='carry'){
  s.shadow.observeAuthenticFixtureCarry(action);
  s.carry=action;
 }else if(action){
  s.shadow.clearFixtureCarryOnOtherAction(action);
  s.carry=null;
 }
 for(const id of frame.footContact.ended)
  s.shadow.observeAuthenticFixtureCarryShoeEnd(id,tick);
 return frame;
}
const output=s=>({
 mode:s.mode,team:s.team,earlyFrames:s.stats.earlyFrames,
 firstEarly:s.stats.firstEarly,lastEarly:s.stats.lastEarly,
 authenticatedAccessFrames:s.stats.sourceBoundAccess,
 maxActualTurnRad:r3(s.stats.maxActualTurnRad),
 realShoeStarts:s.stats.realShoeSTART,
 postInitialForwardRealStarts:s.stats.newForwardShoeSTART,
 naturalShots:s.stats.naturalShots,physicalActions:s.stats.physicalAction,
 minShoeClearanceM:r3(s.stats.minStaticClearanceM),
 minShoeTick:s.stats.minStaticClearanceTick,
 maxAttackingBallAdvanceM:r3(s.stats.maxBallAdvance),
 minShotZoneShortfallM:r3(s.stats.minShotRangeShortfall),
 checkpoints:s.stats.checkpoints.filter(x=>
  [634,635,640,650,664,675,683,693,694,700].includes(x.tick))
});
test('C2.3u sealed opt-in rejects missing or false dependencies and preserves reset',async()=>{
 const R=await initializeRapier(rapier),c=CASES[1];
 const early=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),OPT.early);
 try{
  assert.equal(early.snapshot().autonomousCarrySupportEarlyFacingMode,true);
  const reset=early.reset();
  try{
   assert.equal(reset.snapshot().autonomousCarrySupportEarlyFacingMode,true);
   for(let i=0;i<30;i++)reset.step();
   assert.equal(reset.snapshot().physicsTick,30);
  }finally{reset.dispose();}
 }finally{early.dispose();}
 for(const invalid of [
  {autonomousCarrySupportEarlyFacing:true},
  {...OPT.aligned,autonomousCarrySupportLateralAlign:false,
   autonomousCarrySupportEarlyFacing:true},
  {...OPT.aligned,autonomousCarrySupportEarlyFacing:false},
  {...OPT.early,researchShotAttacker:'away'},
  {...OPT.early,autonomousCarrySupportBallAccess:false},
  {...OPT.early,autonomousCarrySupportPressHandoff:false},
  {...OPT.early,autonomousActions:false}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(R,
  fixture(c),scene(c),invalid));
 for(const invalid of [
  {experimentalAutonomousFixtureCarrySupportEarlyFacing:true},
  {experimentalAiKickApproach:true,
   experimentalAutonomousFixtureContactChase:true,
   experimentalAutonomousFixtureCarry:true,
   experimentalAutonomousFixtureCarrySupport:true,
   experimentalAutonomousFixtureCarrySupportPressHandoff:true,
   experimentalAutonomousFixtureCarrySupportBallAccess:true,
   experimentalAutonomousFixtureCarrySupportEarlyFacing:true}
 ])assert.throws(()=>createPlayerMovement(invalid));
 const base=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),{});
 try{
  assert.equal(Object.hasOwn(base.snapshot(),
   'autonomousCarrySupportEarlyFacingMode'),false);
  for(let t=1;t<=30;t++)base.step();
 }finally{base.dispose();}
});
test('C2.3u real HOME/AWAY 720-tick aligned vs early-facing Rapier, independent AWAY replay',async()=>{
 const R=await initializeRapier(rapier),reports=[];
 for(const c of CASES){
  const studies=['aligned','early'].map(mode=>study(R,c,mode));
  const independent=c.team==='away'?
   createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),OPT.early):null;
  let firstFacingDiff=null,firstBodyOrBallDiff=null;
  try{
   for(let t=1;t<=720;t++){
    const [a,b]=studies.map(s=>replayStep(s,c));
    const beforeFirstEarly=studies[1].stats.firstEarly===null;
    if(beforeFirstEarly){
     assert.deepEqual(a.ball,b.ball);
     assert.deepEqual(a.physicalPlayerPositions,b.physicalPlayerPositions);
     assert.deepEqual(a.physicalContactFeed,b.physicalContactFeed);
     assert.deepEqual(a.localAutonomousAction,b.localAutonomousAction);
    }
    const x=studies[0].lastMove.players,y=studies[1].lastMove.players;
    if(firstFacingDiff===null&&x.some((p,i)=>
      Math.abs(wrap(p.facingRad-y[i].facingRad))>1e-9))
     firstFacingDiff=t;
    if(firstBodyOrBallDiff===null&&(
     JSON.stringify(a.ball)!==JSON.stringify(b.ball)||
     JSON.stringify(a.physicalPlayerPositions)!==
      JSON.stringify(b.physicalPlayerPositions)))
     firstBodyOrBallDiff=t;
    if(independent){
     const replay=independent.step();
     assert.deepEqual(b.ball,replay.ball);
     assert.deepEqual(b.physicalPlayerPositions,
      replay.physicalPlayerPositions);
     assert.deepEqual(b.physicalContactFeed,replay.physicalContactFeed);
     assert.deepEqual(b.localAutonomousAction,
      replay.localAutonomousAction);
    }
   }
   const [aligned,early]=studies;
   if(c.team==='home'){
    assert.equal(firstFacingDiff,null);
    assert.equal(firstBodyOrBallDiff,null);
    assert.equal(early.stats.earlyFrames,0);
    assert.equal(early.stats.sourceBoundAccess,0);
    assert.deepEqual(aligned.stats.physicalAction,
     early.stats.physicalAction);
   }else{
    assert.ok(early.stats.earlyFrames>0,
     'original real PASS→CARRY must unlock measurable shoe pivot');
    assert.equal(early.stats.earlyFrames,
     early.stats.sourceBoundAccess);
    assert.ok(firstFacingDiff!==null&&
     firstFacingDiff>=early.stats.firstEarly,
     'first yaw divergence only after real-source eligibility');
    assert.ok(firstBodyOrBallDiff===null||
     firstBodyOrBallDiff>=early.stats.firstEarly,
     'body/ball physics may change only after eligible real facing');
    assert.equal(aligned.stats.sourceBoundAccess,60);
   }
   reports.push({team:c.team,firstFacingDifferenceTick:firstFacingDiff,
    firstBallOrBodyPhysicalDifferenceTick:firstBodyOrBallDiff,
    modes:studies.map(output)});
  }finally{
   for(const s of studies)s.engine.dispose();
   independent?.dispose();
  }
 }
 console.log('C2_3U_GENUINE_RAPIER_EARLY_SHOE_FACING_AB',
  JSON.stringify(reports));
});
