// C2.3q: source-authenticated near-ball movement against three real
// 720-tick physical fixtures. No fake contact, possession or SHOT.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_PITCH,PLAYER_MAX_SPEED_MPS,
 createPlayerMovement} from '../src/player-movement.mjs';
import {SHOT_MAX_RANGE_M}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {measureOrientedCarryShoeBallGeometry}
 from '../src/player-ball-carry-oriented-shoe-geometry.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const TICKS=720;
const CASES=Object.freeze([
 Object.freeze({team:'home',country:'IT',x:-4.96,vx:0.3}),
 Object.freeze({team:'away',country:'DE',x:4.96,vx:-0.3})
]);
const OPTIONS=Object.freeze({
 baseline:Object.freeze({autonomousActions:true,autonomousCarry:true,
  autonomousCarrySupport:true}),
 handoff:Object.freeze({autonomousActions:true,autonomousCarry:true,
  autonomousCarrySupport:true,autonomousCarrySupportPressHandoff:true}),
 ballAccess:Object.freeze({autonomousActions:true,autonomousCarry:true,
  autonomousCarrySupport:true,autonomousCarrySupportPressHandoff:true,
  autonomousCarrySupportBallAccess:true})
});
const CHECKS=new Set([292,546,547,567,599,600,601,620,630,640,
 650,657,660,680,693,694,695,700,720]);
