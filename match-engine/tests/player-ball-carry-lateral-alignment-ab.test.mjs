// C2.3s: strictly opted-in, actual PASS/CARRY-bound lateral alignment.
// Four 720-tick real Rapier modes per HOME/AWAY, independent AWAY replay.
// No collider/ball/shot/possession manipulation or fabricated shoe START.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_MAX_SPEED_MPS,PLAYER_TURN_RAD_PER_S,
 PLAYER_MIN_SEPARATION_M,PLAYER_PITCH,createPlayerMovement}
 from '../src/player-movement.mjs';
import {SHOT_MAX_RANGE_M} from '../src/player-ball-uniform-autonomous-action.mjs';
import {measureOrientedCarryShoeBallGeometry}
 from '../src/player-ball-carry-oriented-shoe-geometry.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const R3=x=>Number(x.toFixed(3));
const CASES=Object.freeze([
 Object.freeze({team:'home',country:'IT',x:-4.96,vx:0.3}),
 Object.freeze({team:'away',country:'DE',x:4.96,vx:-0.3})
]);
const CORE=Object.freeze({autonomousActions:true,autonomousCarry:true,
 autonomousCarrySupport:true});
const MODE=Object.freeze({
 baseline:CORE,
 handoff:Object.freeze({...CORE,autonomousCarrySupportPressHandoff:true}),
 access:Object.freeze({...CORE,autonomousCarrySupportPressHandoff:true,
  autonomousCarrySupportBallAccess:true}),
 aligned:Object.freeze({...CORE,autonomousCarrySupportPressHandoff:true,
  autonomousCarrySupportBallAccess:true,
  autonomousCarrySupportLateralAlign:true})
});
const FOCUS=new Set([547,567,599,600,601,635,640,650,657,660,
 662,664,665,667,675,683,693,694,695,700,717,720]);
const fixture=c=>Object.freeze({
 id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
 competitionId:c.country+'-1',marker:'N01',day:1,round:1,
 homeClubId:c.country+'-1',awayClubId:c.country+'-2'
});
const initial=c=>Object.freeze({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const turn=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function createStudy(R,c,mode){
 const engine=createPhysicalFixtureStepRuntime(R,fixture(c),initial(c),MODE[mode]);
 const witness=createPlayerMovement({
  experimentalAiKickApproach:true,
  experimentalAutonomousFixtureContactChase:true,
  experimentalAutonomousFixtureCarry:true,
  experimentalAutonomousFixtureCarrySupport:true,
  ...(mode!=='baseline'?{
   experimentalAutonomousFixtureCarrySupportPressHandoff:true}:{}),
  ...(mode==='access'||mode==='aligned'?{
   experimentalAutonomousFixtureCarrySupportBallAccess:true}:{}),
  ...(mode==='aligned'?{
   experimentalAutonomousFixtureCarrySupportLateralAlign:true}:{})
 });
 return {team:c.team,mode,engine,witness,pass:null,carry:null,
  stats:{relay:0,access:0,align:0,nonzero:0,firstAlignTick:null,
   lastAlignTick:null,peakShift:0,maxObservedShoeLateral:0,
   minShoeFrom600:Infinity,minShoeTick:null,
   realStarts:0,forwardStartsAfterFirst:0,realActions:[],realShots:[],
   shotRangeFrames:0,minShotShortfall:Infinity,maxBallAdvance:0,
   guardStops:0,checkpoints:[]}};
}
function observe(s,frame){
 const act=frame.localAutonomousAction;
 if(act?.action==='pass'){
  s.witness.observeAuthenticFixturePass(act);s.pass=act;s.carry=null;
 }else if(act?.action==='carry'){
  s.witness.observeAuthenticFixtureCarry(act);s.carry=act;
 }else if(act){
  s.witness.clearFixtureCarryOnOtherAction(act);s.carry=null;
 }
 for(const id of frame.footContact.ended)
  s.witness.observeAuthenticFixtureCarryShoeEnd(id,frame.physicsTick);
}
function checkFrame(s,c){
 const prior=s.engine.snapshot(),previous=s.witness.snapshot(),
  tick=prior.physicsTick+1;
 assert.equal(previous.tick,tick-1);
 const moved=s.witness.step(prior.ball.position);
 const frame=s.engine.step();
 assert.equal(frame.physicsTick,tick);
 assert.equal(moved.tick,tick);
 assert.equal(frame.officialMatchResult,null);
 assert.equal(frame.officialMatchPossession,false);
 assert.equal(frame.productionScoringConnected,false);
 assert.equal(frame.physicalShotBoundary.goalScored,null);
 assert.equal(moved.players.length,22);
 assert.equal(frame.physicalPlayerPositions.length,22);
 for(let i=0;i<22;i++){
  const p=moved.players[i],old=previous.players[i],
   real=frame.physicalPlayerPositions[i];
  assert.equal(p.id,INITIAL_PLAYERS[i].id);
  assert.equal(real.engineId,p.id);
  assert.equal(real.team,p.team);
  assert.ok(Math.abs(real.x-p.x)<1e-9);
  assert.ok(Math.abs(real.y-p.y)<1e-9);
  assert.ok(gap(p,old)<=PLAYER_MAX_SPEED_MPS/60+1e-5);
  assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-7);
  assert.ok(Math.abs(turn(p.facingRad,old.facingRad))<=
   PLAYER_TURN_RAD_PER_S/60+1e-5);
 }
 const current=moved.players.find(p=>p.id===s.team+'-10');
 const old=previous.players.find(p=>p.id===current.id);
 assert.ok(current&&old);
 const foot=measureOrientedCarryShoeBallGeometry(current,
  frame.ball.position);
 assert.equal(foot.actualRapierCollisionInferred,false);
 assert.equal(foot.officialMatchPossession,false);
 const support=moved.provisionalAttackSupportRun;
 const legitimate=support?.team===s.team&&
  support.phase==='post-carry-support'&&
  support.playerId===current.id;
 if(legitimate){
  assert.equal(support.sourcePassTick,s.pass?.tick);
  assert.equal(support.carryContinuation.sourceCarryTick,s.carry?.tick);
  assert.ok(s.pass.tick<s.carry.tick&&s.carry.tick<tick);
  assert.ok(tick-s.carry.tick<=150&&tick-s.pass.tick<=480);
  s.stats.relay++;
 }
 const access=moved.provisionalCarrySupportBallAccess??null;
 if(access){
  assert.ok(s.mode==='access'||s.mode==='aligned');
  assert.equal(legitimate,true);
  assert.equal(access.sourcePassTick,s.pass.tick);
  assert.equal(access.sourceCarryTick,s.carry.tick);
  assert.ok(access.bodyBallGapM<=4);
  assert.equal(access.movementIntentOnly,true);
  assert.equal(access.footballActionExecuted,false);
  assert.equal(access.physicalShoeStartObserved,false);
  assert.equal(access.officialMatchPossession,false);
  assert.equal(access.officialMatchResult,null);
  s.stats.access++;
 }
 const align=access?.lateralAlignment??null;
 if(s.mode!=='aligned'){
  assert.equal(align,null,'old mode must remain frame-byte-compatible');
 }else if(access){
  assert.ok(align);
  assert.equal(align.source,
   'canonical-pre-step-oriented-shoe-lateral-projection');
  assert.equal(align.movementTargetOnly,true);
  assert.equal(align.physicalContactInferred,false);
  assert.equal(align.shotExecuted,false);
  assert.equal(align.officialMatchResult,null);
  const bal=prior.ball.position;
  const side=-Math.sin(old.facingRad)*(bal.x-old.x)+
   Math.cos(old.facingRad)*(bal.y-old.y);
  const correction=Math.abs(side)>0.16?
   clamp(side*0.5,-0.35,0.35):0;
  assert.ok(Math.abs(align.measuredBallLateralM-side)<1e-9);
  assert.ok(Math.abs(align.lateralTargetShiftM-correction)<1e-9);
  assert.ok(Math.abs(access.target.y-
   (bal.y+correction))<1e-9);
  const attack=s.team==='home'?1:-1;
  assert.ok(Math.abs(access.target.x-
   (bal.x-attack*0.26))<1e-9);
  s.stats.align++;
  if(Math.abs(correction)>1e-9)s.stats.nonzero++;
  if(s.stats.firstAlignTick===null)s.stats.firstAlignTick=tick;
  s.stats.lastAlignTick=tick;
  s.stats.peakShift=Math.max(s.stats.peakShift,
   Math.abs(correction));
  s.stats.maxObservedShoeLateral=Math.max(
   s.stats.maxObservedShoeLateral,Math.abs(side));
 }
 if(s.mode==='aligned')
  assert.equal(Object.hasOwn(moved,'provisionalCarrySupportBallAccess'),true);
 if(tick>=600&&foot.estimatedStaticSurfaceClearanceM<
    s.stats.minShoeFrom600){
  s.stats.minShoeFrom600=foot.estimatedStaticSurfaceClearanceM;
  s.stats.minShoeTick=tick;
 }
 if(tick>=600&&current.blockedBy!==null)s.stats.guardStops++;
 const starts=frame.physicalContactFeed.started;
 s.stats.realStarts+=starts.length;
 for(const r of starts){
  assert.ok(frame.physicalContactFeed.active.some(p=>
   p.engineId===r.engineId&&p.team===r.team));
  if(r.engineId===current.id&&tick>1)s.stats.forwardStartsAfterFirst++;
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
  const info={tick,id:action.playerId,team:action.team,
   action:action.action};
  s.stats.realActions.push(info);
  if(action.action==='shot'){
   assert.equal(action.decisionContext.shotRange,true);
   assert.equal(action.shotTarget?.physicsTick,tick);
   assert.equal(action.shotTarget?.shooterId,action.playerId);
   assert.ok(action.shotTarget.laneClearanceM>=2.4);
   s.stats.realShots.push(info);
  }
 }
 const goalX=(s.team==='home'?1:-1)*PLAYER_PITCH.lengthM/2;
 const shortfall=Math.max(0,Math.abs(goalX-frame.ball.position.x)-
  SHOT_MAX_RANGE_M);
 s.stats.minShotShortfall=Math.min(s.stats.minShotShortfall,shortfall);
 if(shortfall===0&&Math.abs(frame.ball.position.y)<=20)
  s.stats.shotRangeFrames++;
 s.stats.maxBallAdvance=Math.max(s.stats.maxBallAdvance,
  (s.team==='home'?1:-1)*(frame.ball.position.x-c.x));
 if(FOCUS.has(tick)||(align&&tick===s.stats.firstAlignTick)){
  s.stats.checkpoints.push({
   tick,access:!!access,lateralAlign:!!align,
   authSource:access?{pass:access.sourcePassTick,
    carry:access.sourceCarryTick}:null,
   shift:align?R3(align.lateralTargetShiftM):null,
   preBallSide:align?R3(align.measuredBallLateralM):null,
   target:access?{x:R3(access.target.x),y:R3(access.target.y)}:null,
   bodyGap:R3(foot.bodyBallXYGapM),
   shoeGap:R3(foot.estimatedStaticSurfaceClearanceM),
   shoeForward:R3(foot.relativeBallForwardM),
   shoeLateral:R3(foot.relativeBallLateralM),
   shoeVertical:R3(foot.relativeBallVerticalM),
   facing:R3(current.facingRad),
   blockedBy:current.blockedBy,
   actualStart:starts.some(p=>p.engineId===current.id),
   actualAction:action?{id:action.playerId,kind:action.action}:null,
   ball:{x:R3(frame.ball.position.x),y:R3(frame.ball.position.y)},
   shotRangeShortfall:R3(shortfall)
  });
 }
 observe(s,frame);
 return frame;
}
function report(s){
 const x=s.stats;
 return {mode:s.mode,team:s.team,
  relayFrames:x.relay,ballAccessFrames:x.access,
  lateralAlignFrames:x.align,nonzeroLateralCorrectionFrames:x.nonzero,
  firstAlignTick:x.firstAlignTick,lastAlignTick:x.lastAlignTick,
  peakTargetLateralShiftM:R3(x.peakShift),
  peakRealShoeBallLateralM:R3(x.maxObservedShoeLateral),
  minShoeClearanceFrom600M:R3(x.minShoeFrom600),
  minShoeClearanceTick:x.minShoeTick,
  realRapierShoeSTART:x.realStarts,
  postFirstForwardRealShoeSTART:x.forwardStartsAfterFirst,
  actualFootActions:x.realActions,naturalShots:x.realShots,
  shotZoneFrames:x.shotRangeFrames,
  minShotZoneShortfallM:R3(x.minShotShortfall),
  maxGoalwardBallAdvanceM:R3(x.maxBallAdvance),
  teammateMovementGuardStalls:x.guardStops,
  checkpoints:x.checkpoints.filter(p=>
   [635,657,660,664,665,675,683,693,694,700,
    x.firstAlignTick].includes(p.tick))
 };
}
test('C2.3s all-off and earlier DEV modes reject unpaired lateral align; reset sealed',async()=>{
 const R=await initializeRapier(rapier),c=CASES[1];
 const valid=createPhysicalFixtureStepRuntime(R,fixture(c),initial(c),
  MODE.aligned);
 try{
  assert.equal(valid.snapshot().autonomousCarrySupportLateralAlignMode,true);
  const reset=valid.reset();
  try{
   assert.equal(reset.snapshot().autonomousCarrySupportLateralAlignMode,true);
   assert.equal(reset.snapshot().physicsTick,0);
   for(let k=0;k<25;k++)reset.step();
  }finally{reset.dispose();}
 }finally{valid.dispose();}
 for(const opt of [
  {autonomousCarrySupportLateralAlign:true},
  {...MODE.baseline,autonomousCarrySupportLateralAlign:true},
  {...MODE.handoff,autonomousCarrySupportLateralAlign:true},
  {...MODE.access,autonomousCarrySupportLateralAlign:false},
  {...MODE.aligned,researchShotAttacker:'away'}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(
  R,fixture(c),initial(c),opt));
 for(const opt of [
  {experimentalAutonomousFixtureCarrySupportLateralAlign:true},
  {experimentalAiKickApproach:true,
   experimentalAutonomousFixtureContactChase:true,
   experimentalAutonomousFixtureCarry:true,
   experimentalAutonomousFixtureCarrySupport:true,
   experimentalAutonomousFixtureCarrySupportPressHandoff:true,
   experimentalAutonomousFixtureCarrySupportLateralAlign:true}
 ])assert.throws(()=>createPlayerMovement(opt));
});
test('C2.3s four genuine 720-tick HOME/AWAY Rapier modes + isolated aligned AWAY replay',async()=>{
 const R=await initializeRapier(rapier),out=[];
 for(const c of CASES){
  const modes=['baseline','handoff','access','aligned'];
  const studies=modes.map(m=>createStudy(R,c,m));
  const independent=c.team==='away'?
   createPhysicalFixtureStepRuntime(R,fixture(c),initial(c),MODE.aligned):null;
  let handoffFirst=null,accessFirst=null,alignFirst=null;
  try{
   for(let t=1;t<=720;t++){
    const frames=studies.map(s=>checkFrame(s,c));
    const same=(a,b)=>JSON.stringify(a.ball)===JSON.stringify(b.ball)&&
     JSON.stringify(a.physicalPlayerPositions)===
      JSON.stringify(b.physicalPlayerPositions);
    if(handoffFirst===null&&!same(frames[0],frames[1]))handoffFirst=t;
    if(accessFirst===null&&!same(frames[1],frames[2]))accessFirst=t;
    if(alignFirst===null&&!same(frames[2],frames[3]))alignFirst=t;
    if(alignFirst===null){
     assert.deepEqual(frames[2].physicalContactFeed,
      frames[3].physicalContactFeed);
     assert.deepEqual(frames[2].localAutonomousAction,
      frames[3].localAutonomousAction);
    }
    if(independent){
     const exact=independent.step(),actual=frames[3];
     assert.deepEqual(actual.ball,exact.ball);
     assert.deepEqual(actual.physicalPlayerPositions,
      exact.physicalPlayerPositions);
     assert.deepEqual(actual.physicalContactFeed,
      exact.physicalContactFeed);
     assert.deepEqual(actual.localAutonomousAction,
      exact.localAutonomousAction);
    }
   }
   const [baseline,handoff,access,aligned]=studies;
   if(c.team==='home'){
    assert.equal(handoffFirst,null);
    assert.equal(accessFirst,null);
    assert.equal(alignFirst,null);
    assert.equal(aligned.stats.align,0);
    assert.equal(aligned.stats.access,0);
    assert.deepEqual(baseline.stats.realActions,
     aligned.stats.realActions);
   }else{
    assert.equal(handoffFirst,600);
    assert.equal(accessFirst,635);
    assert.equal(baseline.stats.relay,53);
    assert.equal(handoff.stats.relay,148);
    assert.equal(access.stats.relay,148);
    assert.equal(access.stats.access,60);
    assert.equal(access.stats.realStarts,16);
    assert.ok(aligned.stats.align>0,
     'genuine source-bound near-ball approach must enable correction');
    assert.ok(aligned.stats.nonzero>0,
     'the real local shoe lateral miss must trigger target shift');
    assert.ok(aligned.stats.firstAlignTick>=635);
    assert.ok(alignFirst!==null&&
     alignFirst>=aligned.stats.firstAlignTick,
     'a physical difference requires an earlier real eligibility tick');
    assert.ok(aligned.stats.peakShift<=0.35+1e-12);
   }
   out.push({team:c.team,
    firstBaselineVsHandoffPhysicalDifference:handoffFirst,
    firstHandoffVsAccessPhysicalDifference:accessFirst,
    firstAccessVsLateralPhysicalDifference:alignFirst,
    modes:studies.map(report)});
  }finally{
   for(const s of studies)s.engine.dispose();
   independent?.dispose();
  }
 }
 // Compact log: avoid Actions' single-line 64 KiB truncation.
 console.log('C2_3S_TRUE_LATERAL_ALIGNMENT_FOUR_MODE_AB',
  JSON.stringify(out));
});