const R3=x=>Number(x.toFixed(3));
const rangeGoal=(team,b)=>Math.abs(
 (team==='home'?1:-1)*PLAYER_PITCH.lengthM/2-b.x);
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fixture=c=>Object.freeze({
 id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
 competitionId:c.country+'-1',marker:'N01',day:1,round:1,
 homeClubId:c.country+'-1',awayClubId:c.country+'-2'
});
const scene=c=>Object.freeze({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});
function make(R,c,mode){
 const runtime=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),
  OPTIONS[mode]);
 const observer=createPlayerMovement({
  experimentalAiKickApproach:true,
  experimentalAutonomousFixtureContactChase:true,
  experimentalAutonomousFixtureCarry:true,
  experimentalAutonomousFixtureCarrySupport:true,
  ...(mode==='handoff'||mode==='ballAccess'?{
   experimentalAutonomousFixtureCarrySupportPressHandoff:true}:{}),
  ...(mode==='ballAccess'?{
   experimentalAutonomousFixtureCarrySupportBallAccess:true}:{})
 });
 return {mode,team:c.team,runtime,observer,
  latestPass:null,latestCarry:null,
  stats:{accessTicks:0,firstAccessTick:null,lastAccessTick:null,
   relayTicks:0,realShoeStarts:0,forwardShoeStarts:0,
   physicalActions:[],realShots:[],shotZoneTicks:0,
   maxForwardBallProgressM:0,minShotShortfallM:Infinity,
   closestForwardFootFrom600M:Infinity,
   closestForwardFootTick:null,actorTargetMatches:0,
   checkpoints:[]}};
}
function step(s,c){
 const {runtime,observer,stats,team}=s;
 const before=runtime.snapshot(),prior=observer.snapshot();
 const t=before.physicsTick+1;
 assert.equal(prior.tick,t-1);
 const moved=observer.step(before.ball.position);
 const frame=runtime.step();
 assert.equal(frame.physicsTick,t);
 assert.equal(moved.tick,t);
 assert.equal(frame.officialMatchResult,null);
 assert.equal(frame.officialMatchPossession,false);
 assert.equal(frame.productionScoringConnected,false);
 assert.equal(frame.physicalShotBoundary.goalScored,null);
 assert.equal(moved.players.length,22);
 assert.equal(frame.physicalPlayerPositions.length,22);
 for(let i=0;i<22;i++){
  const p=moved.players[i],body=frame.physicalPlayerPositions[i];
  assert.equal(p.id,INITIAL_PLAYERS[i].id);
  assert.equal(body.engineId,p.id);
  assert.equal(body.team,p.team);
  assert.ok(Math.abs(p.x-body.x)<1e-9);
  assert.ok(Math.abs(p.y-body.y)<1e-9);
  assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-7,
   'the regular mover speed cap is unchanged');
 }
 const ball=frame.ball.position,actor=moved.players.find(p=>p.id===team+'-10');
 assert.ok(actor);
 const shoe=measureOrientedCarryShoeBallGeometry(actor,ball);
 assert.equal(shoe.actualRapierCollisionInferred,false);
 assert.equal(shoe.officialMatchPossession,false);
 const forward=(team==='home'?1:-1)*(ball.x-c.x);
 stats.maxForwardBallProgressM=Math.max(stats.maxForwardBallProgressM,forward);
 const toGoal=rangeGoal(team,ball);
 const shortfall=Math.max(0,toGoal-SHOT_MAX_RANGE_M);
 stats.minShotShortfallM=Math.min(stats.minShotShortfallM,shortfall);
 if(shortfall===0&&Math.abs(ball.y)<=20)stats.shotZoneTicks++;
 const support=moved.provisionalAttackSupportRun;
 const relay=support?.team===team&&support.phase==='post-carry-support'&&
  support.playerId===actor.id;
 if(relay){
  assert.equal(support.sourcePassTick,s.latestPass?.tick);
  assert.equal(support.carryContinuation.sourceCarryTick,
   s.latestCarry?.tick);
  assert.ok(s.latestCarry.tick<s.latestPass.tick+480);
  assert.ok(t-s.latestCarry.tick<=150&&t>s.latestCarry.tick);
  stats.relayTicks++;
 }
 const access=moved.provisionalCarrySupportBallAccess??null;
 if(s.mode==='ballAccess')
  assert.equal(Object.hasOwn(moved,'provisionalCarrySupportBallAccess'),true);
 else
  assert.equal(Object.hasOwn(moved,'provisionalCarrySupportBallAccess'),false);
 if(access){
  assert.equal(s.mode,'ballAccess');
  assert.equal(access.physicsTick,t);
  assert.equal(access.playerId,actor.id);
  assert.equal(access.team,team);
  assert.equal(access.sourcePassTick,s.latestPass.tick);
  assert.equal(access.sourceCarryTick,s.latestCarry.tick);
  assert.equal(access.movementIntentOnly,true);
  assert.equal(access.footballActionExecuted,false);
  assert.equal(access.physicalShoeStartObserved,false);
  assert.equal(access.officialMatchPossession,false);
  assert.equal(access.officialMatchResult,null);
  assert.equal(access.source,'authenticated-rapier-post-carry-live-ball');
  assert.ok(access.bodyBallGapM<=4+1e-9);
  assert.equal(relay,true,'a valid prior physical relay is mandatory');
  const attack=team==='home'?1:-1;
  assert.ok(Math.abs(access.target.x-
   (before.ball.position.x-attack*0.26))<1e-8);
  assert.ok(Math.abs(access.target.y-before.ball.position.y)<1e-8);
  stats.accessTicks++;
  if(stats.firstAccessTick===null)stats.firstAccessTick=t;
  stats.lastAccessTick=t;
  stats.actorTargetMatches++;
 }
 if(t>=600&&shoe.estimatedStaticSurfaceClearanceM<
     stats.closestForwardFootFrom600M){
  stats.closestForwardFootFrom600M=
   shoe.estimatedStaticSurfaceClearanceM;
  stats.closestForwardFootTick=t;
 }
 const starts=frame.physicalContactFeed.started;
 stats.realShoeStarts+=starts.length;
 for(const one of starts){
  assert.ok(frame.physicalContactFeed.active.some(other=>
   other.engineId===one.engineId&&other.team===one.team));
  if(one.engineId===actor.id)stats.forwardShoeStarts++;
 }
 const action=frame.localAutonomousAction;
 if(action){
  assert.equal(starts.length,1);
  assert.equal(frame.physicalContactFeed.active.length,1);
  assert.equal(starts[0].engineId,action.playerId);
  assert.equal(starts[0].team,action.team);
  assert.equal(action.tick,t);
  assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
  assert.equal(action.appliedByRapier,true);
  assert.equal(action.actualPhysicsImpulseApplied,true);
  assert.equal(action.officialMatchAction,false);
  const rec=Object.freeze({tick:t,id:action.playerId,team:action.team,
   action:action.action,shotRange:action.decisionContext.shotRange});
  stats.physicalActions.push(rec);
  if(action.action==='shot'){
   assert.equal(action.shotTarget?.physicsTick,t);
   assert.equal(action.shotTarget?.shooterId,action.playerId);
   assert.equal(action.decisionContext.shotRange,true);
   assert.ok(action.shotTarget.laneClearanceM>=2.4);
   stats.realShots.push(rec);
  }
 }
 if(CHECKS.has(t)||access&&t===stats.firstAccessTick){
  stats.checkpoints.push(Object.freeze({
   tick:t,ball:Object.freeze({x:R3(ball.x),y:R3(ball.y)}),
   shotRangeShortfallM:R3(shortfall),
   realTargetAccess:Boolean(access),supportRelay:Boolean(relay),
   forwardBodyBallM:R3(shoe.bodyBallXYGapM),
   forwardShoeStaticGapM:R3(shoe.estimatedStaticSurfaceClearanceM),
   shoeBallForwardM:R3(shoe.relativeBallForwardM),
   shoeBallLateralM:R3(shoe.relativeBallLateralM),
   facingRad:R3(shoe.actualFacingRad),
   activeDuty:frame.contactDecisionObservation.duties.find(p=>
    p.engineId===actor.id)?.movementDuty,
   target:access?Object.freeze({x:R3(access.target.x),
    y:R3(access.target.y)}):null,
   shoeSTARTs:Object.freeze(starts.map(p=>p.engineId)),
   realAction:action?Object.freeze({id:action.playerId,
    team:action.team,kind:action.action}):null,
   noInferredContact:true
  }));
 }
 // Only completed original-world physical shoe evidence is allowed
 // to influence the NEXT tick's independent mover.
 if(action?.action==='pass'){
  observer.observeAuthenticFixturePass(action);
  s.latestPass=action;s.latestCarry=null;
 }else if(action?.action==='carry'){
  observer.observeAuthenticFixtureCarry(action);
  s.latestCarry=action;
 }else if(action){
  observer.clearFixtureCarryOnOtherAction(action);
  s.latestCarry=null;
 }
 for(const id of frame.footContact.ended)
  observer.observeAuthenticFixtureCarryShoeEnd(id,frame.physicsTick);
 return frame;
}
const report=s=>Object.freeze({
 mode:s.mode,team:s.team,accessTicks:s.stats.accessTicks,
 firstAccessTick:s.stats.firstAccessTick,
 lastAccessTick:s.stats.lastAccessTick,
 supportRelayTicks:s.stats.relayTicks,
 forwardShoeStarts:s.stats.forwardShoeStarts,
 realShoeStarts:s.stats.realShoeStarts,
 realShots:s.stats.realShots,
 shotZoneTicks:s.stats.shotZoneTicks,
 maximumForwardBallProgressM:R3(s.stats.maxForwardBallProgressM),
 minShotShortfallM:R3(s.stats.minShotShortfallM),
 closestForwardShoeGapFromTick600M:
  R3(s.stats.closestForwardFootFrom600M),
 closestForwardShoeTick:s.stats.closestForwardFootTick,
 realActions:s.stats.physicalActions,
 checkpoints:s.stats.checkpoints.filter(p=>
  p.realTargetAccess&&p.tick===s.stats.firstAccessTick||
  [599,600,640,650,657,660,680,693,694,695,700,720].includes(p.tick))
});
test('C2.3q reject untrusted or non-paired ball access and preserve physical RESET',async()=>{
 const R=await initializeRapier(rapier),c=CASES[1];
 const valid=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),
  OPTIONS.ballAccess);
 try{
  assert.equal(valid.snapshot().autonomousCarrySupportBallAccessMode,true);
  const reset=valid.reset();
  try{
   assert.equal(reset.snapshot().autonomousCarrySupportBallAccessMode,true);
   assert.equal(reset.snapshot().physicsTick,0);
   for(let tick=1;tick<=20;tick++)reset.step();
  }finally{reset.dispose();}
 }finally{valid.dispose();}
 for(const invalid of [
  {autonomousCarrySupportBallAccess:true},
  {autonomousActions:true,autonomousCarrySupportBallAccess:true},
  {...OPTIONS.baseline,autonomousCarrySupportBallAccess:true},
  {...OPTIONS.ballAccess,autonomousCarrySupportBallAccess:false},
  {...OPTIONS.ballAccess,researchShotAttacker:'home'}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(
  R,fixture(c),scene(c),invalid));
 for(const invalid of [
  {experimentalAutonomousFixtureCarrySupportBallAccess:true},
  {experimentalAiKickApproach:true,
   experimentalAutonomousFixtureContactChase:true,
   experimentalAutonomousFixtureCarry:true,
   experimentalAutonomousFixtureCarrySupport:true,
   experimentalAutonomousFixtureCarrySupportBallAccess:true}
 ])assert.throws(()=>createPlayerMovement(invalid));
});
test('C2.3q genuine HOME/AWAY 3-world physical baseline vs handoff vs authenticated ball access',async()=>{
 const R=await initializeRapier(rapier),results=[];
 for(const c of CASES){
  const studies=['baseline','handoff','ballAccess'].map(mode=>
   make(R,c,mode));
  const independent=c.team==='away'?
   createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),
    OPTIONS.ballAccess):null;
  let baselineHandoffDiff=null,handoffAccessDiff=null;
  try{
   const snapshots=studies.map(s=>s.runtime.snapshot());
   assert.deepEqual(snapshots[0].ball,snapshots[1].ball);
   assert.deepEqual(snapshots[1].ball,snapshots[2].ball);
   assert.deepEqual(snapshots[0].physicalPlayerPositions,
    snapshots[2].physicalPlayerPositions);
   for(let t=1;t<=TICKS;t++){
    const frames=studies.map(s=>step(s,c));
    const a=frames[0],b=frames[1],d=frames[2];
    if(independent){
     const z=independent.step();
     assert.deepEqual(d.ball,z.ball,'separate physical ball replay '+t);
     assert.deepEqual(d.physicalPlayerPositions,z.physicalPlayerPositions,
      'all 22 feet identical in independent Rapier replay '+t);
     assert.deepEqual(d.physicalContactFeed,z.physicalContactFeed);
     assert.deepEqual(d.localAutonomousAction,z.localAutonomousAction);
    }
    const same=(x,y)=>JSON.stringify(x.ball)===JSON.stringify(y.ball)&&
     JSON.stringify(x.physicalPlayerPositions)===
      JSON.stringify(y.physicalPlayerPositions);
    if(!same(a,b)&&baselineHandoffDiff===null)
     baselineHandoffDiff=t;
    if(!same(b,d)&&handoffAccessDiff===null)
     handoffAccessDiff=t;
    // Before each movement branch is genuinely reached, all physics
    // contacts and local decisions must remain exactly unchanged.
    if(handoffAccessDiff===null){
     assert.deepEqual(b.physicalContactFeed,d.physicalContactFeed);
     assert.deepEqual(b.localAutonomousAction,d.localAutonomousAction);
    }
   }
   const [baseline,handoff,access]=studies;
   if(c.team==='home'){
    assert.equal(baselineHandoffDiff,null);
    assert.equal(handoffAccessDiff,null);
    assert.equal(access.stats.accessTicks,0);
    assert.equal(access.stats.relayTicks,0);
    assert.deepEqual(baseline.stats.physicalActions,
     access.stats.physicalActions);
   }else{
    assert.equal(baselineHandoffDiff,600);
    assert.equal(baseline.stats.relayTicks,53);
    assert.equal(handoff.stats.relayTicks,148);
    assert.equal(baseline.stats.realShoeStarts,16);
    assert.equal(handoff.stats.realShoeStarts,16);
    assert.equal(baseline.stats.realShots.length,0);
    assert.equal(handoff.stats.realShots.length,0);
    assert.ok(access.stats.accessTicks>0,
     'the authentic CARRY should enable a measurable near-ball trial');
    assert.ok(access.stats.firstAccessTick>=600);
    assert.ok(handoffAccessDiff>=access.stats.firstAccessTick,
     'no physical movement before real eligible ball-access intent');
    assert.equal(access.stats.actorTargetMatches,access.stats.accessTicks);
   }
   results.push(Object.freeze({
    team:c.team,firstBaselineHandoffDifference:baselineHandoffDiff,
    firstHandoffAccessPhysicalDifference:handoffAccessDiff,
    baseline:report(baseline),handoff:report(handoff),
    access:report(access)
   }));
  }finally{
   for(const s of studies)s.runtime.dispose();
   independent?.dispose();
  }
 }
 console.log('C2_3Q_AUTHENTIC_BALL_ACCESS_THREE_WORLD_RAPIER',
  JSON.stringify(results));
});
