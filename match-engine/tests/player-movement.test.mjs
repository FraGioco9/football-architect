import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,ENGINE_VERSION} from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_DT,PLAYER_VERSION,
 PLAYER_PITCH,PLAYER_RADIUS_M,PLAYER_MIN_SEPARATION_M,PLAYER_MAX_SPEED_MPS,
 PLAYER_ACCEL_MPS2,PLAYER_BRAKE_MPS2,PLAYER_TURN_RAD_PER_S,
 PLAYER_PRESS_SWITCH_ADVANTAGE_M,PLAYER_FLANK_NARROW_MAX,
 PLAYER_COVER_GOALSIDE_OFFSET_M,PLAYER_COVER_SWITCH_ADVANTAGE_M,
 PLAYER_OWN_THIRD_NARROW_DEFENDERS,PLAYER_SCREEN_THREAT_RANGE_M,
 PLAYER_SCREEN_SWITCH_ADVANTAGE_M,PLAYER_SCREEN_GOALSIDE_OFFSET_M,
 PLAYER_SCREEN_HALF_ADVANCE_M,PLAYER_SUPPORT_DEPTH_M,
 PLAYER_SUPPORT_LANE_OFFSET_M,PLAYER_SUPPORT_ASSIGNMENT_HYSTERESIS_M,
 PLAYER_SUPPORT_LANE_HYSTERESIS_M,PLAYER_SUPPORT_TEAM_SPACING_M,
 PLAYER_SUPPORT_TEAM_CROWD_PENALTY,PLAYER_SUPPORT_TEAM_CLEARANCE_WEIGHT,
 scoreCooperativeSupportSlot,goalkeeperPosition,
 PLAYER_KEEPER_MIN_DEPTH_M,PLAYER_KEEPER_MAX_DEPTH_M,
 PLAYER_KEEPER_DEPTH_GAIN,PLAYER_KEEPER_MAX_LATERAL_M,
 PLAYER_RECOVERY_GOALSIDE_M,PLAYER_RECOVERY_LANE_GAIN,
 PLAYER_RECOVERY_MAX_LATERAL_M,recoverySupportTarget,
 PLAYER_BALANCE_GOALSIDE_M,PLAYER_BALANCE_MAX_LATERAL_M,
 PLAYER_BALANCE_LANE_GAIN,PLAYER_BALANCE_MIN_LANE_DISTANCE_M,
 weakSideBalanceTarget,PLAYER_LINE_DEFENDER_MAX_EXTRA_M,
 PLAYER_LINE_MIDFIELDER_MAX_EXTRA_M,PLAYER_LINE_EXTRA_LANE_MAX_M,
 observedThreatProgress,coordinatedLineTarget,
 PLAYER_LINE_INTENT_EASE_MPS,PLAYER_LINE_INTENT_SETTLED_EPS_M,
 advanceLineIntentOffset,PLAYER_COHESION_MIN_GAP_M,
 PLAYER_COHESION_MAX_GAP_M,PLAYER_COHESION_DEFENDER_MAX_X_M,
 PLAYER_COHESION_MIDFIELDER_MAX_X_M,PLAYER_COHESION_DEFENDER_MAX_Y_M,
 PLAYER_COHESION_MIDFIELDER_MAX_Y_M,PLAYER_COHESION_LATERAL_TOLERANCE_M,
 measureLineCohesion,lineCohesionTarget,
 PLAYER_TEAMMATE_CLEARANCE_M,PLAYER_TEAMMATE_CLEARANCE_GAIN,
 PLAYER_TEAMMATE_CLEARANCE_MAX_SHIFT_M,
 teammateClearanceTarget,measureTeammateProximity,
 selectTeammateClearanceNeighbor,
 PLAYER_TEAMMATE_CLEARANCE_SWITCH_ADVANTAGE_M,
 PLAYER_CROSSING_LOOKAHEAD_S,PLAYER_CROSSING_GUARD_M,
 PLAYER_CROSSING_MAX_SHIFT_M,PLAYER_CROSSING_MIN_REL_SPEED_MPS,
 PLAYER_CROSSING_MIN_ETA_S,PLAYER_CROSSING_MAX_ABS_HEADING_COS,
 forecastTeammateCrossing,teammateCrossingTarget,
 PLAYER_CROSSING_INTENT_EASE_MPS,PLAYER_CROSSING_INTENT_SETTLED_EPS_M,
 advanceCrossingIntentOffset,
 PLAYER_STALL_CONFIRM_TICKS,PLAYER_DETOUR_RELEASE_DISTANCE_M,
 PLAYER_DETOUR_WAYPOINT_LATERAL_M,PLAYER_DETOUR_WAYPOINT_BACK_M,
 advanceObservedStall,observedTeammateDetourTarget,
 PLAYER_DETOUR_RETRY_COOLDOWN_TICKS,
 PLAYER_DETOUR_SIDE_CLEARANCE_ADVANTAGE_M,
 selectObservedDetourSide,advanceDetourRetryCooldown,
 PLAYER_DETOUR_PROGRESS_MIN_STEP_M,PLAYER_DETOUR_STAGNANT_WARNING_TICKS,
 PLAYER_DETOUR_STAGNANT_ABORT_TICKS,PLAYER_DETOUR_MAX_ACTIVE_TICKS,
 advanceObservedDetourProgress,shouldAbortObservedDetour,
 PLAYER_DETOUR_OFF_COURSE_MIN_MOVEMENT_M,
 measureObservedDetourAdvance,
 PLAYER_DETOUR_COMPLETION_RADIUS_M,
 PLAYER_DETOUR_COMPLETION_BLOCKER_GAP_M,
 reachedObservedDetourWaypoint,
 PLAYER_DETOUR_REJOIN_LOOKAHEAD_M,
 measureObservedDetourRejoinCorridor,
 PLAYER_REJOIN_HANDOFF_TICKS,PLAYER_REJOIN_HANDOFF_LOOKAHEAD_M,
 PLAYER_REJOIN_HANDOFF_MIN_SPEED_MPS,PLAYER_REJOIN_HANDOFF_MAX_BLEND,
 observedVelocityRejoinTarget,measureObservedHandoffCorridor,
  observedPlayerVelocityVector,summarizeObservedPlayerMotion,
  PLAYER_OBSERVED_MOTION_THRESHOLD_MPS,PLAYER_OBSERVED_VECTOR_SECONDS,
  createObservedPlayerTrails,PLAYER_OBSERVED_PATH_WINDOW_TICKS,
  summarizeObservedTrailDistances,inspectObservedPlayer,
  inspectObservedPlayerAssignments,createObservedAssignmentTimeline,
  summarizeObservedAssignmentTransitions,summarizeObservedDutyOccupancy,
  summarizeObservedDutyTravel,summarizeObservedDutyDirections,
  summarizeObservedDutyPace} from '../src/player-movement.mjs';
import {pitchProjection,pickObservedPlayerAtCanvasPixel} from '../src/pitch-markings.mjs';
const get=(w,id)=>w.snapshot().players.find(p=>p.id===id);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,a+' vs '+b);
test('ME-PLAYER-01 creates symmetric immutable 11+11 neutral formation',()=>{
 const w=createPlayerMovement(),s=w.snapshot();
 assert.equal(s.version,PLAYER_VERSION);assert.equal(s.timeS,0);assert.equal(s.tick,0);
 assert.equal(s.players.length,22);assert.equal(INITIAL_PLAYERS.length,22);
 assert.deepEqual(s.players.map(p=>p.id),[
  ...Array.from({length:11},(_,i)=>'home-'+(i+1)),
  ...Array.from({length:11},(_,i)=>'away-'+(i+1))]);
 assert.equal(new Set(s.players.map(p=>p.id)).size,22);
 assert.equal(PLAYER_PITCH.lengthM,105);assert.equal(PLAYER_PITCH.widthM,68);
 assert.equal(s.players.filter(p=>p.team==='home').length,11);
 assert.equal(s.players.filter(p=>p.team==='away').length,11);
 assert.deepEqual(s.pressers,{home:'home-10',away:'away-10'});
 for(let i=0;i<11;i++){
  const home=s.players[i],away=s.players[11+i];
  close(home.x,-away.x);close(home.y,away.y);
  assert.equal(home.role,away.role);assert.equal(home.vx,0);assert.equal(away.vy,0);
 }
 assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.players)&&Object.isFrozen(INITIAL_PLAYERS));
 assert.ok(s.players.every(p=>p.blockedBy===null));
 assert.ok(s.players.every(Object.isFrozen));
});
test('ME-PLAYER-01 is strictly autonomous: no selection or direct user input',()=>{
 const w=createPlayerMovement();
 assert.deepEqual(Object.keys(w).sort(),['reset','snapshot','step']);
 assert.equal('setDirection' in w,false);
 assert.equal('select' in w,false);
 assert.equal('steer' in w,false);
 assert.equal('control' in w.snapshot(),false);
 assert.equal('selectedId' in w.snapshot(),false);
 const before=w.snapshot();
 for(let i=0;i<120;i++)w.step({x:0,y:0});
 const after=w.snapshot();
 assert.equal(after.tick,120);close(after.timeS,2);
 assert.equal(after.pressers.home,'home-10');assert.equal(after.pressers.away,'away-10');
 assert.ok(get(w,'home-10').x>before.players[9].x+0.5);
 assert.ok(get(w,'away-10').x<before.players[20].x-0.5);
 assert.ok(Math.abs(get(w,'home-10').x+get(w,'away-10').x)<0.05);
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-01 ball-aware tactical shifting, finite state and bounded acceleration',()=>{
 const w=createPlayerMovement();
 let last=w.snapshot();
 let movedOthers=false;
 for(let tick=0;tick<360;tick++){
  const ball={x:Math.min(25,tick*0.08),y:Math.sin(tick/80)*13};
  const s=w.step(ball);
  assert.equal(s.tick,tick+1);close(s.timeS,(tick+1)*PLAYER_DT);
  for(let i=0;i<s.players.length;i++){
   const p=s.players[i],prev=last.players[i];
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   const velocityDelta=Math.hypot(p.vx-prev.vx,p.vy-prev.vy);
   const blocked=typeof p.blockedBy==='string';
   assert.ok(velocityDelta<=PLAYER_BRAKE_MPS2*PLAYER_DT+1e-8||
     (blocked&&p.vx===0&&p.vy===0&&
      Math.hypot(p.x-prev.x,p.y-prev.y)<1e-10),
     'bounded free-space velocity or explicit hard-stop contact '+p.id+' '+tick);
   assert.ok(Math.abs(p.x)<=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M+1e-7);
   assert.ok(Math.abs(p.y)<=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M+1e-7);
   assert.ok([p.x,p.y,p.vx,p.vy,p.facingRad].every(Number.isFinite));
   const turn=Math.atan2(Math.sin(p.facingRad-prev.facingRad),
    Math.cos(p.facingRad-prev.facingRad));
   assert.ok(Math.abs(turn)<=PLAYER_TURN_RAD_PER_S*PLAYER_DT+1e-8);
   if(p.id==='home-3'&&Math.hypot(p.x-p.baseX,p.y-p.baseY)>0.4)
    movedOthers=true;
   for(let j=0;j<i;j++)
    assert.ok(dist(p,s.players[j])>=PLAYER_MIN_SEPARATION_M-1e-7,
      'two player bodies overlap '+p.id+'/'+s.players[j].id+' tick '+tick);
  }
  last=s;
 }
 assert.ok(movedOthers,'defensive line adjusts to ball rather than standing still');
 assert.ok(w.snapshot().pressers.home||w.snapshot().pressers.away);
 assert.equal(PLAYER_ACCEL_MPS2,9);
 assert.equal(PLAYER_BRAKE_MPS2,12);
});
test('ME-PLAYER-01 tactical boundaries and collision rejection at fast ball changes',()=>{
 const w=createPlayerMovement();
 for(let t=0;t<1000;t++){
  const x=51*Math.sin(t/27),y=33*Math.cos(t/41);
  const s=w.step({x,y});
  for(let i=0;i<s.players.length;i++){
   const p=s.players[i];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-9);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-9);
   for(let j=0;j<i;j++)
    assert.ok(dist(p,s.players[j])>=PLAYER_MIN_SEPARATION_M-1e-7,
      'invalid player contact at '+t);
  }
 }
});
test('ME-PLAYER-01 deterministic replay, input validation, immutable snapshots',()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let t=0;t<480;t++){
  const target={x:Math.sin(t/30)*50,y:Math.cos(t/40)*33};
  assert.deepEqual(a.step(target),b.step(target));
 }
 assert.deepEqual(a.snapshot(),b.snapshot());
 assert.notEqual(a.snapshot().players[0],a.snapshot().players[0]);
 assert.throws(()=>{a.snapshot().players[0].x=999;},TypeError);
 for(const x of [null,{},0,{x:NaN,y:0},{x:0,y:Infinity},{x:'1',y:1}])
  assert.throws(()=>a.step(x),/Finite ball XY state required/);
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-01 never modifies active Rapier ball physics/replay',async()=>{
 const R=await initializeRapier(wasm);
 const first=createEngine(R,{preset:'launch',seed:'players-auto-ball'});
 const control=createEngine(R,{preset:'launch',seed:'players-auto-ball'});
 const players=createPlayerMovement();
 try{
  for(let i=0;i<150;i++){
   const s=first.step();control.step();
   players.step(s.ball.position);
   assert.equal(canonicalSnapshot(first.snapshot()),canonicalSnapshot(control.snapshot()));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
  assert.equal(players.snapshot().tick,150);
 }finally{first.dispose();control.dispose();}
});


test('ME-PLAYER-02 reports frozen neutral ball territory and measured line shape',()=>{
 const s=createPlayerMovement().snapshot();
 assert.deepEqual(s.ballSector,{third:'middle-third',lane:'central'});
 assert.deepEqual(s.pressSwitches,{home:0,away:0});
 for(const side of ['home','away']){
  const sh=s.shape[side];
  assert.equal(sh.supporters,9);
  close(sh.widthM,44);close(sh.depthM,30);
  assert.ok(Object.isFrozen(sh)&&Object.isFrozen(s.ballSector)&&
    Object.isFrozen(s.shape)&&Object.isFrozen(s.pressSwitches));
  const polarity=side==='home'?-1:1;
  close(sh.defenderLineX,polarity*35);
  close(sh.midfieldLineX,polarity*20);
  close(sh.forwardLineX,polarity*5);
 }
 assert.equal(PLAYER_PRESS_SWITCH_ADVANTAGE_M,3);
 assert.equal(PLAYER_FLANK_NARROW_MAX,0.16);
});
test('ME-PLAYER-02 pressing assignments do not flicker across a lane boundary',()=>{
 const w=createPlayerMovement();
 for(let i=0;i<360;i++){
  const s=w.step({x:-5,y:i%2===0?8.7:9.3});
  assert.equal(s.pressers.home,'home-10','small y oscillations must retain presser');
  assert.equal(s.pressSwitches.home,0);
 }
 const switched=w.step({x:-5,y:15});
 assert.equal(switched.pressers.home,'home-11','larger advantage transfers press');
 assert.equal(switched.pressSwitches.home,1);
 for(let i=0;i<180;i++){
  const s=w.step({x:-5,y:i%2===0?8.7:9.3});
  assert.equal(s.pressers.home,'home-11','incumbent remains in hysteresis window');
  assert.equal(s.pressSwitches.home,1);
 }
 const recovered=w.step({x:-5,y:0});
 assert.equal(recovered.pressers.home,'home-10');
 assert.equal(recovered.pressSwitches.home,2);
 assert.notEqual(recovered.pressers.away,'away-1','goalkeeper cannot press');
});
test('ME-PLAYER-02 ball territory is location-only and never possession',()=>{
 const w=createPlayerMovement();
 assert.deepEqual(w.step({x:-30,y:-20}).ballSector,
  {third:'home-third',lane:'negative-y'});
 assert.deepEqual(w.step({x:30,y:20}).ballSector,
  {third:'away-third',lane:'positive-y'});
 assert.deepEqual(w.step({x:0,y:0}).ballSector,
  {third:'middle-third',lane:'central'});
 const s=w.step({x:500,y:-1000});
 assert.deepEqual(s.ball,{x:52.5,y:-34});
 assert.deepEqual(s.ballSector,{third:'away-third',lane:'negative-y'});
 assert.equal('possession' in s,false);
 assert.equal('owner' in s,false);
});
test('ME-PLAYER-02 both teams narrow support positions near touchline',()=>{
 const centre=createPlayerMovement(),flank=createPlayerMovement();
 for(let t=0;t<720;t++){
  centre.step({x:0,y:0});
  flank.step({x:0,y:30});
 }
 const a=centre.snapshot(),b=flank.snapshot();
 for(const side of ['home','away']){
  assert.ok(a.shape[side].widthM>43.5);
  assert.ok(b.shape[side].widthM<a.shape[side].widthM-2.0,
   side+' should support the flank without spreading over both touchlines');
  assert.ok(b.shape[side].widthM>28,
   side+' may not collapse the entire team into one line');
  assert.ok(b.shape[side].depthM>10,
   side+' should retain multiple role lines');
  const lines=b.shape[side];
  assert.ok([lines.defenderLineX,lines.midfieldLineX,lines.forwardLineX]
   .every(Number.isFinite));
 }
 assert.ok(b.pressers.home&&b.pressers.away);
});
test('ME-PLAYER-02 deterministic rapid sector transitions preserve limits',()=>{
 const w=createPlayerMovement(),copy=createPlayerMovement();
 let last=w.snapshot();
 for(let tick=0;tick<480;tick++){
  const ball={x:50*Math.sin(tick/15),y:31*Math.cos(tick/23)};
  const a=w.step(ball),b=copy.step(ball);
  assert.deepEqual(a,b);
  for(const side of ['home','away']){
   const shape=a.shape[side];
   assert.ok(shape.supporters>=9&&shape.supporters<=10);
   assert.ok(shape.widthM>=0&&shape.widthM<=68);
   assert.ok(shape.depthM>=0&&shape.depthM<=105);
   assert.ok(a.pressSwitches[side]>=last.pressSwitches[side]);
   assert.ok(a.pressers[side]===null||!a.pressers[side].endsWith('-1'));
  }
  last=a;
 }
});


test('ME-PLAYER-03 assigns defensive covering only inside the correct own third',()=>{
 const w=createPlayerMovement();
 const initial=w.snapshot();
 assert.deepEqual(initial.coverers,{home:null,away:null});
 assert.deepEqual(initial.coverSwitches,{home:0,away:0});
 assert.ok(Object.isFrozen(initial.coverers)&&Object.isFrozen(initial.coverSwitches));
 const home=w.step({x:-40,y:0});
 assert.match(home.coverers.home,/^home-[2-5]$/);
 assert.equal(home.coverers.away,null,'opponent in their attacking third must not pretend to defend own box');
 assert.notEqual(home.coverers.home,home.pressers.home);
 assert.equal(home.coverSwitches.home,1);
 assert.equal(home.coverSwitches.away,0);
 const away=w.step({x:40,y:0});
 assert.equal(away.coverers.home,null);
 assert.match(away.coverers.away,/^away-[2-5]$/);
 assert.notEqual(away.coverers.away,away.pressers.away);
 assert.equal(away.coverSwitches.home,2);
 assert.equal(away.coverSwitches.away,1);
 const middle=w.step({x:0,y:0});
 assert.deepEqual(middle.coverers,{home:null,away:null});
 assert.equal(middle.coverSwitches.away,2);
 assert.equal('possession' in middle,false);
 assert.equal('ballOwner' in middle,false);
 assert.equal(PLAYER_COVER_GOALSIDE_OFFSET_M,6);
 assert.equal(PLAYER_COVER_SWITCH_ADVANTAGE_M,3);
});
test('ME-PLAYER-03 cover assignment has hysteresis, no 60Hz lane flicker',()=>{
 const w=createPlayerMovement();
 const first=w.step({x:-40,y:0});
 const initialId=first.coverers.home;
 assert.match(initialId,/^home-[2-5]$/);
 for(let i=0;i<240;i++){
  const s=w.step({x:-40,y:i%2===0?0.5:-0.5});
  assert.equal(s.coverers.home,initialId);
  assert.equal(s.coverSwitches.home,1);
 }
 const switched=w.step({x:-40,y:-17});
 assert.match(switched.coverers.home,/^home-[2-5]$/);
 assert.notEqual(switched.coverers.home,initialId);
 assert.equal(switched.coverSwitches.home,2);
 for(let i=0;i<120;i++){
  const s=w.step({x:-40,y:i%2===0?-15:-16});
  assert.equal(s.coverers.home,switched.coverers.home);
  assert.equal(s.coverSwitches.home,2);
 }
});
test('ME-PLAYER-03 coverer moves toward a distinct goalside support point',()=>{
 const w=createPlayerMovement();
 const first=w.step({x:-40,y:0});
 const coverId=first.coverers.home;
 const presserId=first.pressers.home;
 assert.ok(coverId&&presserId);
 for(let i=0;i<400;i++)w.step({x:-40,y:0});
 const s=w.snapshot();
 const cover=s.players.find(p=>p.id===coverId);
 const pressing=s.players.find(p=>p.id===presserId);
 assert.ok(cover.x < -43,'cover target stays behind ball toward own goal');
 assert.ok(cover.x < pressing.x-1.5,'defensive screen cannot coincide with presser');
 assert.ok(dist(cover,pressing)>=PLAYER_MIN_SEPARATION_M);
 assert.ok(Math.abs(cover.y)<=4,'covering player protects lane near ball');
 assert.equal(s.coverers.away,null);
});
test('ME-PLAYER-03 compact defending team more than neutral team',()=>{
 const centre=createPlayerMovement(),own=createPlayerMovement();
 for(let i=0;i<720;i++){
  centre.step({x:0,y:0});
  own.step({x:-30,y:0});
 }
 const a=centre.snapshot(),b=own.snapshot();
 const homeDefenders=world=>world.players.filter(p=>p.team==='home'&&p.role==='defender');
 const fullWidth=arr=>Math.max(...arr.map(p=>p.y))-Math.min(...arr.map(p=>p.y));
 const aHome=fullWidth(homeDefenders(a)),bHome=fullWidth(homeDefenders(b));
 const aAway=fullWidth(a.players.filter(p=>p.team==='away'&&p.role==='defender'));
 const bAway=fullWidth(b.players.filter(p=>p.team==='away'&&p.role==='defender'));
 assert.ok(bHome<aHome-3,'own-third defenders narrow their lanes');
 assert.ok(Math.abs(bAway-aAway)<0.3,'away-team defenders should not use own-third compression');
 assert.equal(PLAYER_OWN_THIRD_NARROW_DEFENDERS,0.12);
 assert.ok(b.shape.home.widthM>25);
 assert.ok(b.shape.home.depthM>10);
});
test('ME-PLAYER-03 repeatable fast opposing-third sequence without overlaps or player steering',()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 let prev=a.snapshot();
 let coverEntered={home:false,away:false};
 for(let t=0;t<600;t++){
  const ball={x:48*Math.sin(t/23),y:30*Math.sin(t/35)};
  const x=a.step(ball),y=b.step(ball);
  assert.deepEqual(x,y,'identical autonomous replays');
  for(const team of ['home','away']){
   const coverId=x.coverers[team];
   if(coverId){
    coverEntered[team]=true;
    const p=x.players.find(p=>p.id===coverId);
    assert.equal(p.role,'defender');
    assert.notEqual(coverId,x.pressers[team]);
   }
   assert.ok(x.coverSwitches[team]>=prev.coverSwitches[team]);
  }
  for(let i=0;i<x.players.length;i++){
   const p=x.players[i];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-7);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-7);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let j=0;j<i;j++)assert.ok(dist(p,x.players[j])>=PLAYER_MIN_SEPARATION_M-1e-7,
     'players overlap '+p.id+'/'+x.players[j].id);
  }
  prev=x;
 }
 assert.deepEqual(coverEntered,{home:true,away:true});
 assert.deepEqual(Object.keys(a).sort(),['reset','snapshot','step']);
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});


test('ME-PLAYER-04 initially sees no opponent inside own-third danger zone',()=>{
 const w=createPlayerMovement(),start=w.snapshot();
 assert.deepEqual(start.screens,{home:null,away:null});
 assert.deepEqual(start.screenSwitches,{home:0,away:0});
 assert.ok(Object.isFrozen(start.screens)&&Object.isFrozen(start.screenSwitches));
 for(let i=0;i<120;i++){
  const s=w.step({x:-25,y:0});
  if(i===0){
   assert.equal(s.screens.home,null,'must not invent an opponent near own goal');
   assert.equal(s.screens.away,null,'only own-third defense can screen');
  }
 }
 assert.equal('possession' in w.snapshot(),false);
 assert.equal('ballOwner' in w.snapshot(),false);
 assert.equal(PLAYER_SCREEN_THREAT_RANGE_M,22);
 assert.equal(PLAYER_SCREEN_SWITCH_ADVANTAGE_M,3);
 assert.equal(PLAYER_SCREEN_GOALSIDE_OFFSET_M,4);
});
test('ME-PLAYER-04 recognizes an ACTUAL incoming opponent and assigns separate defender',()=>{
 const w=createPlayerMovement();
 let first=null;
 for(let t=0;t<660;t++){
  const s=w.step({x:-25,y:0});
  if(s.screens.home&&!first)first={tick:t+1,screen:s.screens.home};
 }
 const s=w.snapshot(),screen=s.screens.home;
 assert.ok(first,'an actual opposing presser should eventually enter the own-third zone');
 assert.ok(first.tick>1,'no invented nearby opponent on first tick');
 assert.equal(s.screens.away,null);
 assert.ok(screen&&Object.isFrozen(screen));
 assert.match(screen.defenderId,/^home-[2-5]$/);
 assert.match(screen.opponentId,/^away-(?:[2-9]|10|11)$/);
 assert.notEqual(screen.defenderId,s.pressers.home);
 assert.notEqual(screen.defenderId,s.coverers.home);
 const defender=s.players.find(p=>p.id===screen.defenderId);
 const opponent=s.players.find(p=>p.id===screen.opponentId);
 assert.equal(defender.role,'defender');
 assert.notEqual(opponent.role,'goalkeeper');
 assert.ok(opponent.x< -PLAYER_SCREEN_HALF_ADVANCE_M,'observed opponent must have advanced into the defending half');
 assert.ok(dist(opponent,s.ball)<=PLAYER_SCREEN_THREAT_RANGE_M+1e-8);
 assert.equal(s.screenSwitches.home,1);
 assert.ok(defender.x<opponent.x-0.8,'defensive screen must end on goal-facing side');
 assert.ok(dist(defender,opponent)>=PLAYER_MIN_SEPARATION_M-1e-8);
});
test('ME-PLAYER-04 stable 60Hz screening hysteresis for nearby ball jitter',()=>{
 const w=createPlayerMovement();
 for(let i=0;i<620;i++)w.step({x:-25,y:0});
 const incumbent=w.snapshot().screens.home;
 assert.ok(incumbent,'must have valid threat before checking hysteresis');
 const count=w.snapshot().screenSwitches.home;
 for(let i=0;i<180;i++){
  const s=w.step({x:-25,y:i%2?0.15:-0.15});
  assert.deepEqual(s.screens.home,incumbent);
  assert.equal(s.screenSwitches.home,count);
 }
 const clear=w.step({x:0,y:0});
 assert.equal(clear.screens.home,null);
 assert.equal(clear.screenSwitches.home,count+1);
});
test('ME-PLAYER-04 mirrored opponent-aware defensive screening never changes ball physics',async()=>{
 const R=await initializeRapier(wasm);
 const first=createEngine(R,{preset:'roll',seed:'screen-no-ball-impulse'});
 const second=createEngine(R,{preset:'roll',seed:'screen-no-ball-impulse'});
 const w=createPlayerMovement(),other=createPlayerMovement();
 try{
  for(let t=0;t<180;t++){
   const a=first.step(),b=second.step();
   const input={x:t%2?25:-25,y:4*Math.sin(t/20)};
   assert.deepEqual(w.step(input),other.step(input));
   assert.equal(canonicalSnapshot(a),canonicalSnapshot(b));
  }
  assert.deepEqual(Object.keys(w).sort(),['reset','snapshot','step']);
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{first.dispose();second.dispose();}
 const mirrored=createPlayerMovement();
 for(let i=0;i<660;i++)mirrored.step({x:25,y:0});
 const s=mirrored.snapshot();
 assert.equal(s.screens.home,null);
 assert.match(s.screens.away?.defenderId??'',/^away-[2-5]$/);
 assert.match(s.screens.away?.opponentId??'',/^home-(?:[2-9]|10|11)$/);
 const defender=s.players.find(p=>p.id===s.screens.away.defenderId);
 const threat=s.players.find(p=>p.id===s.screens.away.opponentId);
 assert.ok(defender.x>threat.x+0.8,'away screen must be on +X goal side');
 assert.ok(dist(defender,threat)>=PLAYER_MIN_SEPARATION_M-1e-7);
});
test('ME-PLAYER-04 repeatable zonal-screen assignments preserve speed/bounds and spacing',()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 let seen={home:false,away:false};
 for(let i=0;i<720;i++){
  const input={x:i%240<120?-25:25,y:7*Math.sin(i/44)};
  const s=a.step(input),copy=b.step(input);
  assert.deepEqual(s,copy);
  for(const side of ['home','away']){
   const screen=s.screens[side];
   if(screen){
    seen[side]=true;
    assert.notEqual(screen.defenderId,s.pressers[side]);
    assert.notEqual(screen.defenderId,s.coverers[side]);
    assert.equal(s.players.find(p=>p.id===screen.defenderId).role,'defender');
   }
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)
    assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});


test('ME-PLAYER-05 neutral territory has no fabricated free-space run',()=>{
 const w=createPlayerMovement(),baseline=w.snapshot();
 assert.deepEqual(baseline.supports,{home:null,away:null});
 assert.deepEqual(baseline.supportSwitches,{home:0,away:0});
 assert.ok(Object.isFrozen(baseline.supports)&&Object.isFrozen(baseline.supportSwitches));
 for(let t=0;t<180;t++){
  const x=w.step({x:0,y:Math.sin(t/40)*8});
  assert.deepEqual(x.supports,{home:null,away:null});
  assert.deepEqual(x.supportSwitches,{home:0,away:0});
 }
 assert.equal('possession' in w.snapshot(),false);
 assert.equal('ballOwner' in w.snapshot(),false);
 assert.equal(PLAYER_SUPPORT_DEPTH_M,8);
 assert.equal(PLAYER_SUPPORT_LANE_OFFSET_M,11);
 assert.equal(PLAYER_SUPPORT_ASSIGNMENT_HYSTERESIS_M,3);
 assert.equal(PLAYER_SUPPORT_LANE_HYSTERESIS_M,2.5);
});
test('ME-PLAYER-05 a free outfielder occupies a real opponent-measured channel',()=>{
 const w=createPlayerMovement();
 for(let t=0;t<420;t++)w.step({x:27,y:0});
 const s=w.snapshot(),run=s.supports.home;
 assert.equal(s.supports.away,null,'space search is limited to opposing third');
 assert.ok(run&&Object.isFrozen(run)&&Object.isFrozen(run.target));
 assert.match(run.playerId,/^home-(?:[6-9]|10|11)$/);
 assert.notEqual(run.playerId,s.pressers.home);
 assert.notEqual(run.playerId,s.coverers.home);
 assert.notEqual(run.playerId,s.screens.home?.defenderId);
 assert.equal(run.target.x,19,'support target follows behind ball');
 assert.ok(Math.abs(run.target.y)>=10,'support cannot simply chase ball centre');
 assert.ok(Number.isFinite(run.clearanceM)&&run.clearanceM>1);
 const p=s.players.find(p=>p.id===run.playerId);
 assert.ok(['midfielder','forward'].includes(p.role));
 assert.ok(dist(p,run.target)<0.1,'supporter moves smoothly to open channel');
 assert.deepEqual(s.supportSwitches,{home:1,away:0});
});
test('ME-PLAYER-05 symmetric opponent-third support on opposite team',()=>{
 const w=createPlayerMovement();
 for(let t=0;t<420;t++)w.step({x:-27,y:0});
 const s=w.snapshot(),run=s.supports.away;
 assert.equal(s.supports.home,null);
 assert.ok(run&&Object.isFrozen(run.target));
 assert.match(run.playerId,/^away-(?:[6-9]|10|11)$/);
 assert.notEqual(run.playerId,s.pressers.away);
 assert.equal(run.target.x,-19);
 assert.ok(Math.abs(run.target.y)>=10);
 assert.ok(dist(s.players.find(p=>p.id===run.playerId),run.target)<0.1);
 assert.deepEqual(s.supportSwitches,{home:0,away:1});
});
test('ME-PLAYER-05 lane and runner assignment resist sub-meter ball jitter',()=>{
 const w=createPlayerMovement();
 for(let i=0;i<420;i++)w.step({x:27,y:0});
 const a=w.snapshot(),previous=a.supports.home;
 assert.ok(previous);
 const initial=a.supportSwitches.home;
 for(let i=0;i<180;i++){
  const s=w.step({x:27,y:i%2===0?0.15:-0.15});
  assert.equal(s.supports.home?.playerId,previous.playerId);
  assert.equal(s.supports.home?.lane,previous.lane);
  assert.equal(s.supportSwitches.home,initial);
 }
 const middle=w.step({x:0,y:0});
 assert.equal(middle.supports.home,null);
 assert.equal(middle.supportSwitches.home,initial+1);
});
test('ME-PLAYER-05 flank support clamps targets and safe replay survives rapid ball swings',()=>{
 const flank=createPlayerMovement();
 for(let i=0;i<420;i++)flank.step({x:28,y:23});
 const s=flank.snapshot(),run=s.supports.home;
 assert.ok(run&&['negative-y','positive-y'].includes(run.lane));
 assert.ok(Math.abs(run.target.y)<=34-PLAYER_RADIUS_M);
 assert.ok(Math.abs(run.target.x)<=52.5-PLAYER_RADIUS_M);
 assert.ok(Number.isFinite(run.clearanceM));
 const a=createPlayerMovement(),b=createPlayerMovement();
 let seen={home:false,away:false};
 for(let t=0;t<720;t++){
  const ball={x:t%240<120?27:-27,y:7*Math.sin(t/40)};
  const x=a.step(ball),y=b.step(ball);
  assert.deepEqual(x,y,'same ball series => identical 60Hz state');
  for(const team of ['home','away']){
   const support=x.supports[team];
   if(support){
    seen[team]=true;
    assert.notEqual(support.playerId,x.pressers[team]);
    assert.notEqual(support.playerId,x.coverers[team]);
    assert.notEqual(support.playerId,x.screens[team]?.defenderId);
    assert.ok(['midfielder','forward'].includes(
     x.players.find(p=>p.id===support.playerId).role));
    assert.ok(Number.isFinite(support.clearanceM)&&support.clearanceM>=0);
   }
  }
  for(let i=0;i<x.players.length;i++){
   const p=x.players[i];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let j=0;j<i;j++)
    assert.ok(dist(p,x.players[j])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 assert.deepEqual(seen,{home:true,away:true});
 assert.deepEqual(Object.keys(a).sort(),['reset','snapshot','step']);
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});


test('ME-PLAYER-06 chooses teammate spacing over a crowded nominally clearer lane',()=>{
 assert.equal(PLAYER_SUPPORT_TEAM_SPACING_M,6);
 assert.equal(PLAYER_SUPPORT_TEAM_CROWD_PENALTY,2);
 assert.equal(PLAYER_SUPPORT_TEAM_CLEARANCE_WEIGHT,0.4);
 // With no teammate coordination, the 10m opponent-clear lane wins.
 // The new scoring function rejects its 1m teammate crowding instead.
 const crowded=scoreCooperativeSupportSlot(10,1,1);
 const cooperative=scoreCooperativeSupportSlot(6,10,1);
 assert.ok(cooperative>crowded+5);
 const equalOppA=scoreCooperativeSupportSlot(8,2,0);
 const equalOppB=scoreCooperativeSupportSlot(8,9,0);
 assert.ok(equalOppB>equalOppA);
 for(const input of [[NaN,4,0],[1,Infinity,0],[-1,5,0],[1,5,-0.1],['1',2,0]])
  assert.throws(()=>scoreCooperativeSupportSlot(...input),/Finite nonnegative/);
});
test('ME-PLAYER-06 no imaginary cooperative run and immutable initial metrics',()=>{
 const w=createPlayerMovement(),start=w.snapshot();
 assert.deepEqual(start.supports,{home:null,away:null});
 for(let t=0;t<150;t++){
  const s=w.step({x:0,y:Math.sin(t/35)*6});
  assert.deepEqual(s.supports,{home:null,away:null});
  assert.equal(s.supportSwitches.home,0);
  assert.equal(s.supportSwitches.away,0);
 }
 assert.equal('possession' in w.snapshot(),false);
 assert.equal('ballOwner' in w.snapshot(),false);
});
test('ME-PLAYER-06 distances are actual sampled teammate and opponent coordinates',()=>{
 const w=createPlayerMovement();
 for(let t=0;t<420;t++)w.step({x:27,y:0});
 // supportSpace evaluates the player coordinates BEFORE the next 60Hz step.
 const before=w.snapshot();
 const next=w.step({x:27,y:0});
 const run=next.supports.home;
 assert.ok(run&&Object.isFrozen(run)&&Object.isFrozen(run.target));
 assert.ok(Number.isFinite(run.teammateClearanceM));
 assert.ok(run.teammateClearanceM>=0);
 const teammates=before.players.filter(p=>p.team==='home'&&p.id!==run.playerId);
 const opponents=before.players.filter(p=>p.team==='away');
 const nearest=group=>Math.min(...group.map(p=>dist(p,run.target)));
 close(run.teammateClearanceM,nearest(teammates),1e-8);
 close(run.clearanceM,nearest(opponents),1e-8);
 assert.ok(run.teammateClearanceM>=PLAYER_SUPPORT_TEAM_SPACING_M);
 assert.equal(next.supports.away,null);
 assert.equal(next.supportSwitches.home,1);
 assert.notEqual(next.pressers.home,run.playerId);
});
test('ME-PLAYER-06 cooperative lane measurements mirror in both teams',()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let t=0;t<420;t++){
  a.step({x:27,y:0});b.step({x:-27,y:0});
 }
 const home=a.snapshot().supports.home,away=b.snapshot().supports.away;
 assert.ok(home&&away);
 assert.equal(home.lane,away.lane);
 close(home.target.x,-away.target.x);
 close(home.target.y,away.target.y);
 close(home.teammateClearanceM,away.teammateClearanceM);
 close(home.clearanceM,away.clearanceM);
 assert.equal(a.snapshot().supports.away,null);
 assert.equal(b.snapshot().supports.home,null);
});
test('ME-PLAYER-06 stable teammate-aware corridor through small ball fluctuations',()=>{
 const w=createPlayerMovement();
 for(let i=0;i<420;i++)w.step({x:27,y:0});
 const initial=w.snapshot(),support=initial.supports.home;
 assert.ok(support);
 for(let i=0;i<180;i++){
  const s=w.step({x:27,y:i%2?0.15:-0.15});
  assert.equal(s.supports.home?.playerId,support.playerId);
  assert.equal(s.supports.home?.lane,support.lane);
  assert.equal(s.supportSwitches.home,initial.supportSwitches.home);
  assert.ok(Number.isFinite(s.supports.home?.teammateClearanceM));
 }
 const cleared=w.step({x:0,y:0});
 assert.equal(cleared.supports.home,null);
 assert.equal(cleared.supportSwitches.home,initial.supportSwitches.home+1);
});
test('ME-PLAYER-06 deterministic 60Hz rapid transition keeps formation and body spacing',()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 let seen={home:false,away:false};
 for(let i=0;i<600;i++){
  const ball={x:i%200<100?27:-27,y:15*Math.sin(i/23)};
  const x=a.step(ball),y=b.step(ball);
  assert.deepEqual(x,y);
  for(const team of ['home','away']){
   const run=x.supports[team];
   if(!run)continue;
   seen[team]=true;
   assert.ok(Number.isFinite(run.teammateClearanceM)&&run.teammateClearanceM>=0);
   assert.ok(Number.isFinite(run.clearanceM)&&run.clearanceM>=0);
   assert.ok(Math.abs(run.target.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(run.target.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.notEqual(run.playerId,x.pressers[team]);
   assert.notEqual(run.playerId,x.coverers[team]);
   assert.notEqual(run.playerId,x.screens[team]?.defenderId);
  }
  for(let j=0;j<x.players.length;j++){
   const p=x.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)
    assert.ok(dist(p,x.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8,
      'no overlapping 22-player bodies');
  }
 }
 assert.deepEqual(seen,{home:true,away:true});
 assert.deepEqual(Object.keys(a).sort(),['reset','snapshot','step']);
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});


test('ME-PLAYER-07 keeper goal-angle targets are mirrored, clamped, immutable',()=>{
 const home=goalkeeperPosition('home',{x:0,y:0});
 const away=goalkeeperPosition('away',{x:0,y:0});
 assert.ok(Object.isFrozen(home)&&Object.isFrozen(away));
 close(home.x,-away.x);close(home.y,away.y);close(home.depthM,away.depthM);
 close(home.depthM,6.4375);
 assert.equal(PLAYER_KEEPER_MIN_DEPTH_M,2.5);
 assert.equal(PLAYER_KEEPER_MAX_DEPTH_M,9);
 assert.equal(PLAYER_KEEPER_DEPTH_GAIN,0.075);
 assert.equal(PLAYER_KEEPER_MAX_LATERAL_M,5.5);
 for(const ball of [{x:-51,y:20},{x:-30,y:-20},{x:30,y:30},{x:52.5,y:34}]){
  const a=goalkeeperPosition('home',ball);
  const b=goalkeeperPosition('away',{x:-ball.x,y:ball.y});
  close(a.x,-b.x);close(a.y,b.y);close(a.depthM,b.depthM);
  assert.ok(a.x>=-52.5+PLAYER_KEEPER_MIN_DEPTH_M);
  assert.ok(a.x<=-52.5+PLAYER_KEEPER_MAX_DEPTH_M);
  assert.ok(Math.abs(a.y)<=PLAYER_KEEPER_MAX_LATERAL_M+1e-8);
 }
});
test('ME-PLAYER-07 nearby ball causes keeper retreat and capped lateral angle',()=>{
 const near=goalkeeperPosition('home',{x:-48,y:20});
 const far=goalkeeperPosition('home',{x:40,y:20});
 assert.ok(near.x<far.x&&far.depthM>near.depthM+5);
 assert.ok(near.y>4&&far.y>0&&far.y<near.y);
 close(near.y,-goalkeeperPosition('home',{x:-48,y:-20}).y);
 assert.throws(()=>goalkeeperPosition('other',{x:0,y:0}),/Known goalkeeper team/);
 for(const bad of [null,{x:NaN,y:0},{x:0,y:Infinity},{x:'3',y:4}])
  assert.throws(()=>goalkeeperPosition('home',bad),/Finite ball XY state/);
});
test('ME-PLAYER-07 goalkeeper targets drive only #1 with 60Hz kinematic convergence',()=>{
 const w=createPlayerMovement(),initial=w.snapshot();
 assert.ok(Object.isFrozen(initial.keeperTargets));
 assert.ok(Object.isFrozen(initial.keeperTargets.home));
 assert.deepEqual(initial.keeperTargets.home,goalkeeperPosition('home',{x:0,y:0}));
 for(let i=0;i<480;i++)w.step({x:-51,y:20});
 const s=w.snapshot();
 for(const side of ['home','away']){
  const p=s.players.find(p=>p.id===side+'-1');
  assert.equal(p.role,'goalkeeper');
  assert.ok(dist(p,s.keeperTargets[side])<0.05);
  assert.notEqual(s.pressers[side],p.id);
  assert.notEqual(s.coverers[side],p.id);
  assert.notEqual(s.screens[side]?.defenderId,p.id);
  assert.notEqual(s.supports[side]?.playerId,p.id);
 }
 assert.ok(s.players.find(p=>p.id==='home-1').y>3);
 assert.ok(!('save' in s)&&!('possession' in s)&&!('touch' in s));
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-07 rapid changes preserve deterministic replay and body separation',()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 let prev=a.snapshot(),maxKeeperSpeed=0,maxSide=0;
 for(let tick=0;tick<600;tick++){
  const ball={x:51*Math.sin(tick/27),y:33*Math.cos(tick/35)};
  const s=a.step(ball),copy=b.step(ball);
  assert.deepEqual(s,copy);
  for(const side of ['home','away']){
   const p=s.players.find(p=>p.id===side+'-1');
   const before=prev.players.find(q=>q.id===p.id);
   maxSide=Math.max(maxSide,Math.abs(p.y));
   maxKeeperSpeed=Math.max(maxKeeperSpeed,Math.hypot(p.vx,p.vy));
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   assert.ok(Math.hypot(p.x-before.x,p.y-before.y)<=PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-8);
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=PLAYER_KEEPER_MAX_LATERAL_M+0.2);
  }
  for(let i=0;i<s.players.length;i++)for(let j=0;j<i;j++)
   assert.ok(dist(s.players[i],s.players[j])>=PLAYER_MIN_SEPARATION_M-1e-8);
  prev=s;
 }
 assert.ok(maxKeeperSpeed>1&&maxSide>1);
 assert.deepEqual(Object.keys(a).sort(),['reset','snapshot','step']);
});
test('ME-PLAYER-07 keeper position does not affect deterministic Rapier ball',async()=>{
 const R=await initializeRapier(wasm);
 const a=createEngine(R,{preset:'roll',seed:'keeper-isolation'});
 const b=createEngine(R,{preset:'roll',seed:'keeper-isolation'});
 const w=createPlayerMovement();
 try{
  for(let i=0;i<150;i++){
   const x=a.step(),y=b.step();
   w.step(x.ball.position);
   assert.equal(canonicalSnapshot(x),canonicalSnapshot(y));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{a.dispose();b.dispose();}
});


test('ME-PLAYER-08 no fictional defensive recovery from ball territory alone',()=>{
 const w=createPlayerMovement(),start=w.snapshot();
 assert.deepEqual(start.recoveries,{home:null,away:null});
 assert.deepEqual(start.recoverySwitches,{home:0,away:0});
 assert.ok(Object.isFrozen(start.recoveries));
 assert.ok(Object.isFrozen(start.recoverySwitches));
 const first=w.step({x:-25,y:0});
 assert.equal(first.ballSector.third,'home-third');
 assert.equal(first.screens.home,null);
 assert.deepEqual(first.recoveries,{home:null,away:null});
 assert.equal(first.recoverySwitches.home,0);
 for(let i=0;i<120;i++){
  const s=w.step({x:0,y:Math.sin(i/30)});
  assert.deepEqual(s.recoveries,{home:null,away:null});
 }
 assert.equal('possession' in w.snapshot(),false);
 assert.equal('attackingTeam' in w.snapshot(),false);
});
test('ME-PLAYER-08 observed opponent triggers separate midfield and defender recovery',()=>{
 const w=createPlayerMovement();
 let firstTick=null;
 for(let i=0;i<660;i++){
  const s=w.step({x:-25,y:0});
  if(s.recoveries.home&&!firstTick)firstTick=i+1;
 }
 const s=w.snapshot(),rec=s.recoveries.home;
 assert.ok(firstTick>1,'requires an actual opponent entering the threatened corridor');
 assert.ok(rec&&Object.isFrozen(rec)&&Object.isFrozen(rec.playerIds));
 assert.equal(rec.opponentId,s.screens.home.opponentId);
 assert.match(rec.opponentId,/^away-(?:[2-9]|10|11)$/);
 assert.equal(s.recoveries.away,null);
 assert.equal(s.recoverySwitches.home,1);
 assert.ok(rec.playerIds.length>=3);
 assert.ok(rec.playerIds.some(id=>s.players.find(p=>p.id===id).role==='defender'));
 assert.ok(rec.playerIds.some(id=>s.players.find(p=>p.id===id).role==='midfielder'));
 for(const id of rec.playerIds){
  const p=s.players.find(p=>p.id===id);
  assert.equal(p.team,'home');
  assert.ok(['defender','midfielder'].includes(p.role));
  assert.notEqual(id,s.pressers.home);
  assert.notEqual(id,s.coverers.home);
  assert.notEqual(id,s.screens.home.defenderId);
  assert.notEqual(id,s.supports.home?.playerId);
 }
});
test('ME-PLAYER-08 goal-side and lateral recovery targets are mirrored and bounded',()=>{
 assert.equal(PLAYER_RECOVERY_GOALSIDE_M,4);
 assert.equal(PLAYER_RECOVERY_LANE_GAIN,0.14);
 assert.equal(PLAYER_RECOVERY_MAX_LATERAL_M,3);
 const a=recoverySupportTarget({x:-25,y:0},'home',{x:-20,y:10});
 const b=recoverySupportTarget({x:25,y:0},'away',{x:20,y:10});
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(b));
 close(a.x,-29);close(b.x,29);
 close(a.y,1.4);close(b.y,1.4);
 const flank=recoverySupportTarget({x:-34,y:-22},'home',{x:-12,y:30});
 close(flank.x,-38);
 close(flank.y,-19); // max 3m lateral adjustment
 assert.ok(Math.abs(flank.y)<=34-PLAYER_RADIUS_M);
 const edge=recoverySupportTarget({x:-52,y:33},'home',{x:-25,y:34});
 assert.ok(edge.x>=-52.5+PLAYER_RADIUS_M);
 assert.ok(edge.y<=34-PLAYER_RADIUS_M);
 assert.throws(()=>recoverySupportTarget({x:0,y:0},'neutral',{x:0,y:0}),/Known team/);
 for(const bad of [null,{x:NaN,y:0},{x:0,y:Infinity}])
  assert.throws(()=>recoverySupportTarget(bad,'home',{x:0,y:0}),/Finite recovery/);
});
test('ME-PLAYER-08 own-third tracking leaves no lasting recovery when ball exits',()=>{
 const w=createPlayerMovement();
 for(let i=0;i<660;i++)w.step({x:-25,y:0});
 const before=w.snapshot();
 assert.ok(before.recoveries.home);
 const after=w.step({x:0,y:0});
 assert.deepEqual(after.recoveries,{home:null,away:null});
 assert.equal(after.recoverySwitches.home,before.recoverySwitches.home+1);
 assert.equal(after.recoverySwitches.away,0);
 const mirrored=createPlayerMovement();
 for(let i=0;i<660;i++)mirrored.step({x:25,y:0});
 const a=mirrored.snapshot();
 assert.equal(a.recoveries.home,null);
 assert.ok(a.recoveries.away);
 assert.equal(a.recoveries.away.opponentId,a.screens.away.opponentId);
 assert.deepEqual(a.recoveries.away.playerIds.map(x=>x.replace('away-','home-')),
  before.recoveries.home.playerIds);
});
test('ME-PLAYER-08 opposing third switches preserve deterministic movement and ball independence',async()=>{
 const w=createPlayerMovement(),copy=createPlayerMovement();
 let seen={home:false,away:false};
 for(let i=0;i<720;i++){
  const ball={x:i%240<120?-25:25,y:8*Math.sin(i/30)};
  const s=w.step(ball),mirror=copy.step(ball);
  assert.deepEqual(s,mirror);
  for(const team of ['home','away']){
   if(s.recoveries[team])seen[team]=true;
   for(const id of s.recoveries[team]?.playerIds||[]){
    assert.ok(s.players.some(p=>p.id===id&&p.role!=='goalkeeper'));
    assert.notEqual(id,s.pressers[team]);
    assert.notEqual(id,s.coverers[team]);
    assert.notEqual(id,s.screens[team]?.defenderId);
   }
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)assert.ok(
    dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 // The demanding rapid-third stress replay does not necessarily permit
 // opposing pressers to physically reach the recovery trigger in 2s windows.
 assert.deepEqual(Object.keys(w).sort(),['reset','snapshot','step']);
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
 const R=await initializeRapier(wasm);
 const a=createEngine(R,{preset:'roll',seed:'collective-recovery-ball-isolated'});
 const b=createEngine(R,{preset:'roll',seed:'collective-recovery-ball-isolated'});
 try{
  for(let i=0;i<90;i++){
   const x=a.step(),y=b.step();
   w.step(x.ball.position);
   assert.equal(canonicalSnapshot(x),canonicalSnapshot(y));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{a.dispose();b.dispose();}
});

test('ME-PLAYER-09 weak-side assignments require real opposing threat',()=>{
 const w=createPlayerMovement(),s=w.snapshot();
 assert.deepEqual(s.balances,{home:null,away:null});
 assert.deepEqual(s.balanceSwitches,{home:0,away:0});
 assert.ok(Object.isFrozen(s.balances)&&Object.isFrozen(s.balanceSwitches));
 const entry=w.step({x:-25,y:0});
 assert.equal(entry.screens.home,null);
 assert.deepEqual(entry.balances,{home:null,away:null});
 for(let i=0;i<120;i++)assert.deepEqual(w.step({x:0,y:0}).balances,
  {home:null,away:null});
 assert.equal('possession' in w.snapshot(),false);
});
test('ME-PLAYER-09 observed opponent yields exclusive far-side defender',()=>{
 const w=createPlayerMovement();
 for(let i=0;i<660;i++)w.step({x:-25,y:0});
 const s=w.snapshot(),b=s.balances.home;
 assert.ok(s.screens.home);
 assert.ok(b&&Object.isFrozen(b));
 assert.equal(b.opponentId,s.screens.home.opponentId);
 assert.equal(s.balances.away,null);
 const defender=s.players.find(p=>p.id===b.playerId);
 const opponent=s.players.find(p=>p.id===b.opponentId);
 assert.equal(defender.role,'defender');
 assert.ok(Math.abs(defender.baseY-opponent.y)>=PLAYER_BALANCE_MIN_LANE_DISTANCE_M);
 for(const id of [s.pressers.home,s.coverers.home,
  s.screens.home.defenderId,s.supports.home?.playerId,
  ...(s.recoveries.home?.playerIds||[])])
  assert.notEqual(id,b.playerId);
 assert.equal(s.balanceSwitches.home,1);
});
test('ME-PLAYER-09 mirrored weak-side targets are pure and bounded',()=>{
 assert.equal(PLAYER_BALANCE_GOALSIDE_M,2);
 assert.equal(PLAYER_BALANCE_LANE_GAIN,0.10);
 assert.equal(PLAYER_BALANCE_MAX_LATERAL_M,2);
 const h=weakSideBalanceTarget({x:-35,y:-16},'home',{x:-20,y:10});
 const a=weakSideBalanceTarget({x:35,y:-16},'away',{x:20,y:10});
 assert.ok(Object.isFrozen(h)&&Object.isFrozen(a));
 close(h.x,-37);close(a.x,37);close(h.y,-18);close(a.y,-18);
 const edge=weakSideBalanceTarget({x:-52,y:-33},'home',{x:-20,y:33});
 assert.ok(edge.x>=-52.5+PLAYER_RADIUS_M);
 assert.ok(edge.y>=-34+PLAYER_RADIUS_M);
 assert.throws(()=>weakSideBalanceTarget({x:0,y:0},'neutral',{x:0,y:0}),/Known balance/);
 for(const bad of [null,{x:NaN,y:0},{x:0,y:Infinity}])
  assert.throws(()=>weakSideBalanceTarget(bad,'home',{x:0,y:0}),/Finite weak-side/);
});
test('ME-PLAYER-09 mirrored assignment, jitter stability, and exit deactivation',()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let i=0;i<660;i++){a.step({x:-25,y:0});b.step({x:25,y:0});}
 const h=a.snapshot(),v=b.snapshot();
 assert.ok(h.balances.home&&v.balances.away);
 assert.equal(h.balances.home.playerId.split('-')[1],v.balances.away.playerId.split('-')[1]);
 const incumbent=h.balances.home,c=h.balanceSwitches.home;
 for(let i=0;i<90;i++){
  const s=a.step({x:-25,y:i%2?0.15:-0.15});
  assert.deepEqual(s.balances.home,incumbent);
  assert.equal(s.balanceSwitches.home,c);
 }
 const off=a.step({x:0,y:0});
 assert.deepEqual(off.balances,{home:null,away:null});
 assert.equal(off.balanceSwitches.home,c+1);
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-09 720-tick deterministic replay, separation and ball isolation',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let i=0;i<720;i++){
  const ball={x:i%260<130?-25:25,y:12*Math.sin(i/27)};
  const s=a.step(ball),copy=b.step(ball);
  assert.deepEqual(s,copy);
  for(const side of ['home','away']){
   const bal=s.balances[side];
   if(bal){
    assert.equal(bal.opponentId,s.screens[side]?.opponentId);
    assert.notEqual(bal.playerId,s.pressers[side]);
    assert.notEqual(bal.playerId,s.coverers[side]);
    assert.ok(!s.recoveries[side]?.playerIds.includes(bal.playerId));
   }
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'weak-side'}),y=createEngine(R,{preset:'roll',seed:'weak-side'});
 try{
  for(let i=0;i<100;i++){
   const q=x.step(),r=y.step();
   a.step(q.ball.position);
   assert.equal(canonicalSnapshot(q),canonicalSnapshot(r));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
});

test('ME-PLAYER-10 no fictional line reaction from ball territory or first paint',()=>{
 const w=createPlayerMovement(),initial=w.snapshot();
 assert.deepEqual(initial.lineResponses,{home:null,away:null});
 assert.ok(Object.isFrozen(initial.lineResponses));
 const entered=w.step({x:-25,y:0});
 assert.deepEqual(entered.lineResponses,{home:null,away:null});
 assert.equal(entered.screens.home,null);
 for(let tick=0;tick<120;tick++)
  assert.deepEqual(w.step({x:0,y:0}).lineResponses,{home:null,away:null});
 assert.equal('possession' in w.snapshot(),false);
});
test('ME-PLAYER-10 responds only to real screen and real recovering line assignments',()=>{
 const w=createPlayerMovement();
 for(let i=0;i<660;i++)w.step({x:-25,y:0});
 const s=w.snapshot(),line=s.lineResponses.home,rec=s.recoveries.home;
 assert.ok(line&&Object.isFrozen(line));
 assert.equal(line.opponentId,s.screens.home.opponentId);
 assert.equal(line.opponentId,rec.opponentId);
 assert.equal(s.lineResponses.away,null);
 const opponent=s.players.find(p=>p.id===line.opponentId);
 assert.equal(opponent.team,'away');
 close(line.progress,observedThreatProgress('home',opponent));
 assert.ok(line.progress>0&&line.progress<=1);
 assert.equal(line.defenders,rec.playerIds.filter(id=>s.players.find(p=>p.id===id).role==='defender').length);
 assert.equal(line.midfielders,rec.playerIds.filter(id=>s.players.find(p=>p.id===id).role==='midfielder').length);
 assert.ok(line.defenders>=0&&line.midfielders>=1);
 assert.equal(line.defenders+line.midfielders,rec.playerIds.length);
 close(line.defenderExtraM,PLAYER_LINE_DEFENDER_MAX_EXTRA_M*line.progress);
 close(line.midfielderExtraM,PLAYER_LINE_MIDFIELDER_MAX_EXTRA_M*line.progress);
 assert.ok(line.midfielderExtraM>line.defenderExtraM);
 assert.ok(!rec.playerIds.includes(s.balances.home.playerId));
});
test('ME-PLAYER-10 coordinated targets deepen progressively and shift laterally per role',()=>{
 assert.equal(PLAYER_LINE_DEFENDER_MAX_EXTRA_M,1.5);
 assert.equal(PLAYER_LINE_MIDFIELDER_MAX_EXTRA_M,2.5);
 assert.equal(PLAYER_LINE_EXTRA_LANE_MAX_M,1.5);
 const normal={x:-25,y:0},threat={x:-45,y:20};
 const baseline=recoverySupportTarget(normal,'home',threat);
 const def=coordinatedLineTarget(normal,'home','defender',threat);
 const mid=coordinatedLineTarget(normal,'home','midfielder',threat);
 assert.ok(Object.isFrozen(def)&&Object.isFrozen(mid));
 assert.ok(def.x<baseline.x&&mid.x<def.x);
 assert.ok(def.y>baseline.y&&mid.y>def.y);
 assert.ok(mid.y-baseline.y<=PLAYER_LINE_EXTRA_LANE_MAX_M+1e-8);
 const shallow=coordinatedLineTarget(normal,'home','defender',{x:-10,y:20});
 close(shallow.x,baseline.x);
 assert.ok(def.x<shallow.x);
 const awayDef=coordinatedLineTarget({x:25,y:0},'away','defender',{x:45,y:20});
 const awayMid=coordinatedLineTarget({x:25,y:0},'away','midfielder',{x:45,y:20});
 close(awayDef.x,-def.x);close(awayMid.x,-mid.x);
 close(awayDef.y,def.y);close(awayMid.y,mid.y);
 const edge=coordinatedLineTarget({x:-52,y:33},'home','midfielder',{x:-52.5,y:34});
 assert.ok(edge.x>=-52.5+PLAYER_RADIUS_M);
 assert.ok(edge.y<=34-PLAYER_RADIUS_M);
 for(const bad of [null,{x:NaN,y:0},{x:0,y:Infinity}])
  assert.throws(()=>coordinatedLineTarget(normal,'home','defender',bad),/Finite/);
 assert.throws(()=>coordinatedLineTarget(normal,'home','goalkeeper',threat),/Only eligible/);
 assert.throws(()=>coordinatedLineTarget(normal,'neutral','defender',threat),/Known team/);
 assert.throws(()=>observedThreatProgress('away',{x:Infinity,y:1}),/Finite/);
});
test('ME-PLAYER-10 mirrored observations, stable threat and immediate clearing',()=>{
 const home=createPlayerMovement(),away=createPlayerMovement();
 for(let i=0;i<660;i++){home.step({x:-25,y:0});away.step({x:25,y:0});}
 const a=home.snapshot(),b=away.snapshot();
 assert.ok(a.lineResponses.home&&b.lineResponses.away);
 close(a.lineResponses.home.progress,b.lineResponses.away.progress);
 close(a.lineResponses.home.defenderExtraM,b.lineResponses.away.defenderExtraM);
 close(a.lineResponses.home.midfielderExtraM,b.lineResponses.away.midfielderExtraM);
 const firstOpponent=a.lineResponses.home.opponentId;
 for(let i=0;i<90;i++){
  const s=home.step({x:-25,y:i%2?0.15:-0.15});
  assert.equal(s.lineResponses.home.opponentId,firstOpponent);
  assert.equal(s.lineResponses.away,null);
 }
 const exit=home.step({x:0,y:0});
 assert.deepEqual(exit.lineResponses,{home:null,away:null});
 assert.deepEqual(home.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-10 sustained alternating threats preserve deterministic 60Hz and Rapier isolation',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 let seen={home:false,away:false};
 for(let i=0;i<900;i++){
  const ball={x: i%450<225?-25:25,y:9*Math.sin(i/28)};
  const s=a.step(ball),mirror=b.step(ball);
  assert.deepEqual(s,mirror);
  for(const team of ['home','away']){
   const line=s.lineResponses[team];
   if(line){
    seen[team]=true;
    assert.equal(line.opponentId,s.screens[team]?.opponentId);
    assert.equal(line.defenders+line.midfielders,s.recoveries[team].playerIds.length);
    assert.ok(line.defenderExtraM>=0&&line.defenderExtraM<=PLAYER_LINE_DEFENDER_MAX_EXTRA_M);
    assert.ok(line.midfielderExtraM>=0&&line.midfielderExtraM<=PLAYER_LINE_MIDFIELDER_MAX_EXTRA_M);
   }
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 assert.deepEqual(Object.keys(a).sort(),['reset','snapshot','step']);
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'coordinated-lines-ball-isolated'});
 const y=createEngine(R,{preset:'roll',seed:'coordinated-lines-ball-isolated'});
 try{
  for(let i=0;i<100;i++){
   const f=x.step(),g=y.step();
   a.step(f.ball.position);
   assert.equal(canonicalSnapshot(f),canonicalSnapshot(g));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
});

test('ME-PLAYER-11 pure relative-intent interpolation bounds every 60Hz change',()=>{
 assert.equal(PLAYER_LINE_INTENT_EASE_MPS,8);
 assert.equal(PLAYER_DT,1/60);
 const maxDelta=PLAYER_LINE_INTENT_EASE_MPS*PLAYER_DT;
 const origin=Object.freeze({x:0,y:0});
 const first=advanceLineIntentOffset(origin,{x:6,y:8});
 assert.ok(Object.isFrozen(first));
 close(Math.hypot(first.x,first.y),maxDelta);
 close(first.x,0.6*maxDelta);
 close(first.y,0.8*maxDelta);
 assert.deepEqual(origin,{x:0,y:0});
 const opposite=advanceLineIntentOffset(first,{x:-6,y:-8});
 assert.ok(Math.hypot(opposite.x-first.x,opposite.y-first.y)<=maxDelta+1e-8);
 assert.deepEqual(advanceLineIntentOffset({x:0.1,y:0},{x:0,y:0}),{x:0,y:0});
 assert.deepEqual(advanceLineIntentOffset({x:1e-10,y:0},{x:0,y:0}),{x:0,y:0});
 assert.ok(PLAYER_LINE_INTENT_SETTLED_EPS_M<1e-6);
 for(const bad of [null,{x:NaN,y:0},{x:1,y:Infinity},{x:undefined,y:0}]) {
  assert.throws(()=>advanceLineIntentOffset(bad,{x:0,y:0}),/Finite/);
  assert.throws(()=>advanceLineIntentOffset({x:0,y:0},bad),/Finite/);
 }
});
test('ME-PLAYER-11 first paint and territory alone have no ghost transitions',()=>{
 const w=createPlayerMovement(),s=w.snapshot();
 assert.deepEqual(s.lineTransitions,{
  home:{engaging:0,releasing:0,maxOffsetM:0},
  away:{engaging:0,releasing:0,maxOffsetM:0}
 });
 assert.ok(Object.isFrozen(s.lineTransitions));
 assert.ok(Object.isFrozen(s.lineTransitions.home));
 assert.equal(w.step({x:-25,y:0}).lineTransitions.home.engaging,0);
 for(let i=0;i<90;i++){
  const x=w.step({x:0,y:0});
  assert.equal(x.lineTransitions.home.engaging,0);
  assert.equal(x.lineTransitions.home.releasing,0);
 }
 assert.equal('possession' in w.snapshot(),false);
});
test('ME-PLAYER-11 observed threat eases in, then disappears with a bounded release',()=>{
 const w=createPlayerMovement();
 let first=null;
 for(let i=0;i<660;i++){
  const s=w.step({x:-25,y:0});
  if(!first&&s.lineTransitions.home.engaging)first=s;
 }
 const active=w.snapshot();
 assert.ok(first,'must see an actual opposing player before easing starts');
 assert.ok(first.lineResponses.home&&first.recoveries.home);
 assert.ok(first.lineTransitions.home.maxOffsetM>0);
 assert.ok(first.lineTransitions.home.maxOffsetM<=
  PLAYER_LINE_INTENT_EASE_MPS*PLAYER_DT+1e-8);
 assert.ok(active.lineTransitions.home.engaging>=1);
 assert.equal(active.lineTransitions.away.engaging,0);
 const off=w.step({x:0,y:0});
 assert.equal(off.screens.home,null);
 assert.equal(off.recoveries.home,null);
 assert.equal(off.lineResponses.home,null);
 assert.equal(off.lineTransitions.home.engaging,0);
 assert.ok(off.lineTransitions.home.releasing>=1,
  'release is old spatial offset, never a phantom opponent');
 const maxDelta=PLAYER_LINE_INTENT_EASE_MPS*PLAYER_DT;
 let previous=off.lineTransitions.home.maxOffsetM;
 let clearTick=null;
 for(let i=1;i<=150;i++){
  const s=w.step({x:0,y:0});
  assert.equal(s.lineResponses.home,null);
  assert.equal(s.recoveries.home,null);
  assert.equal(s.lineTransitions.home.engaging,0);
  assert.ok(s.lineTransitions.home.maxOffsetM<=previous+1e-8);
  assert.ok(previous-s.lineTransitions.home.maxOffsetM<=maxDelta+1e-8);
  previous=s.lineTransitions.home.maxOffsetM;
  if(!s.lineTransitions.home.releasing){clearTick=i;break;}
 }
 assert.ok(clearTick!==null&&clearTick<=150,'all previous spatial offsets settle');
 assert.deepEqual(w.snapshot().lineTransitions.home,
  {engaging:0,releasing:0,maxOffsetM:0});
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-11 threat lane changes preserve bounded intent and role priority',()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let i=0;i<660;i++){a.step({x:-25,y:0});b.step({x:25,y:0});}
 assert.ok(a.snapshot().lineTransitions.home.engaging>=1);
 assert.ok(b.snapshot().lineTransitions.away.engaging>=1);
 close(a.snapshot().lineTransitions.home.maxOffsetM,
  b.snapshot().lineTransitions.away.maxOffsetM);
 let last=a.snapshot().screens.home?.opponentId;
 for(let i=0;i<360;i++){
  const ball={x:-25,y:i%120<60?-20:20};
  const s=a.step(ball);
  const current=s.screens.home?.opponentId;
  if(last!==current)assert.ok(s.screenSwitches.home>=1);
  last=current;
  assert.ok(s.lineTransitions.home.maxOffsetM>=0);
  assert.ok(s.lineTransitions.home.maxOffsetM<=9);
  assert.equal(s.lineResponses.home?.opponentId??null,
   s.screens.home?.opponentId??null);
  assert.equal(s.lineTransitions.away.engaging,0);
  for(const id of [s.pressers.home,s.coverers.home,
   s.screens.home?.defenderId,s.balances.home?.playerId]){
   if(id)assert.ok(!s.recoveries.home?.playerIds.includes(id));
  }
 }
});
test('ME-PLAYER-11 900-tick deterministic transitions, separation and ball isolation',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let i=0;i<900;i++){
  const ball={x:i%300<150?-25:i%300<230?0:25,y:14*Math.sin(i/21)};
  const s=a.step(ball),copy=b.step(ball);
  assert.deepEqual(s,copy);
  for(const side of ['home','away']){
   const tr=s.lineTransitions[side];
   assert.ok(Object.isFrozen(tr));
   assert.ok(tr.engaging>=0&&tr.releasing>=0&&tr.engaging+tr.releasing<=7);
   assert.ok(tr.maxOffsetM>=0&&tr.maxOffsetM<=9);
   if(!s.lineResponses[side])assert.equal(tr.engaging,0);
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'eased-lines-ball-independent'});
 const y=createEngine(R,{preset:'roll',seed:'eased-lines-ball-independent'});
 try{
  for(let i=0;i<100;i++){
   const q=x.step(),r=y.step();
   a.step(q.ball.position);
   assert.equal(canonicalSnapshot(q),canonicalSnapshot(r));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
});

test('ME-PLAYER-12 real teammate lines are symmetric and neutral at 15m',()=>{
 assert.equal(PLAYER_COHESION_MIN_GAP_M,10);
 assert.equal(PLAYER_COHESION_MAX_GAP_M,19);
 assert.equal(PLAYER_COHESION_LATERAL_TOLERANCE_M,6);
 const home=measureLineCohesion(INITIAL_PLAYERS,'home');
 const away=measureLineCohesion(INITIAL_PLAYERS,'away');
 assert.ok(Object.isFrozen(home)&&Object.isFrozen(away));
 for(const team of [home,away]){
  close(team.gapM,15);close(team.lateralDriftM,0);
  assert.equal(team.defenders,4);assert.equal(team.midfielders,3);
  assert.ok(Object.isFrozen(team.defenderShift));
  assert.ok(Object.isFrozen(team.midfielderShift));
  for(const s of [team.defenderShift,team.midfielderShift]){
   close(s.x,0);close(s.y,0);
  }
 }
 assert.deepEqual(
  lineCohesionTarget({x:-30,y:-8},'home','defender',home),
  {x:-30,y:-8});
 assert.equal(measureLineCohesion(INITIAL_PLAYERS.filter(p=>p.role==='forward'),'home'),null);
 assert.throws(()=>measureLineCohesion([], 'neutral'),/Known cohesion/);
 assert.throws(()=>measureLineCohesion(null,'home'),/Line players/);
 assert.throws(()=>measureLineCohesion([{team:'home',role:'defender',x:NaN,y:0},
  {team:'home',role:'midfielder',x:-20,y:0}],'home'),/Finite teammate/);
});
test('ME-PLAYER-12 wide and compressed lines get bounded opposite corrections',()=>{
 const sample=(defX,midX,midY)=>[
  {team:'home',role:'defender',x:defX,y:0},
  {team:'home',role:'defender',x:defX,y:0},
  {team:'home',role:'midfielder',x:midX,y:midY},
  {team:'home',role:'midfielder',x:midX,y:midY}
 ];
 const wide=measureLineCohesion(sample(-36,-5,16),'home');
 close(wide.gapM,31);close(wide.lateralDriftM,16);
 assert.ok(wide.defenderShift.x>0&&wide.midfielderShift.x<0);
 assert.ok(wide.defenderShift.y>0&&wide.midfielderShift.y<0);
 close(wide.defenderShift.x,PLAYER_COHESION_DEFENDER_MAX_X_M);
 close(wide.midfielderShift.x,-PLAYER_COHESION_MIDFIELDER_MAX_X_M);
 close(wide.defenderShift.y,PLAYER_COHESION_DEFENDER_MAX_Y_M);
 close(wide.midfielderShift.y,-PLAYER_COHESION_MIDFIELDER_MAX_Y_M);
 const def=lineCohesionTarget({x:-36,y:0},'home','defender',wide);
 const mid=lineCohesionTarget({x:-5,y:16},'home','midfielder',wide);
 assert.ok(Object.isFrozen(def)&&Object.isFrozen(mid));
 assert.ok(mid.x-def.x<wide.gapM);
 assert.ok(mid.y-def.y<wide.lateralDriftM);
 assert.ok(mid.x-def.x>=PLAYER_COHESION_MIN_GAP_M);
 const tight=measureLineCohesion(sample(-30,-27,0),'home');
 assert.ok(tight.defenderShift.x<0&&tight.midfielderShift.x>0);
 close(tight.defenderShift.y,0);close(tight.midfielderShift.y,0);
 const a=lineCohesionTarget({x:-30,y:0},'home','defender',tight);
 const b=lineCohesionTarget({x:-27,y:0},'home','midfielder',tight);
 assert.ok(b.x-a.x>tight.gapM);
 const awaySample=sample(-36,-5,16).map(p=>({...p,team:'away',x:-p.x}));
 const mirrored=measureLineCohesion(awaySample,'away');
 close(mirrored.gapM,wide.gapM);
 close(mirrored.defenderShift.x,-wide.defenderShift.x);
 close(mirrored.midfielderShift.x,-wide.midfielderShift.x);
 close(mirrored.defenderShift.y,wide.defenderShift.y);
 close(mirrored.midfielderShift.y,wide.midfielderShift.y);
});
test('ME-PLAYER-12 frozen pure target requires valid evidence, bounds and role',()=>{
 const raw={x:-52.5,y:33.8};
 const sample=measureLineCohesion([
  {team:'home',role:'defender',x:-36,y:0},
  {team:'home',role:'midfielder',x:0,y:20}
 ],'home');
 const bounded=lineCohesionTarget(raw,'home','midfielder',sample);
 assert.ok(bounded.x>=-52.5+PLAYER_RADIUS_M);
 assert.ok(bounded.y<=34-PLAYER_RADIUS_M);
 assert.ok(Object.isFrozen(bounded));
 assert.deepEqual(lineCohesionTarget({x:5,y:7},'away','midfielder',null),{x:5,y:7});
 for(const bad of [null,{x:NaN,y:0},{x:5,y:Infinity}])
  assert.throws(()=>lineCohesionTarget(bad,'home','defender',sample),/Finite cohesion target/);
 assert.throws(()=>lineCohesionTarget({x:0,y:0},'neutral','defender',sample),/Known cohesion/);
 assert.throws(()=>lineCohesionTarget({x:0,y:0},'home','goalkeeper',sample),/Only eligible/);
 assert.throws(()=>lineCohesionTarget({x:0,y:0},'home','defender',
  {defenderShift:{x:Infinity,y:0}}),/Finite cohesion shift/);
});
test('ME-PLAYER-12 live gaps come only from actual teammates; priority roles remain independent',()=>{
 const w=createPlayerMovement(),initial=w.snapshot();
 const neutral=initial.lineCohesion;
 assert.ok(Object.isFrozen(neutral)&&Object.isFrozen(neutral.home));
 assert.ok(Object.isFrozen(neutral.away));
 close(neutral.home.gapM,15);close(neutral.away.gapM,15);
 assert.ok(!('possession' in initial));
 for(let i=0;i<660;i++){
  const ball={x:i<330?-25:25,y:i%200<100?18:-18};
  const s=w.step(ball);
  for(const team of ['home','away']){
   assert.deepEqual(s.lineCohesion[team],measureLineCohesion(s.players,team));
   const gap=s.lineCohesion[team];
   assert.ok(Number.isFinite(gap.gapM)&&Number.isFinite(gap.lateralDriftM));
   assert.equal(gap.defenders,4);assert.equal(gap.midfielders,3);
   for(const v of [gap.defenderShift,gap.midfielderShift]){
    assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.y));
   }
   for(const id of [s.pressers[team],s.coverers[team],
    s.screens[team]?.defenderId,s.balances[team]?.playerId]){
    if(id)assert.ok(!s.recoveries[team]?.playerIds.includes(id),
     'higher-priority roles never inherit recovery assignments');
   }
  }
 }
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-12 mixed territory 900-tick determinism, bounds and Rapier isolation',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let i=0;i<900;i++){
  const ball={x:i%310<100?-32:i%310<220?26:0,y:24*Math.sin(i/18)};
  const s=a.step(ball),copy=b.step(ball);
  assert.deepEqual(s,copy);
  for(const team of ['home','away']){
   const gap=s.lineCohesion[team];
   assert.ok(Object.isFrozen(gap));
   assert.ok(Object.isFrozen(gap.defenderShift));
   assert.ok(Math.abs(gap.defenderShift.x)<=PLAYER_COHESION_DEFENDER_MAX_X_M+1e-8);
   assert.ok(Math.abs(gap.midfielderShift.x)<=PLAYER_COHESION_MIDFIELDER_MAX_X_M+1e-8);
   assert.ok(Math.abs(gap.defenderShift.y)<=PLAYER_COHESION_DEFENDER_MAX_Y_M+1e-8);
   assert.ok(Math.abs(gap.midfielderShift.y)<=PLAYER_COHESION_MIDFIELDER_MAX_Y_M+1e-8);
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'cohesion-ball-unchanged'});
 const y=createEngine(R,{preset:'roll',seed:'cohesion-ball-unchanged'});
 try{
  for(let i=0;i<100;i++){
   const q=x.step(),r=y.step();
   a.step(q.ball.position);
   assert.equal(canonicalSnapshot(q),canonicalSnapshot(r));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
});

test('ME-PLAYER-13 initial 4-3-3 has no phantom crowding or teammate steering',()=>{
 assert.equal(PLAYER_TEAMMATE_CLEARANCE_M,5);
 assert.equal(PLAYER_TEAMMATE_CLEARANCE_GAIN,0.5);
 assert.equal(PLAYER_TEAMMATE_CLEARANCE_MAX_SHIFT_M,1.25);
 const w=createPlayerMovement(),s=w.snapshot();
 assert.ok(Object.isFrozen(s.teammateProximity));
 for(const team of ['home','away']){
  const m=s.teammateProximity[team];
  assert.ok(Object.isFrozen(m));
  assert.equal(m.closePairs,0);
  close(m.minimumM,14);
  assert.deepEqual(m,measureTeammateProximity(INITIAL_PLAYERS,team));
 }
 const sample=teammateClearanceTarget({x:-20,y:1},s.players[6],s.players);
 assert.ok(Object.isFrozen(sample));
 assert.deepEqual(sample,{x:-20,y:1});
 assert.deepEqual(measureTeammateProximity([], 'home'),
  {closePairs:0,minimumM:null});
 assert.equal('possession' in s,false);
});
test('ME-PLAYER-13 nearest real teammate generates capped away-from-neighbor intention',()=>{
 const primary={id:'home-6',team:'home',role:'midfielder',x:0,y:0};
 const near={id:'home-7',team:'home',role:'midfielder',x:1,y:0};
 const far={id:'home-8',team:'home',role:'midfielder',x:30,y:0};
 const keeper={id:'home-1',team:'home',role:'goalkeeper',x:0,y:0};
 const opponent={id:'away-6',team:'away',role:'midfielder',x:0,y:0};
 const normal=Object.freeze({x:10,y:0});
 const target=teammateClearanceTarget(normal,primary,
  [opponent,far,near,keeper,primary]);
 assert.ok(Object.isFrozen(target));
 close(target.x,10-PLAYER_TEAMMATE_CLEARANCE_MAX_SHIFT_M);
 close(target.y,0);
 assert.deepEqual(normal,{x:10,y:0});
 const metric=measureTeammateProximity([primary,near,far,keeper,opponent],'home');
 assert.equal(metric.closePairs,1);
 close(metric.minimumM,1);
 const awayPrimary={...primary,id:'away-6',team:'away',x:0};
 const awayNear={...near,id:'away-7',team:'away',x:-1};
 const mirror=teammateClearanceTarget({x:-10,y:0},awayPrimary,
  [awayPrimary,awayNear,keeper]);
 close(mirror.x,-target.x);close(mirror.y,target.y);
 assert.deepEqual(teammateClearanceTarget(normal,primary,
  [primary,{...near,x:5},opponent]),normal);
});
test('ME-PLAYER-13 deterministic equal-distance ties and zero-gap separation',()=>{
 const subject={id:'home-6',team:'home',role:'midfielder',x:0,y:0};
 const left={id:'home-5',team:'home',role:'defender',x:-2,y:0};
 const right={id:'home-7',team:'home',role:'midfielder',x:2,y:0};
 const normal={x:0,y:0};
 const one=teammateClearanceTarget(normal,subject,[subject,right,left]);
 const two=teammateClearanceTarget(normal,subject,[left,subject,right]);
 assert.deepEqual(one,two);
 assert.ok(one.x>0,'lexicographically first left mate yields rightward escape');
 const shared={...left,x:0},other={...right,x:0};
 const a=teammateClearanceTarget(normal,subject,[subject,shared]);
 const b=teammateClearanceTarget(normal,shared,[subject,shared]);
 assert.ok(a.x>0&&b.x<0,'coincident pair must choose opposed stable directions');
 close(Math.abs(a.x),PLAYER_TEAMMATE_CLEARANCE_MAX_SHIFT_M);
 assert.deepEqual(a,teammateClearanceTarget(normal,subject,[shared,subject]));
 const atEdge=teammateClearanceTarget({x:52.5,y:33.95},
  {...subject,x:52,y:33.5},
  [{...subject,x:52,y:33.5},{...right,x:51.5,y:33.5}]);
 assert.ok(atEdge.x<=52.5-PLAYER_RADIUS_M);
 assert.ok(atEdge.y<=34-PLAYER_RADIUS_M);
 for(const bad of [null,{x:NaN,y:0},{x:0,y:Infinity}])
  assert.throws(()=>teammateClearanceTarget(bad,subject,[subject,left]),/Finite teammate/);
 assert.throws(()=>teammateClearanceTarget(normal,{...subject,role:'goalkeeper'},[]),
  /Valid outfield/);
 assert.throws(()=>teammateClearanceTarget(normal,subject,null),/player array/);
 assert.throws(()=>teammateClearanceTarget(normal,subject,
  [subject,{...left,y:NaN}]),/Finite observed teammate/);
 assert.throws(()=>measureTeammateProximity([], 'neutral'),/Known teammate/);
});
test('ME-PLAYER-13 live teammate measurement uses actual 22-player positions',()=>{
 const w=createPlayerMovement();
 for(let i=0;i<720;i++){
  const ball={x:i%360<180?-25:25,y:i%180<90?-15:15};
  const s=w.step(ball);
  for(const team of ['home','away']){
   const m=s.teammateProximity[team];
   assert.deepEqual(m,measureTeammateProximity(s.players,team));
   assert.ok(Object.isFrozen(m));
   assert.ok(Number.isFinite(m.minimumM));
   assert.ok(m.minimumM>=PLAYER_MIN_SEPARATION_M-1e-8);
   assert.ok(m.closePairs>=0&&m.closePairs<=45);
   if(!s.screens[team])assert.equal(s.recoveries[team],null);
   for(const id of [s.pressers[team],s.coverers[team],
    s.screens[team]?.defenderId,s.balances[team]?.playerId]){
    if(id)assert.ok(!s.recoveries[team]?.playerIds.includes(id));
   }
  }
 }
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-13 900-tick crowded-space stress stays deterministic and ball-independent',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let i=0;i<900;i++){
  const ball={x:i%300<120?-30:i%300<240?30:0,y:22*Math.sin(i/19)};
  const s=a.step(ball),copy=b.step(ball);
  assert.deepEqual(s,copy);
  for(const side of ['home','away']){
   const metric=s.teammateProximity[side];
   assert.ok(Object.isFrozen(metric));
   assert.ok(metric.closePairs>=0&&metric.closePairs<=45);
   assert.ok(metric.minimumM>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)assert.ok(
    dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'outfield-nearest-mate'}),y=createEngine(R,{preset:'roll',seed:'outfield-nearest-mate'});
 try{
  for(let i=0;i<100;i++){
   const q=x.step(),r=y.step();
   a.step(q.ball.position);
   assert.equal(canonicalSnapshot(q),canonicalSnapshot(r));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
});

test('ME-PLAYER-14 neutral shape has no stale clearance assignments',()=>{
 const w=createPlayerMovement(),s=w.snapshot();
 assert.equal(PLAYER_TEAMMATE_CLEARANCE_SWITCH_ADVANTAGE_M,0.75);
 assert.deepEqual(s.teammateAvoidance,{
  home:{active:0,switches:0},away:{active:0,switches:0}
 });
 assert.ok(Object.isFrozen(s.teammateAvoidance));
 assert.ok(Object.isFrozen(s.teammateAvoidance.home));
 assert.deepEqual(Object.keys(w).sort(),['reset','snapshot','step']);
 assert.equal('steer' in w,false);
 for(let i=0;i<30;i++){
  const next=w.step({x:0,y:0});
  assert.equal(next.teammateAvoidance.home.active,0);
  assert.equal(next.teammateAvoidance.away.active,0);
 }
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-14 observed same-team incumbent hysteresis resists near-ties',()=>{
 const player={id:'home-6',team:'home',role:'midfielder',x:0,y:0};
 const left={id:'home-5',team:'home',role:'defender',x:-2,y:0};
 const right={id:'home-7',team:'home',role:'midfielder',x:2,y:0};
 const first=selectTeammateClearanceNeighbor(player,[player,right,left]);
 assert.deepEqual(first,{id:'home-5',distanceM:2});
 assert.ok(Object.isFrozen(first));
 const slightlyCloser={...right,x:1.5};
 const stable=selectTeammateClearanceNeighbor(player,
  [slightlyCloser,player,left],first.id);
 assert.deepEqual(stable,{id:'home-5',distanceM:2});
 assert.deepEqual(selectTeammateClearanceNeighbor(player,
  [left,slightlyCloser,player],first.id),stable);
 const clearWinner={...right,x:1.1};
 const switched=selectTeammateClearanceNeighbor(player,
  [left,clearWinner,player],first.id);
 assert.deepEqual(switched,{id:'home-7',distanceM:1.1});
 assert.deepEqual(selectTeammateClearanceNeighbor(player,
  [left,clearWinner,player],switched.id),switched);
 const awayPlayer={...player,id:'away-6',team:'away'};
 const awayLeft={...left,id:'away-5',team:'away',x:2};
 const awayRight={...right,id:'away-7',team:'away',x:-1.5};
 assert.equal(selectTeammateClearanceNeighbor(awayPlayer,
  [awayRight,awayPlayer,awayLeft],'away-5').id,'away-5');
 const opponent={...right,id:'away-7',team:'away',x:0.1};
 const keeper={...right,id:'home-1',role:'goalkeeper',x:0.1};
 assert.equal(selectTeammateClearanceNeighbor(player,
  [player,left,opponent,keeper]).id,'home-5');
});
test('ME-PLAYER-14 current-sample exit clears previous neighbor without ghost motion',()=>{
 const p={id:'home-6',team:'home',role:'midfielder',x:0,y:0};
 const near={id:'home-7',team:'home',role:'forward',x:1,y:0};
 const t={x:10,y:3};
 const active=selectTeammateClearanceNeighbor(p,[p,near]);
 assert.equal(active.id,near.id);
 const nudged=teammateClearanceTarget(t,p,[p,near],active.id);
 assert.ok(nudged.x<t.x);
 const exited={...near,x:PLAYER_TEAMMATE_CLEARANCE_M};
 assert.equal(selectTeammateClearanceNeighbor(p,
  [p,exited],active.id),null);
 assert.deepEqual(teammateClearanceTarget(t,p,[p,exited],active.id),t);
 const entirelyGone=selectTeammateClearanceNeighbor(p,[p],active.id);
 assert.equal(entirelyGone,null);
 assert.deepEqual(teammateClearanceTarget(t,p,[p],active.id),t);
 const newThreat={...near,id:'home-8',x:1.1};
 assert.equal(selectTeammateClearanceNeighbor(p,
  [p,exited,newThreat],active.id).id,newThreat.id);
 assert.throws(()=>selectTeammateClearanceNeighbor(p,[p,near],0),/Valid incumbent/);
 assert.throws(()=>selectTeammateClearanceNeighbor(p,[p,near],''),/Valid incumbent/);
 assert.throws(()=>selectTeammateClearanceNeighbor({...p,x:NaN},[p]),/Valid outfield/);
 assert.throws(()=>selectTeammateClearanceNeighbor(p,[p,{...near,y:Infinity}]),
  /Finite observed teammate/);
 assert.throws(()=>selectTeammateClearanceNeighbor(p,null),/player array/);
 assert.throws(()=>teammateClearanceTarget({x:NaN,y:0},p,[p,near]),
  /Finite teammate-clearance target/);
});
test('ME-PLAYER-14 autonomous 60Hz evidence and switch counts stay coherent',()=>{
 const w=createPlayerMovement();
 let previous={home:0,away:0};
 for(let i=0;i<720;i++){
  const ball={x:i%360<180?-25:25,y:i%180<90?-15:15};
  const s=w.step(ball);
  assert.ok(Object.isFrozen(s.teammateAvoidance));
  for(const team of ['home','away']){
   const a=s.teammateAvoidance[team],m=s.teammateProximity[team];
   assert.ok(Object.isFrozen(a));
   assert.ok(a.active>=0&&a.active<=10);
   assert.ok(a.switches>=previous[team]);
   if(m.minimumM>=PLAYER_TEAMMATE_CLEARANCE_M)assert.equal(a.active,0);
   if(a.active)assert.ok(m.closePairs>=1);
   previous[team]=a.switches;
   for(const id of [s.pressers[team],s.coverers[team],
    s.screens[team]?.defenderId,s.balances[team]?.playerId])
    if(id)assert.ok(!s.recoveries[team]?.playerIds.includes(id));
  }
 }
 assert.ok(w.snapshot().teammateAvoidance.home.switches>=0);
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-14 900-tick hysteretic avoidance remains deterministic and ball-isolated',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let i=0;i<900;i++){
  const ball={x:i%300<120?-30:i%300<240?30:0,y:22*Math.sin(i/19)};
  const s=a.step(ball),v=b.step(ball);
  assert.deepEqual(s,v);
  for(const team of ['home','away']){
   const summary=s.teammateAvoidance[team];
   assert.ok(Object.isFrozen(summary));
   assert.ok(summary.active>=0&&summary.active<=10);
   assert.ok(summary.switches>=0);
   assert.ok(s.teammateProximity[team].minimumM>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)assert.ok(
    dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'stable-avoidance-ball-isolation'});
 const y=createEngine(R,{preset:'roll',seed:'stable-avoidance-ball-isolation'});
 try{
  for(let i=0;i<100;i++){
   const first=x.step(),other=y.step();
   a.step(first.ball.position);
   assert.equal(canonicalSnapshot(first),canonicalSnapshot(other));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
});

test('ME-PLAYER-15 first paint and static teammate trajectories have no phantom crossing',()=>{
 const w=createPlayerMovement(),initial=w.snapshot();
 assert.equal(PLAYER_CROSSING_LOOKAHEAD_S,1.5);
 assert.equal(PLAYER_CROSSING_GUARD_M,2.5);
 assert.equal(PLAYER_CROSSING_MAX_SHIFT_M,0.9);
 assert.equal(PLAYER_CROSSING_MIN_REL_SPEED_MPS,1);
 assert.equal(PLAYER_CROSSING_MAX_ABS_HEADING_COS,0.85);
 assert.equal(PLAYER_CROSSING_MIN_ETA_S,0.1);
 assert.deepEqual(initial.crossingIntent,{
  home:{active:0,nearestEtaS:null},
  away:{active:0,nearestEtaS:null}
 });
 assert.ok(Object.isFrozen(initial.crossingIntent));
 assert.ok(Object.isFrozen(initial.crossingIntent.home));
 assert.equal(forecastTeammateCrossing(initial.players[6],initial.players),null);
 assert.deepEqual(teammateCrossingTarget({x:-20,y:0},initial.players[6],
  initial.players),{x:-20,y:0});
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-15 genuine closing outfielder trajectories trigger bounded mirrored offsets',()=>{
 const home={id:'home-6',team:'home',role:'midfielder',
  x:-4.8,y:0,vx:4,vy:0};
 const mate={id:'home-7',team:'home',role:'forward',
  x:0,y:-4.8,vx:0,vy:4};
 const forecast=forecastTeammateCrossing(home,[mate,home]);
 assert.ok(Object.isFrozen(forecast));
 assert.equal(forecast.id,mate.id);
 close(forecast.etaS,1.2);
 close(forecast.closestM,0);
 const normal=Object.freeze({x:-20,y:-4});
 const target=teammateCrossingTarget(normal,home,[mate,home]);
 assert.ok(Object.isFrozen(target));
 close(Math.hypot(target.x-normal.x,target.y-normal.y),
  PLAYER_CROSSING_MAX_SHIFT_M);
 assert.ok(target.x>normal.x&&target.y>normal.y);
 assert.deepEqual(normal,{x:-20,y:-4});
 const mateNormal={x:-16,y:-8};
 const mateTarget=teammateCrossingTarget(mateNormal,mate,[home,mate]);
 close(mateTarget.x-mateNormal.x,-(target.x-normal.x));
 close(mateTarget.y-mateNormal.y,-(target.y-normal.y));
 const reflect=p=>({...p,team:'away',id:p.id.replace('home','away'),
  x:-p.x,vx:-p.vx});
 const away=reflect(home),awayMate=reflect(mate);
 const mirrored=teammateCrossingTarget({x:20,y:-4},away,
  [awayMate,away]);
 close(mirrored.x,-target.x);
 close(mirrored.y,target.y);
});
test('ME-PLAYER-15 diverging, static, already close and irrelevant players do not predict crossing',()=>{
 const a={id:'home-6',team:'home',role:'midfielder',
  x:-4.8,y:0,vx:4,vy:0};
 const crossing={id:'home-7',team:'home',role:'forward',
  x:0,y:-4.8,vx:0,vy:4};
 const normal={x:5,y:7};
 assert.equal(forecastTeammateCrossing(a,[a,{...crossing,vy:-4}]),null);
 assert.equal(forecastTeammateCrossing(a,[a,{...crossing,vy:0}]),null);
 assert.equal(forecastTeammateCrossing(a,[a,{...crossing,vx:4,vy:0}]),null);
 // Two almost parallel teammates merging toward one lane are not a
 // crossing of trajectories; leave it to true-distance clearance.
 const fast={...a,vx:7};
 const follow={...crossing,x:1.2,y:0,vx:2,vy:0};
 assert.equal(forecastTeammateCrossing(fast,[fast,follow]),null);
 const headOn={...crossing,x:4.8,y:0,vx:-4,vy:0};
 assert.equal(forecastTeammateCrossing(a,[a,headOn]),null);
 const slow={...crossing,vx:0,vy:0.5};
 assert.equal(forecastTeammateCrossing(a,[a,slow]),null);
 assert.equal(forecastTeammateCrossing(a,[a,{...crossing,x:40,y:-40}]),null);
 const tooClose={...crossing,x:-3,y:0};
 assert.equal(forecastTeammateCrossing(a,[a,crossing,tooClose]),null,
  'existing <5m teammate clearance takes precedence');
 assert.deepEqual(teammateCrossingTarget(normal,a,[a,crossing,tooClose]),normal);
 const other={...crossing,team:'away',id:'away-7'};
 const keeper={...crossing,role:'goalkeeper',id:'home-1'};
 assert.equal(forecastTeammateCrossing(a,[a,other,keeper]),null);
 assert.deepEqual(teammateCrossingTarget(normal,a,[a,other,keeper]),normal);
 const leave={...crossing,x:0,y:-4.8,vx:0,vy:-4};
 assert.equal(forecastTeammateCrossing(a,[a,leave]),null);
 assert.deepEqual(teammateCrossingTarget(normal,a,[a,leave]),normal);
});
test('ME-PLAYER-15 deterministic forecast ties, finite validation and pitch clamps',()=>{
 const subject={id:'home-6',team:'home',role:'midfielder',
  x:-4.8,y:0,vx:4,vy:0};
 const first={id:'home-5',team:'home',role:'defender',
  x:0,y:-4.8,vx:0,vy:4};
 const second={...first,id:'home-7'};
 const chosen=forecastTeammateCrossing(subject,[subject,second,first]);
 assert.equal(chosen.id,first.id);
 assert.deepEqual(chosen,forecastTeammateCrossing(subject,[first,subject,second]));
 const normal={x:52.4,y:33.9};
 const bounded=teammateCrossingTarget(normal,subject,[subject,first,second]);
 assert.ok(bounded.x<=52.5-PLAYER_RADIUS_M);
 assert.ok(bounded.y<=34-PLAYER_RADIUS_M);
 assert.ok(Object.isFrozen(bounded));
 const nullAtRest={...subject,vx:0,vy:0};
 assert.equal(forecastTeammateCrossing(nullAtRest,[nullAtRest,
  {...first,vx:0,vy:0}]),null);
 for(const bad of [null,{...subject,vx:Infinity},{...subject,y:NaN}])
  assert.throws(()=>forecastTeammateCrossing(bad,[subject,first]),
   /Finite moving outfield/);
 assert.throws(()=>forecastTeammateCrossing(subject,null),/Crossing players array/);
 assert.throws(()=>forecastTeammateCrossing(subject,[subject,{...first,vx:NaN}]),
  /Finite observed moving/);
 assert.throws(()=>teammateCrossingTarget({x:NaN,y:0},subject,[subject,first]),
  /Finite crossing target/);
});
test('ME-PLAYER-15 900-tick observed-velocity intent is deterministic and ball-isolated',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let i=0;i<900;i++){
  const ball={x:i%300<110?-30:i%300<220?28:0,
   y:20*Math.sin(i/21)};
  const s=a.step(ball),copy=b.step(ball);
  assert.deepEqual(s,copy);
  assert.ok(Object.isFrozen(s.crossingIntent));
  for(const team of ['home','away']){
   const intents=s.crossingIntent[team];
   assert.ok(Object.isFrozen(intents));
   assert.ok(intents.active>=0&&intents.active<=10);
   assert.ok(intents.nearestEtaS===null||
    (intents.nearestEtaS>=PLAYER_CROSSING_MIN_ETA_S&&
     intents.nearestEtaS<=PLAYER_CROSSING_LOOKAHEAD_S));
   assert.equal(intents.active===0,intents.nearestEtaS===null);
   assert.ok(s.teammateProximity[team].minimumM>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)
    assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'trajectory-intent-ball-isolation'});
 const y=createEngine(R,{preset:'roll',seed:'trajectory-intent-ball-isolation'});
 try{
  for(let i=0;i<100;i++){
   const first=x.step(),second=y.step();
   a.step(first.ball.position);
   assert.equal(canonicalSnapshot(first),canonicalSnapshot(second));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
});

test('ME-PLAYER-16 pure 60Hz crossing-intent interpolation bounds approach and release',()=>{
 assert.equal(PLAYER_CROSSING_INTENT_EASE_MPS,4);
 assert.equal(PLAYER_DT,1/60);
 const maxStep=PLAYER_CROSSING_INTENT_EASE_MPS*PLAYER_DT;
 const origin=Object.freeze({x:0,y:0});
 const first=advanceCrossingIntentOffset(origin,{x:0.9,y:0});
 assert.ok(Object.isFrozen(first));
 close(first.x,maxStep);close(first.y,0);
 assert.deepEqual(origin,{x:0,y:0});
 const mirror=advanceCrossingIntentOffset(origin,{x:-0.9,y:0});
 close(mirror.x,-maxStep);
 const opposite=advanceCrossingIntentOffset(first,{x:-0.9,y:0});
 close(Math.hypot(opposite.x-first.x,opposite.y-first.y),maxStep);
 const huge=advanceCrossingIntentOffset(origin,{x:100,y:0});
 close(huge.x,maxStep);
 let current=first;
 for(let i=0;i<100;i++){
  const next=advanceCrossingIntentOffset(current,{x:0,y:0});
  assert.ok(Math.hypot(next.x-current.x,next.y-current.y)<=maxStep+1e-8);
  current=next;
 }
 assert.deepEqual(current,{x:0,y:0});
 assert.ok(PLAYER_CROSSING_INTENT_SETTLED_EPS_M<1e-6);
 for(const bad of [null,{x:NaN,y:0},{x:Infinity,y:0},{x:1,y:undefined}]){
  assert.throws(()=>advanceCrossingIntentOffset(bad,origin),/Finite crossing-intent/);
  assert.throws(()=>advanceCrossingIntentOffset(origin,bad),/Finite crossing-intent/);
 }
});
test('ME-PLAYER-16 neutral first paint, mirror and reset have no phantom crossing transitions',()=>{
 const w=createPlayerMovement(),s=w.snapshot();
 assert.deepEqual(s.crossingTransitions,{
  home:{engaging:0,releasing:0,maxOffsetM:0},
  away:{engaging:0,releasing:0,maxOffsetM:0}
 });
 assert.ok(Object.isFrozen(s.crossingTransitions));
 assert.ok(Object.isFrozen(s.crossingTransitions.home));
 for(let i=0;i<60;i++){
  const x=w.step({x:0,y:0});
  for(const team of ['home','away']){
   assert.equal(x.crossingTransitions[team].engaging,0);
   assert.equal(x.crossingTransitions[team].releasing,0);
  }
 }
 assert.equal('possession' in w.snapshot(),false);
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-16 current observed crossing creates bounded offset, then old offset releases',()=>{
 const p={id:'home-6',team:'home',role:'midfielder',
  x:-4.8,y:0,vx:4,vy:0};
 const mate={id:'home-7',team:'home',role:'midfielder',
  x:0,y:-4.8,vx:0,vy:4};
 const base={x:-20,y:-3};
 const crossing=forecastTeammateCrossing(p,[p,mate]);
 assert.ok(crossing);
 const target=teammateCrossingTarget(base,p,[p,mate]);
 let eased={x:0,y:0};
 let previous={...eased};
 for(let i=0;i<40;i++){
  const t=teammateCrossingTarget(base,p,[p,mate]);
  eased=advanceCrossingIntentOffset(eased,{
   x:t.x-base.x,y:t.y-base.y
  });
  assert.ok(Math.hypot(eased.x-previous.x,eased.y-previous.y)<=
   PLAYER_CROSSING_INTENT_EASE_MPS*PLAYER_DT+1e-8);
  previous=eased;
 }
 assert.ok(Math.hypot(eased.x,eased.y)>0);
 assert.ok(Math.hypot(eased.x,eased.y)<=PLAYER_CROSSING_MAX_SHIFT_M+1e-8);
 const gone={...mate,vx:0,vy:-4};
 assert.equal(forecastTeammateCrossing(p,[p,gone]),null);
 assert.deepEqual(teammateCrossingTarget(base,p,[p,gone]),base);
 let released=0,prior=Math.hypot(eased.x,eased.y);
 while(prior>PLAYER_CROSSING_INTENT_SETTLED_EPS_M&&released<40){
  eased=advanceCrossingIntentOffset(eased,{x:0,y:0});
  const now=Math.hypot(eased.x,eased.y);
  assert.ok(now<=prior+1e-8);
  assert.ok(prior-now<=PLAYER_CROSSING_INTENT_EASE_MPS*PLAYER_DT+1e-8);
  released++;prior=now;
 }
 assert.ok(released>0&&released<=40);
 assert.deepEqual(eased,{x:0,y:0});
 const reflect=v=>({...v,team:'away',id:v.id.replace('home','away'),
  x:-v.x,vx:-v.vx});
 const mirrored=teammateCrossingTarget({x:20,y:-3},reflect(p),
  [reflect(p),reflect(mate)]);
 close(mirrored.x,-target.x);close(mirrored.y,target.y);
});
test('ME-PLAYER-16 live transitions never treat disappeared forecasts as current threat',()=>{
 const w=createPlayerMovement(),copy=createPlayerMovement();
 let sawCrossing=false;
 for(let i=0;i<780;i++){
  const ball={x:i%260<110?28:i%260<200?-28:0,
   y:20*Math.sin(i/23)};
  const s=w.step(ball),mirror=copy.step(ball);
  assert.deepEqual(s,mirror);
  assert.ok(Object.isFrozen(s.crossingTransitions));
  for(const team of ['home','away']){
   const tr=s.crossingTransitions[team],intent=s.crossingIntent[team];
   assert.ok(Object.isFrozen(tr));
   assert.ok(tr.engaging>=0&&tr.releasing>=0&&
    tr.engaging+tr.releasing<=10);
   assert.ok(tr.maxOffsetM>=0&&tr.maxOffsetM<=PLAYER_CROSSING_MAX_SHIFT_M+1e-8);
   if(!intent.active)assert.equal(tr.engaging,0);
   if(tr.engaging)sawCrossing=true;
   assert.equal(intent.active===0,intent.nearestEtaS===null);
  }
 }
 assert.equal(typeof sawCrossing,'boolean');
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-16 900-tick bounded transitions remain deterministic and Rapier-isolated',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let i=0;i<900;i++){
  const ball={x:i%300<110?-29:i%300<225?27:0,y:24*Math.sin(i/19)};
  const s=a.step(ball),copy=b.step(ball);
  assert.deepEqual(s,copy);
  for(const side of ['home','away']){
   const tr=s.crossingTransitions[side];
   assert.ok(Object.isFrozen(tr));
   assert.ok(tr.engaging>=0&&tr.releasing>=0&&
    tr.engaging+tr.releasing<=10);
   assert.ok(tr.maxOffsetM>=0&&tr.maxOffsetM<=PLAYER_CROSSING_MAX_SHIFT_M+1e-8);
   if(s.crossingIntent[side].active===0)assert.equal(tr.engaging,0);
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)
    assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'crossing-easing-ball-isolation'});
 const y=createEngine(R,{preset:'roll',seed:'crossing-easing-ball-isolation'});
 try{
  for(let i=0;i<100;i++){
   const first=x.step(),second=y.step();
   a.step(first.ball.position);
   assert.equal(canonicalSnapshot(first),canonicalSnapshot(second));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
});

test('ME-PLAYER-17 neutral first paint has no phantom teammate blocks or detours',()=>{
 const w=createPlayerMovement(),s=w.snapshot();
 assert.equal(PLAYER_STALL_CONFIRM_TICKS,12);
 assert.equal(PLAYER_DETOUR_RELEASE_DISTANCE_M,3.2);
 assert.equal(PLAYER_DETOUR_WAYPOINT_LATERAL_M,1.8);
 assert.equal(PLAYER_DETOUR_WAYPOINT_BACK_M,0.25);
 assert.deepEqual(s.detourRecovery,{
  home:{active:0,blocked:0,activations:0},
  away:{active:0,blocked:0,activations:0}
 });
 assert.ok(Object.isFrozen(s.detourRecovery));
 assert.ok(Object.isFrozen(s.detourRecovery.home));
 assert.equal(s.players.filter(p=>p.blockedBy!==null).length,0);
 assert.equal('possession' in s,false);
 assert.deepEqual(Object.keys(w).sort(),['reset','snapshot','step']);
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-17 only twelve consecutive observed blocks from same real teammate qualify',()=>{
 const start=Object.freeze({blockerId:null,ticks:0});
 assert.ok(Object.isFrozen(advanceObservedStall(start,'home-7')));
 let state=start;
 for(let i=1;i<=PLAYER_STALL_CONFIRM_TICKS+7;i++){
  state=advanceObservedStall(state,'home-7');
  assert.equal(state.blockerId,'home-7');
  assert.equal(state.ticks,Math.min(i,PLAYER_STALL_CONFIRM_TICKS));
  assert.ok(Object.isFrozen(state));
 }
 assert.deepEqual(start,{blockerId:null,ticks:0});
 state=advanceObservedStall(state,'home-8');
 assert.deepEqual(state,{blockerId:'home-8',ticks:1});
 state=advanceObservedStall(state,null);
 assert.deepEqual(state,start);
 assert.equal(advanceObservedStall(state,'home-7').ticks,1);
 for(const bad of [null,{blockerId:null,ticks:-1},
  {blockerId:'home-7',ticks:Infinity},
  {blockerId:'home-7',ticks:1.5},
  {blockerId:'home-7',ticks:PLAYER_STALL_CONFIRM_TICKS+1},
  {blockerId:42,ticks:0}])
  assert.throws(()=>advanceObservedStall(bad,null),/Valid observed stall/);
 for(const bad of [0,'',false,Infinity])
  assert.throws(()=>advanceObservedStall(start,bad),/Valid observed teammate blocker/);
});
test('ME-PLAYER-17 confirmed hard blocker produces mirrored lateral real-XY waypoint',()=>{
 const home={id:'home-6',team:'home',role:'midfielder',x:-1,y:0};
 const blocker={id:'home-7',team:'home',role:'forward',x:0,y:0};
 const target=Object.freeze({x:6,y:0});
 const proposed=observedTeammateDetourTarget(target,home,blocker);
 assert.ok(Object.isFrozen(proposed));
 close(proposed.x,-PLAYER_DETOUR_WAYPOINT_BACK_M);
 close(proposed.y,PLAYER_DETOUR_WAYPOINT_LATERAL_M);
 assert.deepEqual(target,{x:6,y:0});
 assert.deepEqual(home,{id:'home-6',team:'home',role:'midfielder',x:-1,y:0});
 const mirror=p=>({...p,team:'away',id:p.id.replace('home','away'),x:-p.x});
 const reflected=observedTeammateDetourTarget({x:-6,y:0},
  mirror(home),mirror(blocker));
 close(reflected.x,-proposed.x);
 close(reflected.y,proposed.y);
 const reverse=observedTeammateDetourTarget(target,
  {...home,id:'home-9'},blocker);
 close(reverse.x,proposed.x);
 close(reverse.y,-proposed.y);
 assert.ok(Math.hypot(proposed.x-blocker.x,proposed.y-blocker.y)<2);
});
test('ME-PLAYER-17 detour releases without ghost blockers, pitch overflow or physical teleport',()=>{
 const home={id:'home-6',team:'home',role:'midfielder',x:-1,y:0};
 const blocker={id:'home-7',team:'home',role:'forward',x:0,y:0};
 const target={x:6,y:0};
 assert.equal(observedTeammateDetourTarget(target,home,null),null);
 assert.equal(observedTeammateDetourTarget(target,{...home,x:4},blocker),null);
 assert.equal(observedTeammateDetourTarget(target,{...home,x:2},blocker),null,
  'teammate behind the actual route must be released');
 assert.equal(observedTeammateDetourTarget({x:-2,y:0},home,blocker),null);
 assert.equal(observedTeammateDetourTarget({x:-0.5,y:0},home,blocker),null);
 const edge={...home,x:51,y:33};
 const atEdge=observedTeammateDetourTarget({x:52.3,y:33},
  edge,{...blocker,x:51.8,y:33});
 assert.ok(atEdge);
 assert.ok(atEdge.x<=52.5-PLAYER_RADIUS_M);
 assert.ok(atEdge.y<=34-PLAYER_RADIUS_M);
 assert.ok(atEdge.y>=-34+PLAYER_RADIUS_M);
 assert.throws(()=>observedTeammateDetourTarget({x:NaN,y:0},
  home,blocker),/Finite detour target/);
 assert.throws(()=>observedTeammateDetourTarget(target,
  {...home,role:'goalkeeper'},blocker),/Valid moving outfield/);
 assert.throws(()=>observedTeammateDetourTarget(target,
  home,{...blocker,team:'away'}),/Valid observed same-team/);
 assert.throws(()=>observedTeammateDetourTarget(target,
  home,{...blocker,x:Infinity}),/Valid observed same-team/);
 const previous=Object.freeze({...home});
 observedTeammateDetourTarget(target,home,blocker);
 assert.deepEqual(previous,home,"waypoint does not mutate the player XY");
});
test('ME-PLAYER-17 900-tick real block telemetry, reproducibility and isolated Rapier ball',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 let activations={home:0,away:0};
 for(let i=0;i<900;i++){
  const ball={x:i%300<100?-31:i%300<210?26:0,y:22*Math.sin(i/22)};
  const sa=a.step(ball),sb=b.step(ball);
  assert.deepEqual(sa,sb);
  assert.ok(Object.isFrozen(sa.detourRecovery));
  for(const team of ['home','away']){
   const info=sa.detourRecovery[team];
   assert.ok(Object.isFrozen(info));
   assert.ok(Number.isInteger(info.active)&&info.active>=0&&info.active<=10);
   assert.ok(Number.isInteger(info.blocked)&&info.blocked>=0&&info.blocked<=11);
   assert.ok(Number.isInteger(info.activations)&&info.activations>=activations[team]);
   activations[team]=info.activations;
   const realBlocks=sa.players.filter(p=>p.team===team&&p.blockedBy&&
    sa.players.some(other=>other.id===p.blockedBy&&other.team===team)).length;
   assert.equal(info.blocked,realBlocks);
  }
  for(let j=0;j<sa.players.length;j++){
   const p=sa.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)
    assert.ok(dist(p,sa.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'observed-block-detour'});
 const y=createEngine(R,{preset:'roll',seed:'observed-block-detour'});
 try{
  for(let i=0;i<100;i++){
   const q=x.step(),r=y.step();
   a.step(q.ball.position);
   assert.equal(canonicalSnapshot(q),canonicalSnapshot(r));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-18 neutral detour choices and cooldown start fully settled',()=>{
 const movement=createPlayerMovement(),s=movement.snapshot();
 assert.equal(PLAYER_DETOUR_RETRY_COOLDOWN_TICKS,30);
 assert.equal(PLAYER_DETOUR_SIDE_CLEARANCE_ADVANTAGE_M,0.25);
 assert.deepEqual(s.detourStability,{
  home:{guarding:0,alternateRoutes:0},
  away:{guarding:0,alternateRoutes:0}
 });
 assert.ok(Object.isFrozen(s.detourStability));
 assert.ok(Object.isFrozen(s.detourStability.home));
 for(let i=0;i<45;i++){
  const x=movement.step({x:0,y:0});
  assert.ok(x.detourStability.home.guarding>=0);
  assert.ok(x.detourStability.away.guarding>=0);
  assert.equal('possession' in x,false);
 }
 assert.deepEqual(movement.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-18 route side is selected from real clearance then remains an explicit frozen choice',()=>{
 const player={id:'home-6',team:'home',role:'midfielder',x:-1,y:0};
 const blocker={id:'home-7',team:'home',role:'forward',x:0,y:0};
 const goal={x:6,y:0};
 const noCrowd=selectObservedDetourSide(goal,player,blocker,[player,blocker]);
 assert.equal(noCrowd,1,'default ID-derived side wins an open-space tie');
 const defaultRoute=observedTeammateDetourTarget(goal,player,blocker);
 assert.deepEqual(defaultRoute,observedTeammateDetourTarget(goal,player,blocker,noCrowd));
 const alternate=observedTeammateDetourTarget(goal,player,blocker,-1);
 close(alternate.x,defaultRoute.x);
 close(alternate.y,-defaultRoute.y);
 const crowd={id:'home-8',team:'home',role:'midfielder',
  x:defaultRoute.x,y:defaultRoute.y};
 const better=selectObservedDetourSide(goal,player,blocker,
  [player,blocker,crowd]);
 assert.equal(better,-1,'actual teammate in the default lane requires the other side');
 const reverse=observedTeammateDetourTarget(goal,player,blocker,better);
 assert.ok(Math.hypot(reverse.x-crowd.x,reverse.y-crowd.y)>PLAYER_MIN_SEPARATION_M);
 assert.deepEqual(reverse,observedTeammateDetourTarget(goal,player,blocker,better));
 const reflect=p=>({...p,team:'away',id:p.id.replace('home','away'),x:-p.x});
 const away=reflect(player),other=reflect(blocker),obstacle=reflect(crowd);
 assert.equal(selectObservedDetourSide({x:-6,y:0},away,other,
  [away,other,obstacle]),better);
 const mirrored=observedTeammateDetourTarget({x:-6,y:0},away,other,better);
 close(mirrored.x,-reverse.x);
 close(mirrored.y,reverse.y);
 const blockingBoth={...crowd,id:'home-9',y:-crowd.y};
 assert.equal(selectObservedDetourSide(goal,player,blocker,
  [player,blocker,crowd,blockingBoth]),null);
 assert.deepEqual(player,{id:'home-6',team:'home',role:'midfielder',x:-1,y:0});
});
test('ME-PLAYER-18 actual pitch boundaries select the viable detour side',()=>{
 const player={id:'home-6',team:'home',role:'midfielder',x:-1,y:32.5};
 const blocker={id:'home-7',team:'home',role:'forward',x:0,y:32.5};
 const target={x:6,y:32.5};
 const selected=selectObservedDetourSide(target,player,blocker,[player,blocker]);
 assert.equal(selected,-1,'near positive-Y touchline the inward lane should win');
 const waypoint=observedTeammateDetourTarget(target,player,blocker,selected);
 assert.ok(waypoint.y<player.y);
 assert.ok(Math.abs(waypoint.x)<=52.5-PLAYER_RADIUS_M);
 assert.ok(Math.abs(waypoint.y)<=34-PLAYER_RADIUS_M);
 assert.equal(selectObservedDetourSide({x:-6,y:32.5},player,blocker,
  [player,blocker]),null,'blocker behind goal direction cannot trigger a detour');
 assert.throws(()=>selectObservedDetourSide(target,player,blocker,null),
  /Observed detour bodies array/);
 assert.throws(()=>selectObservedDetourSide(target,player,blocker,
  [player,blocker,{id:'home-8',x:NaN,y:1}]),/Finite observed detour body/);
 for(const side of [0,2,NaN,'+1']){
  assert.throws(()=>observedTeammateDetourTarget(target,player,blocker,side),
   /Valid detour side/);
 }
});
test('ME-PLAYER-18 30-tick retry guard cannot resurrect a released same-ID waypoint',()=>{
 const zero=Object.freeze({blockerId:null,remaining:0});
 assert.deepEqual(advanceDetourRetryCooldown(zero),zero);
 let state=advanceDetourRetryCooldown(zero,'home-7');
 assert.ok(Object.isFrozen(state));
 assert.deepEqual(state,{blockerId:'home-7',remaining:PLAYER_DETOUR_RETRY_COOLDOWN_TICKS});
 assert.deepEqual(zero,{blockerId:null,remaining:0});
 for(let i=PLAYER_DETOUR_RETRY_COOLDOWN_TICKS-1;i>=0;i--){
  const active=state.blockerId==='home-7'&&state.remaining>0;
  assert.equal(active,i>=0);
  state=advanceDetourRetryCooldown(state);
  assert.equal(state.remaining,i);
  assert.equal(state.blockerId,i>0?'home-7':null);
 }
 assert.deepEqual(state,zero);
 const changed=advanceDetourRetryCooldown(
  advanceDetourRetryCooldown(zero,'home-7'),'home-8');
 assert.deepEqual(changed,{blockerId:'home-8',remaining:30});
 for(const bad of [null,{blockerId:null,remaining:1},
  {blockerId:'home-7',remaining:0},{blockerId:'home-7',remaining:31},
  {blockerId:'home-7',remaining:1.1}])
  assert.throws(()=>advanceDetourRetryCooldown(bad),/Valid detour retry state/);
 for(const bad of [0,'',false])
  assert.throws(()=>advanceDetourRetryCooldown(zero,bad),/Valid released blocker/);
});
test('ME-PLAYER-18 900-tick stable routing telemetry and Rapier isolation',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 let alternate={home:0,away:0};
 for(let i=0;i<900;i++){
  const ball={x:i%310<120?-29:i%310<240?27:0,y:20*Math.sin(i/20)};
  const one=a.step(ball),two=b.step(ball);
  assert.deepEqual(one,two);
  assert.ok(Object.isFrozen(one.detourStability));
  for(const side of ['home','away']){
   const state=one.detourStability[side],existing=one.detourRecovery[side];
   assert.ok(Object.isFrozen(state));
   assert.ok(Number.isInteger(state.guarding)&&state.guarding>=0&&
    state.guarding<=10);
   assert.ok(Number.isInteger(state.alternateRoutes)&&
    state.alternateRoutes>=alternate[side]);
   assert.ok(state.alternateRoutes<=existing.activations);
   alternate[side]=state.alternateRoutes;
   assert.ok(existing.active>=0&&existing.active<=10);
  }
  for(let j=0;j<one.players.length;j++){
   const p=one.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)
    assert.ok(dist(p,one.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const Rapier=await initializeRapier(wasm);
 const x=createEngine(Rapier,{preset:'roll',seed:'detour-side-stability'});
 const y=createEngine(Rapier,{preset:'roll',seed:'detour-side-stability'});
 try{
  for(let i=0;i<100;i++){
   const first=x.step(),second=y.step();
   a.step(first.ball.position);
   assert.equal(canonicalSnapshot(first),canonicalSnapshot(second));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-19 neutral progress monitor is frozen and no phantom routes exist',()=>{
 const w=createPlayerMovement(),initial=w.snapshot();
 assert.equal(PLAYER_DETOUR_PROGRESS_MIN_STEP_M,0.005);
 assert.equal(PLAYER_DETOUR_STAGNANT_WARNING_TICKS,12);
 assert.equal(PLAYER_DETOUR_STAGNANT_ABORT_TICKS,24);
 assert.equal(PLAYER_DETOUR_MAX_ACTIVE_TICKS,180);
 assert.deepEqual(initial.detourProgress,{
  home:{slow:0,abandoned:0},away:{slow:0,abandoned:0}
 });
 assert.ok(Object.isFrozen(initial.detourProgress));
 assert.ok(Object.isFrozen(initial.detourProgress.home));
 assert.ok(Object.isFrozen(initial.detourProgress.away));
 assert.equal('steer' in w,false);
 assert.equal('possession' in initial,false);
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-19 confirmed physically stationary route gets exactly 24 ticks then aborts',()=>{
 const start=Object.freeze({activeTicks:0,stagnantTicks:0});
 assert.ok(Object.isFrozen(start));
 let state=start;
 for(let tick=1;tick<=PLAYER_DETOUR_STAGNANT_ABORT_TICKS;tick++){
  state=advanceObservedDetourProgress(state,0);
  assert.ok(Object.isFrozen(state));
  assert.equal(state.activeTicks,tick);
  assert.equal(state.stagnantTicks,tick);
  assert.equal(shouldAbortObservedDetour(state),
   tick>=PLAYER_DETOUR_STAGNANT_ABORT_TICKS);
 }
 assert.deepEqual(start,{activeTicks:0,stagnantTicks:0});
 const slight=advanceObservedDetourProgress(start,
  PLAYER_DETOUR_PROGRESS_MIN_STEP_M-1e-7);
 assert.equal(slight.stagnantTicks,1);
 const sufficient=advanceObservedDetourProgress(state,
  PLAYER_DETOUR_PROGRESS_MIN_STEP_M);
 assert.equal(sufficient.stagnantTicks,0);
 assert.equal(shouldAbortObservedDetour(sufficient),false);
 const resumed=advanceObservedDetourProgress(sufficient,0.1);
 assert.equal(resumed.stagnantTicks,0);
});
test('ME-PLAYER-19 path lifetime caps at 180 observed 60Hz steps even with movement',()=>{
 let state={activeTicks:0,stagnantTicks:0};
 for(let tick=1;tick<=PLAYER_DETOUR_MAX_ACTIVE_TICKS;tick++){
  state=advanceObservedDetourProgress(state,0.02);
  assert.equal(state.activeTicks,tick);
  assert.equal(state.stagnantTicks,0);
  assert.equal(shouldAbortObservedDetour(state),
   tick>=PLAYER_DETOUR_MAX_ACTIVE_TICKS);
 }
 assert.ok(Object.isFrozen(state));
 const released={activeTicks:0,stagnantTicks:0};
 assert.deepEqual(released,{activeTicks:0,stagnantTicks:0});
 assert.equal(shouldAbortObservedDetour(released),false);
 const cooldown=advanceDetourRetryCooldown(
  {blockerId:null,remaining:0},'home-7');
 assert.equal(cooldown.blockerId,'home-7');
 assert.equal(cooldown.remaining,PLAYER_DETOUR_RETRY_COOLDOWN_TICKS);
 // The progress monitor never changes a player's XY or velocity.
 const player=Object.freeze({x:3,y:4,vx:2,vy:1});
 advanceObservedDetourProgress(released,0);
 assert.deepEqual(player,{x:3,y:4,vx:2,vy:1});
});
test('ME-PLAYER-19 strict progress validation rejects synthetic non-finite distances',()=>{
 const zero={activeTicks:0,stagnantTicks:0};
 for(const moved of [-1,NaN,Infinity,-Infinity,undefined,'0.1',null])
  assert.throws(()=>advanceObservedDetourProgress(zero,moved),
   /Valid observed detour progress/);
 for(const bad of [null,{}, {activeTicks:-1,stagnantTicks:0},
  {activeTicks:2.5,stagnantTicks:0},{activeTicks:1,stagnantTicks:2},
  {activeTicks:181,stagnantTicks:0},
  {activeTicks:0,stagnantTicks:NaN}])
  assert.throws(()=>advanceObservedDetourProgress(bad,0),
   /Valid observed detour progress/);
 for(const bad of [null,{activeTicks:0,stagnantTicks:-1},
  {activeTicks:0,stagnantTicks:1},
  {activeTicks:1.2,stagnantTicks:1}])
  assert.throws(()=>shouldAbortObservedDetour(bad),/Valid observed detour progress/);
 assert.deepEqual(advanceObservedDetourProgress(zero,0.1),
  {activeTicks:1,stagnantTicks:0});
});
test('ME-PLAYER-19 900-tick observed progress stays deterministic and Rapier isolated',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const prior={home:0,away:0};
 for(let i=0;i<900;i++){
  const ball={x:i%300<115?-28:i%300<230?31:0,
   y:22*Math.sin(i/22)};
  const s=a.step(ball),other=b.step(ball);
  assert.deepEqual(s,other);
  assert.ok(Object.isFrozen(s.detourProgress));
  for(const team of ['home','away']){
   const state=s.detourProgress[team],recovery=s.detourRecovery[team];
   assert.ok(Object.isFrozen(state));
   assert.ok(Number.isInteger(state.slow)&&state.slow>=0&&
    state.slow<=recovery.active);
   assert.ok(Number.isInteger(state.abandoned)&&
    state.abandoned>=prior[team]&&
    state.abandoned<=recovery.activations);
   prior[team]=state.abandoned;
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)
    assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'observed-detour-progress'});
 const y=createEngine(R,{preset:'roll',seed:'observed-detour-progress'});
 try{
  for(let i=0;i<100;i++){
   const one=x.step(),two=y.step();
   a.step(one.ball.position);
   assert.equal(canonicalSnapshot(one),canonicalSnapshot(two));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-20 neutral goal-directed detour alignment has no phantom telemetry',()=>{
 const w=createPlayerMovement(),initial=w.snapshot();
 assert.equal(PLAYER_DETOUR_OFF_COURSE_MIN_MOVEMENT_M,0.005);
 assert.deepEqual(initial.detourAlignment,{
  home:{offCourse:0,backwardTicks:0},
  away:{offCourse:0,backwardTicks:0}
 });
 assert.ok(Object.isFrozen(initial.detourAlignment));
 assert.ok(Object.isFrozen(initial.detourAlignment.home));
 assert.ok(Object.isFrozen(initial.detourAlignment.away));
 assert.equal('possession' in initial,false);
 for(let i=0;i<45;i++){
  const s=w.step({x:0,y:0});
  assert.ok(s.detourAlignment.home.offCourse>=0);
  assert.ok(s.detourAlignment.away.offCourse>=0);
 }
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-20 actual XY progress must approach this tick waypoint, not simply move',()=>{
 const start=Object.freeze({x:-1,y:0}),waypoint=Object.freeze({x:4,y:0});
 const forward=measureObservedDetourAdvance(start,{x:-0.9,y:0},waypoint);
 assert.ok(Object.isFrozen(forward));
 close(forward.movedM,0.1);
 close(forward.advanceM,0.1);
 close(forward.awayM,0);
 const still=measureObservedDetourAdvance(start,start,waypoint);
 assert.deepEqual(still,{movedM:0,advanceM:0,awayM:0});
 const sideways=measureObservedDetourAdvance(start,{x:-1,y:0.1},waypoint);
 close(sideways.movedM,0.1);
 close(sideways.advanceM,0);
 assert.ok(sideways.awayM>0,'sideways drifting increases distance to goal');
 const backward=measureObservedDetourAdvance(start,{x:-1.1,y:0},waypoint);
 close(backward.movedM,0.1);
 close(backward.advanceM,0);
 close(backward.awayM,0.1);
 const overshoot=measureObservedDetourAdvance(start,{x:9,y:0},waypoint);
 assert.deepEqual(overshoot,{movedM:10,advanceM:0,awayM:0});
 const mirror=measureObservedDetourAdvance({x:1,y:0},
  {x:0.9,y:0},{x:-4,y:0});
 close(mirror.advanceM,forward.advanceM);
 close(mirror.movedM,forward.movedM);
 assert.deepEqual(start,{x:-1,y:0});
 assert.deepEqual(waypoint,{x:4,y:0});
});
test('ME-PLAYER-20 sideways and backward motion now count toward route stagnation',()=>{
 const start={x:-1,y:0},goal={x:4,y:0};
 let state={activeTicks:0,stagnantTicks:0};
 for(let i=1;i<=PLAYER_DETOUR_STAGNANT_ABORT_TICKS;i++){
  const y=i%2?0.12:-0.12;
  const measured=measureObservedDetourAdvance(start,{x:-1,y},goal);
  assert.ok(measured.movedM>=PLAYER_DETOUR_OFF_COURSE_MIN_MOVEMENT_M);
  assert.equal(measured.advanceM,0,'sideways jiggle is not goal progress');
  state=advanceObservedDetourProgress(state,measured.advanceM);
  assert.equal(state.stagnantTicks,i);
  assert.equal(shouldAbortObservedDetour(state),
   i>=PLAYER_DETOUR_STAGNANT_ABORT_TICKS);
 }
 const correction=measureObservedDetourAdvance(start,{x:-0.96,y:0},goal);
 state=advanceObservedDetourProgress(state,correction.advanceM);
 assert.equal(state.stagnantTicks,0);
 assert.equal(shouldAbortObservedDetour(state),false);
 const reversed=measureObservedDetourAdvance(start,{x:-1.03,y:0},goal);
 state=advanceObservedDetourProgress(state,reversed.advanceM);
 assert.equal(state.stagnantTicks,1);
 assert.ok(reversed.awayM>=PLAYER_DETOUR_PROGRESS_MIN_STEP_M);
});
test('ME-PLAYER-20 invalid and extreme waypoint samples are rejected or bounded',()=>{
 const start={x:0,y:0},goal={x:5,y:0};
 for(const bad of [null,undefined,{x:NaN,y:0},{x:Infinity,y:0},
  {x:0,y:-Infinity},{x:0,y:null},{x:'0',y:0}]){
  assert.throws(()=>measureObservedDetourAdvance(bad,start,goal),
   /Finite observed detour positions/);
  assert.throws(()=>measureObservedDetourAdvance(start,bad,goal),
   /Finite observed detour positions/);
  assert.throws(()=>measureObservedDetourAdvance(start,start,bad),
   /Finite observed detour positions/);
 }
 const edge=measureObservedDetourAdvance({x:52,y:33},
  {x:51.95,y:33},{x:51,y:33});
 close(edge.advanceM,0.05);
 const away=measureObservedDetourAdvance({x:52,y:33},
  {x:52,y:33.1},{x:51,y:33});
 assert.equal(away.advanceM,0);
 assert.ok(away.awayM>0);
 assert.ok(Object.isFrozen(away));
 const same=measureObservedDetourAdvance(goal,goal,goal);
 assert.deepEqual(same,{movedM:0,advanceM:0,awayM:0});
});
test('ME-PLAYER-20 900-tick goal-aligned telemetry stays deterministic and Rapier-isolated',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const prior={home:0,away:0};
 for(let i=0;i<900;i++){
  const ball={x:i%300<110?-29:i%300<230?30:0,y:22*Math.sin(i/23)};
  const s=a.step(ball),other=b.step(ball);
  assert.deepEqual(s,other);
  assert.ok(Object.isFrozen(s.detourAlignment));
  for(const team of ['home','away']){
   const metric=s.detourAlignment[team],recovery=s.detourRecovery[team];
   assert.ok(Object.isFrozen(metric));
   assert.ok(Number.isInteger(metric.offCourse)&&metric.offCourse>=0&&
    metric.offCourse<=recovery.active);
   assert.ok(Number.isInteger(metric.backwardTicks)&&
    metric.backwardTicks>=prior[team]);
   prior[team]=metric.backwardTicks;
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)
    assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'goal-aligned-detour-progress'});
 const y=createEngine(R,{preset:'roll',seed:'goal-aligned-detour-progress'});
 try{
  for(let i=0;i<100;i++){
   const first=x.step(),second=y.step();
   a.step(first.ball.position);
   assert.equal(canonicalSnapshot(first),canonicalSnapshot(second));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-21 neutral observed completion is zero, immutable and resettable',()=>{
 const w=createPlayerMovement(),initial=w.snapshot();
 assert.equal(PLAYER_DETOUR_COMPLETION_RADIUS_M,0.65);
 assert.equal(PLAYER_DETOUR_COMPLETION_BLOCKER_GAP_M,1.25);
 assert.deepEqual(initial.detourCompletions,{home:0,away:0});
 assert.ok(Object.isFrozen(initial.detourCompletions));
 assert.equal('steer' in w,false);
 assert.equal('possession' in initial,false);
 for(let i=0;i<30;i++){
  const snap=w.step({x:0,y:0});
  assert.equal(snap.detourCompletions.home,0);
  assert.equal(snap.detourCompletions.away,0);
 }
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-21 current physical waypoint arrival requires actual safe gap',()=>{
 const blocker=Object.freeze({id:'home-7',team:'home',
  role:'forward',x:0,y:0});
 const home=Object.freeze({id:'home-6',team:'home',
  role:'midfielder',x:-0.25,y:1.5});
 const tactical={x:6,y:0};
 const waypoint=observedTeammateDetourTarget(tactical,home,blocker,1);
 assert.ok(waypoint);
 assert.equal(reachedObservedDetourWaypoint(home,blocker,waypoint),true);
 assert.equal(reachedObservedDetourWaypoint({...home,x:-1,y:0},
  blocker,observedTeammateDetourTarget(tactical,{...home,x:-1,y:0},
   blocker,1)),false);
 const atWaypoint={...home,x:0,y:1.8};
 assert.equal(reachedObservedDetourWaypoint(atWaypoint,blocker,
  {x:0.65,y:1.8}),true,'arrival boundary is inclusive');
 const unsafe={...home,x:0,y:1};
 assert.equal(reachedObservedDetourWaypoint(unsafe,blocker,
  {x:0,y:1.6}),false,'being close to a waypoint alone is not clearance');
 const reflect=p=>({...p,id:p.id.replace('home','away'),
  team:'away',x:-p.x});
 const opposite=reflect(home),oppositeBlocker=reflect(blocker);
 const reflectedWaypoint=observedTeammateDetourTarget(
  {x:-6,y:0},opposite,oppositeBlocker,1);
 assert.equal(reachedObservedDetourWaypoint(opposite,
  oppositeBlocker,reflectedWaypoint),true);
 close(reflectedWaypoint.x,-waypoint.x);
 close(reflectedWaypoint.y,waypoint.y);
 assert.deepEqual(home,{id:'home-6',team:'home',role:'midfielder',
  x:-0.25,y:1.5},'measuring completion cannot teleport a player');
});
test('ME-PLAYER-21 stale, unsafe or invalid blocker samples never certify arrival',()=>{
 const player={id:'home-6',team:'home',role:'midfielder',x:0,y:1.8};
 const blocker={id:'home-7',team:'home',role:'forward',x:0,y:0};
 const goal={x:0,y:1.8};
 assert.equal(reachedObservedDetourWaypoint(player,blocker,goal),true);
 assert.equal(reachedObservedDetourWaypoint({...player,y:2.6},blocker,goal),
  false);
 assert.equal(reachedObservedDetourWaypoint({...player,y:1.2},blocker,
  {x:0,y:1.8}),false);
 const movingBlocker={...blocker,y:1.4};
 assert.equal(reachedObservedDetourWaypoint(player,movingBlocker,goal),false,
  'new real blocker XY overrides a previously safe spatial relation');
 const noPlayer=[null,{...player,role:'goalkeeper'},
  {...player,x:Infinity},{...player,team:'unknown'}];
 for(const p of noPlayer)
  assert.throws(()=>reachedObservedDetourWaypoint(p,blocker,goal),
   /Valid observed detour-completion outfielder/);
 for(const b of [null,{...blocker,team:'away'},
  {...blocker,id:player.id},{...blocker,x:NaN}])
  assert.throws(()=>reachedObservedDetourWaypoint(player,b,goal),
   /Valid real teammate detour-completion blocker/);
 for(const w of [null,{x:NaN,y:0},{x:0,y:Infinity}])
  assert.throws(()=>reachedObservedDetourWaypoint(player,blocker,w),
   /Finite observed detour-completion waypoint/);
});
test('ME-PLAYER-21 successful arrival returns to normal route with existing retry guard',()=>{
 const p={id:'home-6',team:'home',role:'midfielder',x:-0.25,y:1.5};
 const b={id:'home-7',team:'home',role:'forward',x:0,y:0};
 const tactical={x:6,y:0};
 const waypoint=observedTeammateDetourTarget(tactical,p,b,1);
 assert.equal(reachedObservedDetourWaypoint(p,b,waypoint),true);
 const releasedCooldown=advanceDetourRetryCooldown({
  blockerId:null,remaining:0},b.id);
 assert.equal(releasedCooldown.blockerId,b.id);
 assert.equal(releasedCooldown.remaining,PLAYER_DETOUR_RETRY_COOLDOWN_TICKS);
 let countdown=releasedCooldown;
 for(let t=1;t<=PLAYER_DETOUR_RETRY_COOLDOWN_TICKS;t++){
  countdown=advanceDetourRetryCooldown(countdown);
  assert.equal(countdown.remaining,PLAYER_DETOUR_RETRY_COOLDOWN_TICKS-t);
  if(t<PLAYER_DETOUR_RETRY_COOLDOWN_TICKS)
   assert.equal(countdown.blockerId,b.id);
 }
 assert.deepEqual(countdown,{blockerId:null,remaining:0});
 assert.deepEqual(tactical,{x:6,y:0});
 // No manual position mutation, missing teammate tracking or ball contact.
 assert.deepEqual(p,{id:'home-6',team:'home',role:'midfielder',x:-0.25,y:1.5});
});
test('ME-PLAYER-21 900-tick deterministic completion evidence and Rapier isolation',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const previous={home:0,away:0};
 for(let i=0;i<900;i++){
  const ball={x:i%300<110?-30:i%300<235?28:0,
   y:22*Math.sin(i/21)};
  const s=a.step(ball),other=b.step(ball);
  assert.deepEqual(s,other);
  assert.ok(Object.isFrozen(s.detourCompletions));
  for(const side of ['home','away']){
   assert.ok(Number.isInteger(s.detourCompletions[side]));
   assert.ok(s.detourCompletions[side]>=previous[side]);
   assert.ok(s.detourCompletions[side]<=s.detourRecovery[side].activations);
   previous[side]=s.detourCompletions[side];
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)
    assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'real-waypoint-arrival'});
 const y=createEngine(R,{preset:'roll',seed:'real-waypoint-arrival'});
 try{
  for(let i=0;i<100;i++){
   const xSnap=x.step(),ySnap=y.step();
   a.step(xSnap.ball.position);
   assert.equal(canonicalSnapshot(xSnap),canonicalSnapshot(ySnap));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-22 rejoin corridor is initially unblocked, immutable and resettable',()=>{
 const w=createPlayerMovement(),initial=w.snapshot();
 assert.equal(PLAYER_DETOUR_REJOIN_LOOKAHEAD_M,3);
 assert.deepEqual(initial.detourRejoin,{
  home:{blocked:0},away:{blocked:0}
 });
 assert.ok(Object.isFrozen(initial.detourRejoin));
 assert.ok(Object.isFrozen(initial.detourRejoin.home));
 assert.ok(Object.isFrozen(initial.detourRejoin.away));
 assert.equal('steer' in w,false);
 assert.equal('possession' in initial,false);
 for(let i=0;i<60;i++){
  const s=w.step({x:0,y:0});
  for(const side of ['home','away']){
   assert.ok(Number.isInteger(s.detourRejoin[side].blocked));
   assert.ok(s.detourRejoin[side].blocked>=0);
   assert.ok(s.detourRejoin[side].blocked<=10);
  }
 }
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-22 current observed short rejoin corridor is mirrored and safe',()=>{
 const p=Object.freeze({id:'home-6',team:'home',
  role:'midfielder',x:-0.25,y:1.5});
 const b=Object.freeze({id:'home-7',team:'home',
  role:'forward',x:0,y:0});
 const tactical={x:6,y:0};
 const waypoint=observedTeammateDetourTarget(tactical,p,b,1);
 assert.ok(reachedObservedDetourWaypoint(p,b,waypoint));
 const observed=measureObservedDetourRejoinCorridor(p,b,tactical);
 assert.ok(Object.isFrozen(observed));
 assert.equal(observed.safe,true);
 close(observed.observedM,PLAYER_DETOUR_REJOIN_LOOKAHEAD_M);
 assert.ok(observed.minimumGapM>=PLAYER_DETOUR_COMPLETION_BLOCKER_GAP_M);
 const reflect=q=>({...q,id:q.id.replace('home','away'),
  team:'away',x:-q.x});
 const mirrored=measureObservedDetourRejoinCorridor(
  reflect(p),reflect(b),{x:-6,y:0});
 assert.equal(mirrored.safe,true);
 close(mirrored.minimumGapM,observed.minimumGapM);
 close(mirrored.observedM,observed.observedM);
 assert.deepEqual(tactical,{x:6,y:0});
 assert.deepEqual(p,{id:'home-6',team:'home',role:'midfielder',
  x:-0.25,y:1.5});
});
test('ME-PLAYER-22 waypoint arrival alone does not permit an obstructed tactical rejoin',()=>{
 const p={id:'home-6',team:'home',role:'midfielder',x:0,y:1.25};
 const b={id:'home-7',team:'home',role:'forward',x:0,y:0};
 const tactical={x:6,y:0};
 const waypoint=observedTeammateDetourTarget(tactical,p,b,1);
 assert.ok(waypoint);
 assert.equal(reachedObservedDetourWaypoint(p,b,waypoint),true,
  'previous waypoint-only completion gate is already satisfied');
 const unsafe=measureObservedDetourRejoinCorridor(p,b,tactical);
 assert.equal(unsafe.safe,false);
 assert.ok(unsafe.minimumGapM<PLAYER_DETOUR_COMPLETION_BLOCKER_GAP_M);
 assert.ok(Math.hypot(p.x-b.x,p.y-b.y)>=
  PLAYER_DETOUR_COMPLETION_BLOCKER_GAP_M,
  'a safe instantaneous gap does not make the forward corridor safe');
 const movedBlocker={...b,x:-0.5,y:-0.2};
 const cleared=measureObservedDetourRejoinCorridor(p,movedBlocker,tactical);
 assert.equal(cleared.safe,true,
  'a newly observed blocker position, never stale XY, changes the decision');
 assert.ok(cleared.minimumGapM>unsafe.minimumGapM);
 // This guarded decision does not physically change the outfielder or goal.
 assert.deepEqual(p,{id:'home-6',team:'home',role:'midfielder',x:0,y:1.25});
 assert.deepEqual(tactical,{x:6,y:0});
});
test('ME-PLAYER-22 finite samples, zero-distance route and 3m lookahead stay bounded',()=>{
 const p={id:'home-6',team:'home',role:'midfielder',x:0,y:0};
 const b={id:'home-7',team:'home',role:'defender',x:7,y:0};
 const far=measureObservedDetourRejoinCorridor(p,b,{x:10,y:0});
 assert.equal(far.safe,true,'obstacles beyond the next 3m are not guessed');
 close(far.observedM,3);
 close(far.minimumGapM,4);
 const near={...b,x:2};
 const blocked=measureObservedDetourRejoinCorridor(p,near,{x:10,y:0});
 assert.equal(blocked.safe,false);
 close(blocked.minimumGapM,0);
 const short=measureObservedDetourRejoinCorridor(p,near,{x:1,y:0});
 close(short.observedM,1);
 close(short.minimumGapM,1);
 assert.equal(short.safe,false);
 const rest=measureObservedDetourRejoinCorridor(p,near,{x:0,y:0});
 close(rest.observedM,0);
 close(rest.minimumGapM,2);
 assert.equal(rest.safe,true);
 for(const bad of [null,{...p,role:'goalkeeper'},
  {...p,team:'neutral'},{...p,x:NaN}]){
  assert.throws(()=>measureObservedDetourRejoinCorridor(bad,b,{x:1,y:0}),
   /Valid observed detour-rejoin outfielder/);
 }
 for(const bad of [null,{...b,team:'away'},
  {...b,id:p.id},{...b,y:Infinity}]){
  assert.throws(()=>measureObservedDetourRejoinCorridor(p,bad,{x:1,y:0}),
   /Valid observed same-team rejoin blocker/);
 }
 for(const bad of [null,{x:Infinity,y:0},{x:0,y:NaN}]){
  assert.throws(()=>measureObservedDetourRejoinCorridor(p,b,bad),
   /Finite observed rejoin tactical target/);
 }
});
test('ME-PLAYER-22 900 ticks preserve deterministic guarded rejoin and Rapier isolation',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let i=0;i<900;i++){
  const ball={x:i%300<110?-28:i%300<225?30:0,
   y:22*Math.sin(i/21)};
  const s=a.step(ball),other=b.step(ball);
  assert.deepEqual(s,other);
  assert.ok(Object.isFrozen(s.detourRejoin));
  for(const side of ['home','away']){
   const rejoin=s.detourRejoin[side];
   assert.ok(Object.isFrozen(rejoin));
   assert.ok(Number.isInteger(rejoin.blocked));
   assert.ok(rejoin.blocked>=0&&rejoin.blocked<=10);
   assert.ok(s.detourCompletions[side]<=s.detourRecovery[side].activations);
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)
    assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'observed-safe-rejoin-corridor'});
 const y=createEngine(R,{preset:'roll',seed:'observed-safe-rejoin-corridor'});
 try{
  for(let i=0;i<100;i++){
   const sx=x.step(),sy=y.step();
   a.step(sx.ball.position);
   assert.equal(canonicalSnapshot(sx),canonicalSnapshot(sy));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-23 neutral observed-velocity handoffs are frozen and resettable',()=>{
 const w=createPlayerMovement(),initial=w.snapshot();
 assert.equal(PLAYER_REJOIN_HANDOFF_TICKS,24);
 assert.equal(PLAYER_REJOIN_HANDOFF_LOOKAHEAD_M,2.5);
 assert.equal(PLAYER_REJOIN_HANDOFF_MIN_SPEED_MPS,0.5);
 assert.equal(PLAYER_REJOIN_HANDOFF_MAX_BLEND,0.7);
 assert.deepEqual(initial.rejoinHandoffs,{
  home:{active:0,starts:0},away:{active:0,starts:0}
 });
 assert.ok(Object.isFrozen(initial.rejoinHandoffs));
 assert.ok(Object.isFrozen(initial.rejoinHandoffs.home));
 assert.ok(Object.isFrozen(initial.rejoinHandoffs.away));
 assert.equal('steer' in w,false);
 assert.equal('possession' in initial,false);
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-23 pure handoff gently rotates observed heading toward current goal',()=>{
 const p=Object.freeze({id:'home-6',team:'home',role:'midfielder',
  x:0,y:0,vx:2,vy:1});
 const t=Object.freeze({x:16,y:0});
 const early=observedVelocityRejoinTarget(p,t,PLAYER_REJOIN_HANDOFF_TICKS);
 const late=observedVelocityRejoinTarget(p,t,1);
 assert.ok(Object.isFrozen(early));
 close(Math.hypot(early.x-p.x,early.y-p.y),
  PLAYER_REJOIN_HANDOFF_LOOKAHEAD_M);
 assert.ok(early.x>0&&early.y>0);
 assert.ok(late.x>early.x&&late.y<early.y,
  'heading cue approaches the real tactical direction over 24 fixed ticks');
 close(Math.hypot(late.x-p.x,late.y-p.y),PLAYER_REJOIN_HANDOFF_LOOKAHEAD_M);
 const reflect=v=>({...v,team:'away',id:v.id.replace('home','away'),
  x:-v.x,vx:-v.vx});
 const mirrored=observedVelocityRejoinTarget(
  reflect(p),{x:-16,y:0},PLAYER_REJOIN_HANDOFF_TICKS);
 close(mirrored.x,-early.x);close(mirrored.y,early.y);
 assert.deepEqual(p,{id:'home-6',team:'home',role:'midfielder',
  x:0,y:0,vx:2,vy:1});
 assert.deepEqual(t,{x:16,y:0});
});
test('ME-PLAYER-23 wrong way, stopped, short and priority bodies get no fake rejoin cue',()=>{
 const base={id:'home-6',team:'home',role:'midfielder',
  x:0,y:0,vx:2,vy:1},goal={x:16,y:0};
 assert.deepEqual(observedVelocityRejoinTarget({...base,vx:-2,vy:0},goal,24),goal);
 assert.deepEqual(observedVelocityRejoinTarget({...base,vx:0,vy:2},goal,24),goal);
 assert.deepEqual(observedVelocityRejoinTarget({...base,vx:0,vy:0},goal,24),goal);
 assert.deepEqual(observedVelocityRejoinTarget({...base,vx:0.3,vy:0},goal,24),goal);
 assert.deepEqual(observedVelocityRejoinTarget(base,{x:1,y:0},24),{x:1,y:0});
 assert.deepEqual(observedVelocityRejoinTarget(base,goal,0),goal);
 const edge={...base,x:51.5,y:32.7,vx:2,vy:1};
 const cue=observedVelocityRejoinTarget(edge,{x:65,y:33.5},24);
 assert.ok(cue.x<=52.5-PLAYER_RADIUS_M);
 assert.ok(cue.y<=34-PLAYER_RADIUS_M);
 assert.ok(cue.x>=-52.5+PLAYER_RADIUS_M);
 assert.ok(cue.y>=-34+PLAYER_RADIUS_M);
 const blocker={id:'home-7',team:'home',role:'forward',x:0,y:0};
 const moving={...base,y:1.7,vy:-0.4};
 const safe=observedVelocityRejoinTarget(moving,{x:15,y:1.7},24);
 assert.equal(measureObservedDetourRejoinCorridor(moving,blocker,safe).safe,true);
 const movedBlocker={...blocker,x:1.3,y:1.2};
 assert.equal(measureObservedDetourRejoinCorridor(
  moving,movedBlocker,safe).safe,false,
  'a newly observed teammate in the cue corridor prevents handoff');
});
test('ME-PLAYER-23 rejoin intent uses only finite current XY/VX/VY and current goal',()=>{
 const p={id:'home-6',team:'home',role:'midfielder',
  x:0,y:0,vx:2,vy:1},goal={x:15,y:0};
 for(const bad of [null,{...p,team:'unknown'},
  {...p,role:'goalkeeper'},{...p,id:''},
  {...p,x:NaN},{...p,vy:Infinity},{...p,vx:null}])
  assert.throws(()=>observedVelocityRejoinTarget(bad,goal,24),
   /Valid current rejoin outfielder/);
 for(const bad of [null,{x:NaN,y:0},{x:0,y:Infinity},{x:'3',y:0}])
  assert.throws(()=>observedVelocityRejoinTarget(p,bad,24),
   /Finite current rejoin tactical goal/);
 for(const bad of [-1,25,1.5,NaN,null,'24'])
  assert.throws(()=>observedVelocityRejoinTarget(p,goal,bad),
   /Valid remaining rejoin handoff ticks/);
 const original=observedVelocityRejoinTarget(p,goal,24);
 const changed=observedVelocityRejoinTarget({...p,vy:-1},goal,24);
 assert.ok(original.y>0&&changed.y<0);
 assert.deepEqual(observedVelocityRejoinTarget(
  {...p,vy:0},goal,0),goal);
 assert.deepEqual(original,observedVelocityRejoinTarget(p,goal,24),
  'identical observed inputs must be deterministic');
});
test('ME-PLAYER-23 900 ticks preserve deterministic handoffs and isolated Rapier ball',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const started={home:0,away:0};
 for(let i=0;i<900;i++){
  const ball={x:i%300<110?-29:i%300<225?27:0,
   y:22*Math.sin(i/23)};
  const s=a.step(ball),other=b.step(ball);
  assert.deepEqual(s,other);
  assert.ok(Object.isFrozen(s.rejoinHandoffs));
  for(const side of ['home','away']){
   const entry=s.rejoinHandoffs[side];
   assert.ok(Object.isFrozen(entry));
   assert.ok(Number.isInteger(entry.active)&&entry.active>=0&&entry.active<=10);
   assert.ok(Number.isInteger(entry.starts)&&entry.starts>=started[side]);
   assert.ok(entry.starts<=s.detourCompletions[side]);
   started[side]=entry.starts;
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)
    assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'observed-velocity-rejoin-handoff'});
 const y=createEngine(R,{preset:'roll',seed:'observed-velocity-rejoin-handoff'});
 try{
  for(let i=0;i<100;i++){
   const first=x.step(),second=y.step();
   a.step(first.ball.position);
   assert.equal(canonicalSnapshot(first),canonicalSnapshot(second));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-24 neutral observed crowding is frozen, empty and resettable',()=>{
 const w=createPlayerMovement(),s=w.snapshot();
 assert.equal(s.version,PLAYER_VERSION);
 assert.deepEqual(s.handoffCrowding,{
  home:{blocked:0,cancelled:0},away:{blocked:0,cancelled:0}
 });
 assert.ok(Object.isFrozen(s.handoffCrowding));
 assert.ok(Object.isFrozen(s.handoffCrowding.home));
 assert.ok(Object.isFrozen(s.handoffCrowding.away));
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-24 live short handoff checks teammates, opponents and keepers',()=>{
 const p=Object.freeze({id:'home-6',team:'home',role:'midfielder',x:0,y:0});
 const cue=Object.freeze({x:2.5,y:0});
 const clear=measureObservedHandoffCorridor(p,[
  p,{id:'home-7',team:'home',x:0,y:3},
  {id:'away-4',team:'away',x:6,y:0}
 ],cue);
 assert.ok(Object.isFrozen(clear));
 assert.equal(clear.safe,true);
 assert.equal(clear.nearestId,'home-7');
 close(clear.observedM,2.5);
 close(clear.minimumGapM,3);
 for(const body of [
  {id:'home-7',team:'home',x:1.3,y:1.1},
  {id:'away-5',team:'away',x:1.3,y:-1.1},
  {id:'away-1',team:'away',role:'goalkeeper',x:1.3,y:1.1}
 ]){
  const result=measureObservedHandoffCorridor(p,[p,body],cue);
  assert.equal(result.safe,false,body.id);
  assert.equal(result.nearestId,body.id);
  close(result.minimumGapM,1.1);
 }
});
test('ME-PLAYER-24 current mirrored 2.5m corridor uses inclusive real clearance',()=>{
 const home={id:'home-6',team:'home',role:'midfielder',x:0,y:0};
 const away={...home,id:'away-6',team:'away'};
 const left=measureObservedHandoffCorridor(home,[
  home,{id:'away-9',team:'away',x:4,y:0}
 ],{x:20,y:0});
 const right=measureObservedHandoffCorridor(away,[
  away,{id:'home-9',team:'home',x:-4,y:0}
 ],{x:-20,y:0});
 assert.equal(left.safe,true);
 assert.equal(right.safe,true);
 close(left.observedM,2.5);
 close(right.observedM,2.5);
 close(left.minimumGapM,right.minimumGapM);
 assert.equal(measureObservedHandoffCorridor(home,[
  home,{id:'away-9',team:'away',x:1,y:1.25}
 ],{x:2.5,y:0}).safe,true);
 assert.equal(measureObservedHandoffCorridor(home,[
  home,{id:'away-9',team:'away',x:1,y:1.24}
 ],{x:2.5,y:0}).safe,false);
 assert.equal(measureObservedHandoffCorridor(home,[home],{x:0,y:0}).safe,true);
});
test('ME-PLAYER-24 rejects invalid, stale and duplicate physical observations',()=>{
 const p={id:'home-6',team:'home',role:'midfielder',x:0,y:0},cue={x:2.5,y:0};
 assert.throws(()=>measureObservedHandoffCorridor(p,[],cue),TypeError);
 assert.throws(()=>measureObservedHandoffCorridor(p,[
  {id:'home-7',team:'home',x:4,y:0}
 ],cue),TypeError);
 assert.throws(()=>measureObservedHandoffCorridor(p,[{...p,x:1}],cue),TypeError);
 assert.throws(()=>measureObservedHandoffCorridor(p,[
  p,{id:p.id,team:'away',x:5,y:0}
 ],cue),TypeError);
 assert.throws(()=>measureObservedHandoffCorridor(p,[
  p,{id:'away-3',team:'away',x:Infinity,y:0}
 ],cue),TypeError);
 assert.throws(()=>measureObservedHandoffCorridor(p,[p],{x:NaN,y:0}),TypeError);
 assert.throws(()=>measureObservedHandoffCorridor({...p,role:'goalkeeper'},[p],cue),TypeError);
});
test('ME-PLAYER-24 900-tick all-body deterministic guard preserves isolated Rapier ball',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const cancelled={home:0,away:0};
 for(let i=0;i<900;i++){
  const ball={x:i%300<110?-29:i%300<225?27:0,
   y:22*Math.sin(i/23)};
  const s=a.step(ball),other=b.step(ball);
  assert.deepEqual(s,other);
  assert.ok(Object.isFrozen(s.handoffCrowding));
  for(const side of ['home','away']){
   const entry=s.handoffCrowding[side];
   assert.ok(Object.isFrozen(entry));
   assert.ok(Number.isInteger(entry.blocked)&&entry.blocked>=0&&entry.blocked<=10);
   assert.ok(Number.isInteger(entry.cancelled)&&entry.cancelled>=cancelled[side]);
   assert.ok(entry.cancelled<=s.rejoinHandoffs[side].starts);
   cancelled[side]=entry.cancelled;
  }
  for(let j=0;j<s.players.length;j++){
   const p=s.players[j];
   assert.ok(Math.abs(p.x)<=52.5-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.abs(p.y)<=34-PLAYER_RADIUS_M+1e-8);
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   for(let k=0;k<j;k++)
    assert.ok(dist(p,s.players[k])>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'observed-all-body-handoff'});
 const y=createEngine(R,{preset:'roll',seed:'observed-all-body-handoff'});
 try{
  for(let i=0;i<100;i++){
   const first=x.step(),second=y.step();
   a.step(first.ball.position);
   assert.equal(canonicalSnapshot(first),canonicalSnapshot(second));
  }
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-25 neutral observed-motion snapshot is frozen and resettable',()=>{
 const w=createPlayerMovement(),s=w.snapshot();
 assert.equal(s.version,PLAYER_VERSION);
 assert.deepEqual(s.observedMotion,{
  home:{moving:0,stopped:11,blocked:0,meanSpeedMps:0},
  away:{moving:0,stopped:11,blocked:0,meanSpeedMps:0}
 });
 assert.ok(Object.isFrozen(s.observedMotion));
 assert.ok(Object.isFrozen(s.observedMotion.home));
 assert.equal(observedPlayerVelocityVector(s.players[0]),null);
 assert.deepEqual(w.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-25 measured arrows mirror and remain clipped to physical pitch',()=>{
 const h=observedPlayerVelocityVector({team:'home',x:0,y:0,vx:5,vy:0});
 const a=observedPlayerVelocityVector({team:'away',x:0,y:0,vx:-5,vy:0});
 assert.equal(PLAYER_OBSERVED_VECTOR_SECONDS,0.4);
 assert.equal(PLAYER_OBSERVED_MOTION_THRESHOLD_MPS,0.2);
 assert.ok(Object.isFrozen(h));
 assert.deepEqual(h,{x:0,y:0,toX:2,toY:0,speedMps:5});
 assert.deepEqual(a,{x:0,y:0,toX:-2,toY:0,speedMps:5});
 close(observedPlayerVelocityVector({team:'home',x:52,y:0,vx:6,vy:0}).toX,52.5-PLAYER_RADIUS_M);
 assert.equal(observedPlayerVelocityVector({team:'home',x:52.5-PLAYER_RADIUS_M,y:0,vx:6,vy:0}),null);
});
test('ME-PLAYER-25 team counts use actual moving, stopped and hard-blocked bodies',()=>{
 const players=INITIAL_PLAYERS.map(p=>({...p}));
 players.find(p=>p.id==='home-2').vx=3;
 players.find(p=>p.id==='home-3').blockedBy='home-2';
 const h=summarizeObservedPlayerMotion(players,'home');
 assert.deepEqual(h,{moving:1,stopped:10,blocked:1,meanSpeedMps:3/11});
 assert.ok(Object.isFrozen(h));
 assert.deepEqual(summarizeObservedPlayerMotion(players,'away'),{
  moving:0,stopped:11,blocked:0,meanSpeedMps:0
 });
 players.find(p=>p.id==='home-2').vx=0.19;
 assert.equal(summarizeObservedPlayerMotion(players,'home').moving,0);
});
test('ME-PLAYER-25 invalid, duplicated and nonfinite observed bodies are rejected',()=>{
 const players=INITIAL_PLAYERS.map(p=>({...p}));
 assert.throws(()=>observedPlayerVelocityVector({team:'home',x:0,y:0,vx:Infinity,vy:0}),TypeError);
 assert.throws(()=>observedPlayerVelocityVector({team:'away',x:NaN,y:0,vx:0,vy:0}),TypeError);
 assert.throws(()=>observedPlayerVelocityVector({team:'home',x:54,y:0,vx:1,vy:0}),RangeError);
 assert.throws(()=>summarizeObservedPlayerMotion(players.slice(1),'home'),TypeError);
 assert.throws(()=>summarizeObservedPlayerMotion([...players,players[0]],'home'),TypeError);
 assert.throws(()=>summarizeObservedPlayerMotion(players,'invalid'),TypeError);
 players[0].vx=Infinity;
 assert.throws(()=>summarizeObservedPlayerMotion(players,'home'),TypeError);
});
test('ME-PLAYER-25 900 ticks preserve deterministic motion and Rapier ball',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let i=0;i<900;i++){
  const ball={x:i%300<110?-29:i%300<225?27:0,y:22*Math.sin(i/23)};
  const s=a.step(ball),t=b.step(ball);
  assert.deepEqual(s,t);
  for(const team of ['home','away']){
   const m=s.observedMotion[team];
   assert.equal(m.moving+m.stopped,11);
   assert.ok(m.blocked>=0&&m.blocked<=11);
   assert.ok(m.meanSpeedMps>=0&&m.meanSpeedMps<=PLAYER_MAX_SPEED_MPS+1e-8);
   assert.ok(Object.isFrozen(m));
  }
  for(const p of s.players){
   const v=observedPlayerVelocityVector(p);
   if(v)assert.ok(Math.hypot(v.toX-v.x,v.toY-v.y)<=
    PLAYER_MAX_SPEED_MPS*PLAYER_OBSERVED_VECTOR_SECONDS+1e-8);
  }
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'observer-only-motion'});
 const y=createEngine(R,{preset:'roll',seed:'observer-only-motion'});
 try{
  for(let i=0;i<90;i++){
   const s=x.step(),c=y.step();
   a.step(s.ball.position);
   assert.equal(canonicalSnapshot(s),canonicalSnapshot(c));
  }
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-26 bounded historical paths begin with actual 22-position first paint',()=>{
 const w=createPlayerMovement(),trails=createObservedPlayerTrails();
 const initial=w.snapshot();
 assert.equal(PLAYER_OBSERVED_PATH_WINDOW_TICKS,120);
 assert.deepEqual(trails.snapshot().paths.map(x=>x.points.length),Array(22).fill(0));
 trails.record(initial);
 const s=trails.snapshot();
 assert.equal(s.tick,0);
 assert.equal(s.maxTicks,120);
 assert.ok(Object.isFrozen(s));
 assert.ok(Object.isFrozen(s.paths));
 assert.ok(Object.isFrozen(s.paths[0].points));
 assert.deepEqual(s.paths[0].points,[{tick:0,x:-48,y:0}]);
 assert.deepEqual(trails.reset().snapshot().paths.map(x=>x.points.length),Array(22).fill(0));
});
test('ME-PLAYER-26 trail samples are only measured past ticks with fixed ring bounds',()=>{
 const trails=createObservedPlayerTrails(2);
 for(let tick=0;tick<=4;tick++){
  trails.record({tick,players:INITIAL_PLAYERS.map(p=>({...p,
   x:p.x+(p.team==='home'?tick*.1:-tick*.1)}))});
 }
 const s=trails.snapshot();
 assert.equal(s.tick,4);
 assert.equal(s.maxTicks,2);
 assert.equal(s.paths.length,22);
 assert.deepEqual(s.paths[0].points.map(p=>p.tick),[2,3,4]);
 close(s.paths[0].points[0].x,-47.8);
 assert.equal(s.paths[0].points.length,3);
 assert.equal(s.paths[11].id,'away-1');
 close(s.paths[11].points[2].x,47.6);
});
test('ME-PLAYER-26 invalid duplicate, stale, missing, out-of-bounds samples are atomic',()=>{
 const w=createPlayerMovement(),base=w.snapshot(),trails=createObservedPlayerTrails();
 assert.throws(()=>createObservedPlayerTrails(0),RangeError);
 assert.throws(()=>createObservedPlayerTrails(121),RangeError);
 trails.record(base);const before=trails.snapshot();
 assert.throws(()=>trails.record(base),RangeError);
 assert.throws(()=>trails.record({tick:2,players:base.players}),RangeError);
 assert.throws(()=>trails.record({tick:1,players:base.players.slice(1)}),TypeError);
 const doubled=[...base.players];doubled[21]=doubled[0];
 assert.throws(()=>trails.record({tick:1,players:doubled}),TypeError);
 const outside=base.players.map((p,i)=>i===10?{...p,y:99}:p);
 assert.throws(()=>trails.record({tick:1,players:outside}),TypeError);
 const nonfinite=base.players.map((p,i)=>i===0?{...p,x:NaN}:p);
 assert.throws(()=>trails.record({tick:1,players:nonfinite}),TypeError);
 assert.deepEqual(trails.snapshot(),before);
 trails.record(w.step({x:0,y:0}));
 assert.equal(trails.snapshot().tick,1);
});
test('ME-PLAYER-26 mirror and reset preserve immutable past XY, no future paths',()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const trails=createObservedPlayerTrails(30);
 trails.record(a.snapshot());
 for(let i=0;i<45;i++){
  const ball={x:25*Math.sin(i/9),y:18*Math.cos(i/11)};
  const s=a.step(ball),t=b.step(ball);
  assert.deepEqual(s,t);
  trails.record(s);
 }
 const past=trails.snapshot();
 assert.equal(past.tick,45);
 assert.equal(past.paths[0].points.length,31);
 assert.deepEqual(past.paths[0].points.map(p=>p.tick),Array.from({length:31},(_,i)=>i+15));
 for(const path of past.paths){
  assert.ok(path.points.every(p=>p.tick<=past.tick));
  assert.ok(path.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 }
 const frozen=past.paths[1].points[0];
 assert.ok(Object.isFrozen(frozen));
 assert.deepEqual(trails.reset().snapshot().paths.map(x=>x.points.length),Array(22).fill(0));
 assert.equal(past.tick,45,'frozen snapshots cannot be mutated by reset');
});
test('ME-PLAYER-26 900 tick ring is bounded, deterministic and Rapier-independent',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const x=createObservedPlayerTrails(),y=createObservedPlayerTrails();
 x.record(a.snapshot());y.record(b.snapshot());
 for(let i=0;i<900;i++){
  const ball={x:i%240<80?22:i%240<160?-28:0,y:20*Math.sin(i/29)};
  const s=a.step(ball),t=b.step(ball);
  x.record(s);y.record(t);
  assert.deepEqual(s,t);
 }
 const s=x.snapshot();
 assert.deepEqual(s,y.snapshot());
 assert.equal(s.tick,900);
 for(const path of s.paths){
  assert.equal(path.points.length,121);
  assert.equal(path.points[0].tick,780);
  assert.equal(path.points.at(-1).tick,900);
 }
 const R=await initializeRapier(wasm);
 const ball1=createEngine(R,{preset:'roll',seed:'path-history-rapier'});
 const ball2=createEngine(R,{preset:'roll',seed:'path-history-rapier'});
 try{
  for(let i=0;i<90;i++){
   const actual=ball1.step(),control=ball2.step();
   a.step(actual.ball.position);
   assert.equal(canonicalSnapshot(actual),canonicalSnapshot(control));
  }
 }finally{ball1.dispose();ball2.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-27 empty and tick-0 path metrics are frozen, finite and zero',()=>{
 const trails=createObservedPlayerTrails();
 for(const team of ['home','away']){
  const empty=summarizeObservedTrailDistances(trails.snapshot(),team);
  assert.deepEqual(empty,{observedTicks:0,meanTravelM:0,meanDisplacementM:0,meanExtraMotionM:0});
  assert.ok(Object.isFrozen(empty));
 }
 trails.record(createPlayerMovement().snapshot());
 assert.deepEqual(summarizeObservedTrailDistances(trails.snapshot(),'home'),{
  observedTicks:0,meanTravelM:0,meanDisplacementM:0,meanExtraMotionM:0
 });
});
test('ME-PLAYER-27 physical path length differs from net displacement on a genuine turn',()=>{
 const trails=createObservedPlayerTrails(5);
 const bodies=INITIAL_PLAYERS.map(p=>({...p}));
 const seed=(tick)=>{
  const updates=bodies.map(p=>({...p}));
  for(const id of ['home-2','away-2']){
   const p=updates.find(x=>x.id===id),sign=p.team==='home'?1:-1;
   if(tick>=1)p.x+=sign;
   if(tick>=2)p.y+=1;
  }
  trails.record({tick,players:updates});
 };
 seed(0);seed(1);seed(2);
 const a=summarizeObservedTrailDistances(trails.snapshot(),'home');
 const b=summarizeObservedTrailDistances(trails.snapshot(),'away');
 assert.deepEqual(a,b);
 assert.equal(a.observedTicks,2);
 close(a.meanTravelM,2/11);
 close(a.meanDisplacementM,Math.SQRT2/11);
 close(a.meanExtraMotionM,(2-Math.SQRT2)/11);
 assert.ok(a.meanTravelM>a.meanDisplacementM);
 assert.ok(Object.isFrozen(a));
});
test('ME-PLAYER-27 2-second sliding window excludes earlier physical movement',()=>{
 const observer=createObservedPlayerTrails(2);
 for(let tick=0;tick<5;tick++){
  const players=INITIAL_PLAYERS.map(p=>({
   ...p,x:p.x+(p.team==='home'?tick*.25:-tick*.25)
  }));
  observer.record({tick,players});
 }
 const a=summarizeObservedTrailDistances(observer.snapshot(),'home');
 assert.equal(a.observedTicks,2);
 close(a.meanTravelM,.5);
 close(a.meanDisplacementM,.5);
 close(a.meanExtraMotionM,0);
 assert.deepEqual(observer.reset().snapshot().paths.map(p=>p.points.length),Array(22).fill(0));
});
test('ME-PLAYER-27 rejects fabricated or unsynchronized histories without mutation',()=>{
 const w=createPlayerMovement(),observer=createObservedPlayerTrails();
 observer.record(w.snapshot());observer.record(w.step({x:0,y:0}));
 const baseline=observer.snapshot();
 const fail=paths=>assert.throws(()=>summarizeObservedTrailDistances({
  ...baseline,paths
 },'home'),Error);
 fail(baseline.paths.slice(1));
 fail(baseline.paths.map((p,i)=>i===3?{...p,id:'home-2'}:p));
 fail(baseline.paths.map((p,i)=>i===4?{...p,points:p.points.slice(1)}:p));
 fail(baseline.paths.map((p,i)=>i===5?{...p,points:[...p.points.slice(0,1),{...p.points[1],tick:9}]}:p));
 fail(baseline.paths.map((p,i)=>i===6?{...p,points:[...p.points.slice(0,1),{...p.points[1],x:Infinity}]}:p));
 assert.throws(()=>summarizeObservedTrailDistances({...baseline,tick:NaN},'away'),TypeError);
 assert.throws(()=>summarizeObservedTrailDistances(baseline,'other'),TypeError);
 assert.deepEqual(observer.snapshot(),baseline);
});
test('ME-PLAYER-27 observed distance remains deterministic after 900 physical 60Hz ticks',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const left=createObservedPlayerTrails(),right=createObservedPlayerTrails();
 left.record(a.snapshot());right.record(b.snapshot());
 for(let i=0;i<900;i++){
  const ball={x:i%300<100?25:i%300<200?-25:0,y:22*Math.sin(i/33)};
  left.record(a.step(ball));right.record(b.step(ball));
 }
 for(const team of ['home','away']){
  const x=summarizeObservedTrailDistances(left.snapshot(),team);
  const y=summarizeObservedTrailDistances(right.snapshot(),team);
  assert.deepEqual(x,y);
  assert.equal(x.observedTicks,120);
  assert.ok(x.meanTravelM>=x.meanDisplacementM-1e-8);
  assert.ok(x.meanTravelM<=PLAYER_MAX_SPEED_MPS*2+1e-8);
 }
 const R=await initializeRapier(wasm);
 const p=createEngine(R,{preset:'roll',seed:'path-length-audit'});
 const q=createEngine(R,{preset:'roll',seed:'path-length-audit'});
 try{
  for(let i=0;i<90;i++){
   const real=p.step(),control=q.step();
   a.step(real.ball.position);
   assert.equal(canonicalSnapshot(real),canonicalSnapshot(control));
  }
 }finally{p.dispose();q.dispose();}
 assert.deepEqual(left.reset().snapshot().paths.map(v=>v.points.length),Array(22).fill(0));
});

test('ME-PLAYER-28 real player inspector starts frozen at current neutral field state',()=>{
 const w=createPlayerMovement(),history=createObservedPlayerTrails();
 history.record(w.snapshot());
 const result=inspectObservedPlayer(w.snapshot(),history.snapshot(),'home-10');
 assert.equal(PLAYER_VERSION,'me-player-34-observed-duty-measured-pace-v1');
 assert.deepEqual(result,{
  id:'home-10',team:'home',number:10,role:'forward',
  x:-5,y:0,speedMps:0,blockedBy:null,
  observedTicks:0,travelM:0,netM:0
 });
 assert.ok(Object.isFrozen(result));
 assert.deepEqual(w.snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-28 top-down hit testing selects nearest real marker with null off-pitch',()=>{
 const players=createPlayerMovement().snapshot().players;
 const {X,Y}=pitchProjection(1050,680);
 assert.equal(pickObservedPlayerAtCanvasPixel(players,X(-48),Y(0),1050,680),'home-1');
 assert.equal(pickObservedPlayerAtCanvasPixel(players,X(48),Y(0),1050,680),'away-1');
 assert.equal(pickObservedPlayerAtCanvasPixel(players,X(-5)+13,Y(0),1050,680),'home-10');
 assert.equal(pickObservedPlayerAtCanvasPixel(players,0,0,1050,680),null);
 assert.equal(pickObservedPlayerAtCanvasPixel(players,-4,10,1050,680),null);
 assert.throws(()=>pickObservedPlayerAtCanvasPixel(players,X(0),Y(0),1050,680,0),TypeError);
 assert.throws(()=>pickObservedPlayerAtCanvasPixel(players.slice(1),0,0,1050,680),TypeError);
});
test('ME-PLAYER-28 selected current velocity and 2s recorded distance match physical ticks',()=>{
 const w=createPlayerMovement(),trails=createObservedPlayerTrails();
 trails.record(w.snapshot());
 for(let i=0;i<150;i++){
  const s=w.step({x:i<75?25:-25,y:18*Math.sin(i/12)});
  trails.record(s);
 }
 const s=w.snapshot(),h=trails.snapshot();
 const actual=inspectObservedPlayer(s,h,'home-10');
 const p=s.players.find(v=>v.id==='home-10');
 assert.equal(actual.observedTicks,120);
 close(actual.x,p.x);close(actual.y,p.y);
 close(actual.speedMps,Math.hypot(p.vx,p.vy));
 assert.equal(actual.blockedBy,p.blockedBy);
 assert.ok(actual.travelM>=actual.netM-1e-8);
 assert.ok(actual.travelM>0);
 assert.ok(actual.netM>=0);
});
test('ME-PLAYER-28 rejects forged IDs, out-of-sync snapshots and current XY drift',()=>{
 const w=createPlayerMovement(),trails=createObservedPlayerTrails();
 trails.record(w.snapshot());
 const s=w.snapshot(),h=trails.snapshot();
 for(const id of ['home-99','guest-1',null,'']){
  assert.throws(()=>inspectObservedPlayer(s,h,id),TypeError);
 }
 assert.throws(()=>inspectObservedPlayer({...s,tick:1},h,'home-1'),TypeError);
 assert.throws(()=>inspectObservedPlayer({...s,players:s.players.slice(1)},h,'home-1'),TypeError);
 assert.throws(()=>inspectObservedPlayer({...s,players:s.players.map(p=>p.id==='home-1'?{...p,x:p.x+.2}:p)},h,'home-1'),TypeError);
 assert.throws(()=>inspectObservedPlayer({...s,players:s.players.map(p=>p.id==='home-1'?{...p,role:'forward'}:p)},h,'home-1'),TypeError);
 assert.deepEqual(trails.snapshot(),h);
});
test('ME-PLAYER-28 inspection cannot alter 900-tick 11v11 movement or Rapier ball',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const history=createObservedPlayerTrails();history.record(a.snapshot());
 for(let i=0;i<900;i++){
  const ball={x:i%300<140?22:-26,y:20*Math.sin(i/21)};
  const s=a.step(ball),control=b.step(ball);
  history.record(s);
  assert.deepEqual(s,control);
  const who=i%2===0?'home-10':'away-1';
  const detail=inspectObservedPlayer(s,history.snapshot(),who);
  assert.equal(detail.id,who);
  assert.ok(detail.travelM>=detail.netM-1e-8);
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'inspection-isolation'});
 const y=createEngine(R,{preset:'roll',seed:'inspection-isolation'});
 try{
  for(let i=0;i<90;i++){
   const sample=x.step(),control=y.step();
   a.step(sample.ball.position);
   assert.equal(canonicalSnapshot(sample),canonicalSnapshot(control));
  }
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-29 current frozen assignments report real initial press, not invented roles',()=>{
 const w=createPlayerMovement(),history=createObservedPlayerTrails();
 history.record(w.snapshot());
 const s=w.snapshot(),h=history.snapshot();
 assert.deepEqual(inspectObservedPlayerAssignments(s,h,'home-10'),{
  id:'home-10',team:'home',assignments:['Pressing'],
  observedOpponents:[],fallback:''
 });
 assert.deepEqual(inspectObservedPlayerAssignments(s,h,'away-10'),{
  id:'away-10',team:'away',assignments:['Pressing'],
  observedOpponents:[],fallback:''
 });
 assert.deepEqual(inspectObservedPlayerAssignments(s,h,'home-1'),{
  id:'home-1',team:'home',assignments:[],
  observedOpponents:[],fallback:'Goalkeeper role'
 });
 const free=inspectObservedPlayerAssignments(s,h,'home-9');
 assert.deepEqual(free.assignments,[]);
 assert.equal(free.fallback,'No explicit assignment');
 assert.ok(Object.isFrozen(free)&&Object.isFrozen(free.assignments));
 assert.ok(Object.isFrozen(free.observedOpponents));
});
test('ME-PLAYER-29 explicit cover, screen, support, balance and recovery match observed IDs',()=>{
 const w=createPlayerMovement(),history=createObservedPlayerTrails();
 history.record(w.snapshot());
 const s=w.snapshot(),h=history.snapshot();
 const scenario={
  ...s,
  pressers:{...s.pressers,home:'home-10'},
  coverers:{...s.coverers,home:'home-2'},
  screens:{...s.screens,home:{defenderId:'home-3',opponentId:'away-9'}},
  supports:{...s.supports,home:{playerId:'home-4'}},
  balances:{...s.balances,home:{playerId:'home-5',opponentId:'away-8'}},
  recoveries:{...s.recoveries,home:{playerIds:['home-6','home-7'],opponentId:'away-11'}}
 };
 const expected=[
  ['home-2','Covering',[]],
  ['home-3','Zonal screen',['away-9']],
  ['home-4','Space support',[]],
  ['home-5','Weak-side balance',['away-8']],
  ['home-6','Defensive recovery',['away-11']],
  ['home-7','Defensive recovery',['away-11']]
 ];
 for(const [id,role,opps] of expected){
  const r=inspectObservedPlayerAssignments(scenario,h,id);
  assert.deepEqual(r.assignments,[role]);
  assert.deepEqual(r.observedOpponents,opps);
 }
 assert.deepEqual(inspectObservedPlayerAssignments(scenario,h,'away-10').assignments,['Pressing']);
 assert.deepEqual(w.snapshot(),s,'inspection must not update canonical assignments');
});
test('ME-PLAYER-29 simultaneous recorded assignments never fake one exclusive intent',()=>{
 const w=createPlayerMovement(),history=createObservedPlayerTrails();
 history.record(w.snapshot());
 const s=w.snapshot(),h=history.snapshot();
 const scenario={...s,coverers:{...s.coverers,home:'home-10'},
  supports:{...s.supports,home:{playerId:'home-10'}},
  recoveries:{...s.recoveries,home:{playerIds:['home-10'],opponentId:'away-7'}}};
 const r=inspectObservedPlayerAssignments(scenario,h,'home-10');
 assert.deepEqual(r.assignments,['Pressing','Covering','Space support','Defensive recovery']);
 assert.deepEqual(r.observedOpponents,['away-7']);
 assert.equal(r.fallback,'');
});
test('ME-PLAYER-29 rejects stale, wrong-team, invalid and duplicate real duty references',()=>{
 const w=createPlayerMovement(),history=createObservedPlayerTrails();
 history.record(w.snapshot());
 const s=w.snapshot(),h=history.snapshot();
 const invalid=[
  {...s,pressers:{...s.pressers,home:'away-10'}},
  {...s,coverers:{...s.coverers,home:'home-99'}},
  {...s,screens:{...s.screens,home:{defenderId:'home-2',opponentId:'home-9'}}},
  {...s,supports:{...s.supports,home:{playerId:'away-7'}}},
  {...s,balances:{...s.balances,home:{playerId:'home-5',opponentId:'home-9'}}},
  {...s,recoveries:{...s.recoveries,home:{playerIds:['home-5','home-5'],opponentId:'away-8'}}},
  {...s,recoveries:{...s.recoveries,home:{playerIds:['away-5'],opponentId:'away-8'}}},
  {...s,pressers:{away:s.pressers.away}}
 ];
 for(const fake of invalid)assert.throws(()=>inspectObservedPlayerAssignments(fake,h,'home-10'),TypeError);
 assert.throws(()=>inspectObservedPlayerAssignments({...s,tick:1},h,'home-10'),TypeError);
 assert.throws(()=>inspectObservedPlayerAssignments(s,h,'home-17'),TypeError);
 assert.deepEqual(history.snapshot(),h);
});
test('ME-PLAYER-29 900 physical ticks preserve deterministic duties and Rapier ball',async()=>{
 const left=createPlayerMovement(),right=createPlayerMovement();
 const history=createObservedPlayerTrails();history.record(left.snapshot());
 for(let i=0;i<900;i++){
  const ball={x:i%270<90?22:i%270<180?-26:0,y:20*Math.sin(i/30)};
  const l=left.step(ball),r=right.step(ball);
  assert.deepEqual(l,r);
  history.record(l);
  const id=i%2?'away-10':'home-1';
  const duty=inspectObservedPlayerAssignments(l,history.snapshot(),id);
  assert.equal(duty.id,id);
  assert.ok(Object.isFrozen(duty)&&Object.isFrozen(duty.assignments));
  assert.ok(duty.assignments.every(x=>
   ['Pressing','Covering','Zonal screen','Space support','Weak-side balance','Defensive recovery'].includes(x)));
 }
 const R=await initializeRapier(wasm);
 const a=createEngine(R,{preset:'roll',seed:'assignment-observer'});
 const b=createEngine(R,{preset:'roll',seed:'assignment-observer'});
 try{
  for(let i=0;i<90;i++){
   const s=a.step(),control=b.step();
   left.step(s.ball.position);
   assert.equal(canonicalSnapshot(s),canonicalSnapshot(control));
  }
 }finally{a.dispose();b.dispose();}
 assert.deepEqual(left.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-30 first-paint real assignments have no inferred change event',()=>{
 const world=createPlayerMovement(),timeline=createObservedAssignmentTimeline();
 const empty=summarizeObservedAssignmentTransitions(timeline.snapshot(),'home-10');
 assert.deepEqual(empty,{id:'home-10',team:'home',observedTicks:0,changes:0,lastChange:null});
 const initial=world.snapshot();timeline.record(initial);
 assert.equal(PLAYER_VERSION,'me-player-34-observed-duty-measured-pace-v1');
 assert.deepEqual(summarizeObservedAssignmentTransitions(timeline.snapshot(),'home-10'),empty);
 const view=timeline.snapshot();
 assert.equal(view.tick,0);
 assert.equal(view.samples[0].assignments.length,22);
 assert.deepEqual(view.samples[0].assignments[9].assignments,['Pressing']);
 assert.deepEqual(view.samples[0].assignments[20].assignments,['Pressing']);
 assert.ok(Object.isFrozen(view)&&Object.isFrozen(view.samples));
 assert.ok(Object.isFrozen(view.samples[0])&&Object.isFrozen(view.samples[0].assignments));
});
test('ME-PLAYER-30 counts only measured press handoffs, not a fabricated initial transition',()=>{
 const world=createPlayerMovement(),view=world.snapshot(),timeline=createObservedAssignmentTimeline();
 const tick=(i,home)=>timeline.record({
  ...view,tick:i,pressers:{home,away:'away-10'}
 });
 tick(0,'home-10');tick(1,'home-9');tick(2,'home-9');tick(3,'home-10');
 const selected=summarizeObservedAssignmentTransitions(timeline.snapshot(),'home-10');
 assert.equal(selected.observedTicks,3);
 assert.equal(selected.changes,2);
 assert.deepEqual(selected.lastChange,{
  tick:3,from:[],to:['Pressing'],fromOpponents:[],toOpponents:[]
 });
 assert.deepEqual(summarizeObservedAssignmentTransitions(timeline.snapshot(),'away-10'),{
  id:'away-10',team:'away',observedTicks:3,changes:0,lastChange:null
 });
 assert.ok(Object.isFrozen(selected)&&Object.isFrozen(selected.lastChange));
 assert.ok(Object.isFrozen(selected.lastChange.to));
});
test('ME-PLAYER-30 opponent retargeting counts as real screen change',()=>{
 const s=createPlayerMovement().snapshot(),timeline=createObservedAssignmentTimeline(3);
 for(let i=0;i<=5;i++){
  const opponentId=i<3?'away-8':'away-9';
  timeline.record({...s,tick:i,screens:{home:{
   defenderId:'home-2',opponentId
  },away:null}});
 }
 const d=summarizeObservedAssignmentTransitions(timeline.snapshot(),'home-2');
 assert.equal(d.observedTicks,3);
 assert.equal(d.changes,1);
 assert.deepEqual(d.lastChange,{
  tick:3,from:['Zonal screen'],to:['Zonal screen'],
  fromOpponents:['away-8'],toOpponents:['away-9']
 });
 const other=summarizeObservedAssignmentTransitions(timeline.snapshot(),'home-9');
 assert.equal(other.changes,0);
});
test('ME-PLAYER-30 invalid observations and forged histories are atomic',()=>{
 const s=createPlayerMovement().snapshot(),timeline=createObservedAssignmentTimeline();
 assert.throws(()=>createObservedAssignmentTimeline(0),RangeError);
 assert.throws(()=>createObservedAssignmentTimeline(121),RangeError);
 timeline.record(s);
 const baseline=timeline.snapshot();
 assert.throws(()=>timeline.record(s),RangeError);
 assert.throws(()=>timeline.record({...s,tick:2}),RangeError);
 assert.throws(()=>timeline.record({...s,tick:1,players:s.players.slice(1)}),TypeError);
 assert.throws(()=>timeline.record({...s,tick:1,pressers:{home:'away-7',away:'away-10'}}),TypeError);
 assert.throws(()=>timeline.record({...s,tick:1,players:s.players.map((p,i)=>i===0?{...p,x:NaN}:p)}),TypeError);
 assert.deepEqual(timeline.snapshot(),baseline);
 const forged={...baseline,samples:[{...baseline.samples[0],
  assignments:baseline.samples[0].assignments.map((p,i)=>i===0?{...p,id:'away-1'}:p)
 }]};
 assert.throws(()=>summarizeObservedAssignmentTransitions(forged,'home-10'),TypeError);
 assert.throws(()=>summarizeObservedAssignmentTransitions(baseline,'guest-1'),TypeError);
 timeline.record({...s,tick:1});
 assert.equal(timeline.snapshot().tick,1);
 assert.deepEqual(timeline.reset().snapshot().samples,[]);
});
test('ME-PLAYER-30 900-tick deterministic duty timeline never touches physics',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const left=createObservedAssignmentTimeline(),right=createObservedAssignmentTimeline();
 left.record(a.snapshot());right.record(b.snapshot());
 for(let i=0;i<900;i++){
  const ball={x:i%280<90?23:i%280<180?-20:0,y:22*Math.sin(i/29)};
  const s=a.step(ball),t=b.step(ball);
  assert.deepEqual(s,t);
  left.record(s);right.record(t);
 }
 assert.deepEqual(left.snapshot(),right.snapshot());
 const hist=left.snapshot();
 assert.equal(hist.tick,900);
 assert.equal(hist.samples.length,121);
 assert.equal(hist.samples[0].tick,780);
 assert.equal(hist.samples.at(-1).tick,900);
 for(const id of ['home-10','away-10','home-1']){
  const report=summarizeObservedAssignmentTransitions(hist,id);
  assert.equal(report.observedTicks,120);
  assert.ok(report.changes>=0);
  assert.ok(report.changes<=120);
 }
 const Rapier=await initializeRapier(wasm);
 const x=createEngine(Rapier,{preset:'roll',seed:'duty-timeline'});
 const y=createEngine(Rapier,{preset:'roll',seed:'duty-timeline'});
 try{
  for(let i=0;i<90;i++){
   const s=x.step(),t=y.step();
   a.step(s.ball.position);
   assert.equal(canonicalSnapshot(s),canonicalSnapshot(t));
  }
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-31 empty and tick-zero duty occupancy does not fabricate elapsed time',()=>{
 const w=createPlayerMovement(),timeline=createObservedAssignmentTimeline();
 const expected={id:'home-10',team:'home',observedTicks:0,
  assignedTicks:0,unassignedTicks:0,currentStreakTicks:0,duties:[]};
 assert.deepEqual(summarizeObservedDutyOccupancy(timeline.snapshot(),'home-10'),expected);
 timeline.record(w.snapshot());
 const r=summarizeObservedDutyOccupancy(timeline.snapshot(),'home-10');
 assert.deepEqual(r,expected);
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.duties));
 assert.equal(PLAYER_VERSION,'me-player-34-observed-duty-measured-pace-v1');
});
test('ME-PLAYER-31 counted press handoff intervals exclude earliest baseline',()=>{
 const s=createPlayerMovement().snapshot(),o=createObservedAssignmentTimeline();
 for(const [tick,home] of [[0,'home-10'],[1,'home-9'],[2,'home-9'],[3,'home-10']])
  o.record({...s,tick,pressers:{home,away:'away-10'}});
 assert.deepEqual(summarizeObservedDutyOccupancy(o.snapshot(),'home-10'),{
  id:'home-10',team:'home',observedTicks:3,
  assignedTicks:1,unassignedTicks:2,currentStreakTicks:1,
  duties:[{label:'Pressing',ticks:1,seconds:PLAYER_DT}]
 });
 const a=summarizeObservedDutyOccupancy(o.snapshot(),'away-10');
 assert.equal(a.assignedTicks,3);assert.equal(a.currentStreakTicks,3);
 assert.ok(Object.isFrozen(a.duties[0]));
});
test('ME-PLAYER-31 simultaneous duties accrue separately without duplicated elapsed ticks',()=>{
 const s=createPlayerMovement().snapshot(),o=createObservedAssignmentTimeline();
 for(let tick=0;tick<=3;tick++)o.record({...s,tick,
  coverers:{...s.coverers,home:tick>=2?'home-10':null},
  supports:{...s.supports,home:tick>=2?{playerId:'home-10'}:null}});
 const r=summarizeObservedDutyOccupancy(o.snapshot(),'home-10');
 assert.equal(r.observedTicks,3);assert.equal(r.assignedTicks,3);
 assert.equal(r.unassignedTicks,0);assert.equal(r.currentStreakTicks,2);
 assert.deepEqual(r.duties,[
  {label:'Pressing',ticks:3,seconds:3*PLAYER_DT},
  {label:'Covering',ticks:2,seconds:2*PLAYER_DT},
  {label:'Space support',ticks:2,seconds:2*PLAYER_DT}
 ]);
 assert.ok(r.duties.reduce((sum,d)=>sum+d.ticks,0)>r.assignedTicks);
});
test('ME-PLAYER-31 rolling 2-tick observation and actual opponent retargeting',()=>{
 const s=createPlayerMovement().snapshot(),o=createObservedAssignmentTimeline(2);
 for(let tick=0;tick<=5;tick++)o.record({...s,tick,
  screens:{...s.screens,home:{defenderId:'home-2',
   opponentId:tick>=5?'away-9':'away-8'}}});
 const r=summarizeObservedDutyOccupancy(o.snapshot(),'home-2');
 assert.equal(r.observedTicks,2);assert.equal(r.assignedTicks,2);
 assert.equal(r.currentStreakTicks,1);
 assert.deepEqual(r.duties,[{label:'Zonal screen',ticks:2,seconds:2*PLAYER_DT}]);
 assert.equal(summarizeObservedDutyOccupancy(o.snapshot(),'home-9').unassignedTicks,2);
 const original=o.snapshot();
 assert.throws(()=>summarizeObservedDutyOccupancy({...original,tick:6},'home-2'),TypeError);
 assert.throws(()=>summarizeObservedDutyOccupancy(original,'guest-1'),TypeError);
 assert.deepEqual(o.snapshot(),original);
 assert.deepEqual(o.reset().snapshot().samples,[]);
});
test('ME-PLAYER-31 deterministic physical 900-tick duty occupancy and Rapier isolation',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const lhs=createObservedAssignmentTimeline(),rhs=createObservedAssignmentTimeline();
 lhs.record(a.snapshot());rhs.record(b.snapshot());
 for(let i=0;i<900;i++){
  const ball={x:i%240<80?22:i%240<160?-21:0,y:20*Math.sin(i/29)};
  const s=a.step(ball),t=b.step(ball);
  assert.deepEqual(s,t);lhs.record(s);rhs.record(t);
 }
 for(const id of ['home-10','away-10','home-1']){
  const x=summarizeObservedDutyOccupancy(lhs.snapshot(),id);
  assert.deepEqual(x,summarizeObservedDutyOccupancy(rhs.snapshot(),id));
  assert.equal(x.observedTicks,120);
  assert.equal(x.assignedTicks+x.unassignedTicks,120);
  assert.ok(x.currentStreakTicks<=120);
  assert.ok(x.duties.every(d=>d.seconds>=0&&d.seconds<=2));
 }
 const Rapier=await initializeRapier(wasm);
 const x=createEngine(Rapier,{preset:'roll',seed:'duty-occupancy'});
 const y=createEngine(Rapier,{preset:'roll',seed:'duty-occupancy'});
 try{
  for(let i=0;i<90;i++){
   const s=x.step(),t=y.step();a.step(s.ball.position);
   assert.equal(canonicalSnapshot(s),canonicalSnapshot(t));
  }
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-32 empty and first physical tick measure no invented metres',()=>{
 const w=createPlayerMovement(),duties=createObservedAssignmentTimeline();
 const trails=createObservedPlayerTrails();
 const empty={id:'home-10',team:'home',observedTicks:0,
  totalM:0,assignedM:0,unassignedM:0,duties:[]};
 assert.deepEqual(summarizeObservedDutyTravel(duties.snapshot(),trails.snapshot(),'home-10'),empty);
 const s=w.snapshot();duties.record(s);trails.record(s);
 const actual=summarizeObservedDutyTravel(duties.snapshot(),trails.snapshot(),'home-10');
 assert.deepEqual(actual,empty);
 assert.ok(Object.isFrozen(actual)&&Object.isFrozen(actual.duties));
 assert.equal(PLAYER_VERSION,'me-player-34-observed-duty-measured-pace-v1');
});
test('ME-PLAYER-32 press handoff attributes only observed XY interval distance',()=>{
 const original=createPlayerMovement().snapshot(),duties=createObservedAssignmentTimeline();
 const trails=createObservedPlayerTrails();
 for(const [tick,press] of [[0,'home-10'],[1,'home-10'],[2,'home-9'],[3,'home-10']]){
  const players=original.players.map(p=>({
   ...p,
   x:p.x+(p.id==='home-10'?tick*.5:p.id==='away-10'?-tick*.5:0)
  }));
  const sample={...original,players,tick,pressers:{home:press,away:'away-10'}};
  duties.record(sample);trails.record(sample);
 }
 const a=summarizeObservedDutyTravel(duties.snapshot(),trails.snapshot(),'home-10');
 assert.equal(a.observedTicks,3);
 close(a.totalM,1.5);close(a.assignedM,1);close(a.unassignedM,.5);
 assert.deepEqual(a.duties,[{label:'Pressing',ticks:2,meters:1}]);
 const b=summarizeObservedDutyTravel(duties.snapshot(),trails.snapshot(),'away-10');
 close(b.totalM,1.5);close(b.assignedM,1.5);close(b.unassignedM,0);
 assert.deepEqual(b.duties,[{label:'Pressing',ticks:3,meters:1.5}]);
 assert.ok(Object.isFrozen(a.duties[0]));
});
test('ME-PLAYER-32 simultaneous real duties share travelled metres, never total clock',()=>{
 const original=createPlayerMovement().snapshot(),d=createObservedAssignmentTimeline();
 const xy=createObservedPlayerTrails();
 for(let tick=0;tick<=2;tick++){
  const players=original.players.map(p=>({
   ...p,x:p.x+(p.id==='home-10'?tick*.2:0)
  }));
  const s={...original,players,tick,
   coverers:{...original.coverers,home:tick? 'home-10':null},
   supports:{...original.supports,home:tick?{playerId:'home-10'}:null}};
  d.record(s);xy.record(s);
 }
 const report=summarizeObservedDutyTravel(d.snapshot(),xy.snapshot(),'home-10');
 close(report.totalM,.4);close(report.assignedM,.4);
 close(report.unassignedM,0);
 assert.deepEqual(report.duties.map(x=>[x.label,x.ticks]),[
  ['Pressing',2],['Covering',2],['Space support',2]
 ]);
 for(const duty of report.duties)close(duty.meters,.4);
 assert.ok(report.duties.reduce((sum,x)=>sum+x.meters,0)>report.totalM);
});
test('ME-PLAYER-32 static assigned body never gains fabricated distance',()=>{
 const s=createPlayerMovement().snapshot(),d=createObservedAssignmentTimeline(2);
 const trail=createObservedPlayerTrails(2);
 for(let tick=0;tick<=4;tick++){
  const sample={...s,tick};d.record(sample);trail.record(sample);
 }
 const a=summarizeObservedDutyTravel(d.snapshot(),trail.snapshot(),'home-10');
 assert.equal(a.observedTicks,2);
 assert.equal(a.duties[0].ticks,2);
 assert.equal(a.duties[0].meters,0);
 assert.equal(a.totalM,0);
 const original=trail.snapshot();
 assert.throws(()=>summarizeObservedDutyTravel(d.snapshot(),
  {...original,tick:5},'home-10'),Error);
 assert.throws(()=>summarizeObservedDutyTravel(d.snapshot(),
  {...original,maxTicks:3},'home-10'),TypeError);
 assert.throws(()=>summarizeObservedDutyTravel(d.snapshot(),
  {...original,paths:original.paths.map((p,i)=>i===9?{...p,
   points:[...p.points.slice(0,1),{...p.points[1],tick:100},...p.points.slice(2)]}:p)
  },'home-10'),Error);
 assert.throws(()=>summarizeObservedDutyTravel(d.snapshot(),original,'away-99'),TypeError);
 assert.deepEqual(trail.snapshot(),original);
 assert.deepEqual(d.reset().snapshot().samples,[]);
});
test('ME-PLAYER-32 900 real physical ticks and Rapier remain deterministic',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const first=createObservedAssignmentTimeline(),second=createObservedAssignmentTimeline();
 const left=createObservedPlayerTrails(),right=createObservedPlayerTrails();
 first.record(a.snapshot());second.record(b.snapshot());
 left.record(a.snapshot());right.record(b.snapshot());
 for(let tick=0;tick<900;tick++){
  const ball={x:tick%240<80?22:tick%240<160?-21:0,
   y:20*Math.sin(tick/31)};
  const s=a.step(ball),t=b.step(ball);assert.deepEqual(s,t);
  first.record(s);second.record(t);left.record(s);right.record(t);
 }
 for(const id of ['home-10','away-10','home-1']){
  const x=summarizeObservedDutyTravel(first.snapshot(),left.snapshot(),id);
  assert.deepEqual(x,summarizeObservedDutyTravel(second.snapshot(),right.snapshot(),id));
  assert.equal(x.observedTicks,120);
  close(x.assignedM+x.unassignedM,x.totalM);
  assert.ok(x.totalM>=0&&x.totalM<=PLAYER_MAX_SPEED_MPS*2+1e-8);
  for(const entry of x.duties)assert.ok(entry.meters>=0&&entry.meters<=x.totalM+1e-8);
 }
 const R=await initializeRapier(wasm);
 const x=createEngine(R,{preset:'roll',seed:'duty-travel'});
 const y=createEngine(R,{preset:'roll',seed:'duty-travel'});
 try{
  for(let i=0;i<90;i++){
   const s=x.step(),t=y.step();a.step(s.ball.position);
   assert.equal(canonicalSnapshot(s),canonicalSnapshot(t));
  }
 }finally{x.dispose();y.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});

test('ME-PLAYER-33 zero first-paint axial components are immutable, no invented displacement',()=>{
 const w=createPlayerMovement(),d=createObservedAssignmentTimeline(),h=createObservedPlayerTrails();
 const expectedAxes={forwardM:0,backwardM:0,lateralM:0};
 const expected={id:'home-10',team:'home',observedTicks:0,
  total:expectedAxes,assigned:expectedAxes,unassigned:expectedAxes,duties:[]};
 assert.deepEqual(summarizeObservedDutyDirections(d.snapshot(),h.snapshot(),'home-10'),expected);
 const s=w.snapshot();d.record(s);h.record(s);
 const v=summarizeObservedDutyDirections(d.snapshot(),h.snapshot(),'home-10');
 assert.deepEqual(v,expected);
 assert.ok(Object.isFrozen(v)&&Object.isFrozen(v.total)&&Object.isFrozen(v.duties));
 assert.equal(PLAYER_VERSION,'me-player-34-observed-duty-measured-pace-v1');
});
test('ME-PLAYER-33 Home +X and Away -X are both observed forward, with mirrored backward',()=>{
 const initial=createPlayerMovement().snapshot(),d=createObservedAssignmentTimeline(),h=createObservedPlayerTrails();
 // Three real 60Hz intervals: forward, backward, then lateral.
 for(const [tick,dx,dy] of [[0,0,0],[1,.3,.4],[2,.1,.4],[3,.1,-.2]]){
  const players=initial.players.map(p=>({
   ...p,x:p.x+(p.id==='home-10'?dx:p.id==='away-10'?-dx:0),
   y:p.y+(['home-10','away-10'].includes(p.id)?dy:0)
  }));
  const s={...initial,players,tick};d.record(s);h.record(s);
 }
 for(const id of ['home-10','away-10']){
  const r=summarizeObservedDutyDirections(d.snapshot(),h.snapshot(),id);
  close(r.total.forwardM,.3);close(r.total.backwardM,.2);
  close(r.total.lateralM,1.0);
  assert.equal(r.duties.length,1);
  assert.equal(r.duties[0].label,'Pressing');
  close(r.duties[0].forwardM,.3);
  close(r.duties[0].backwardM,.2);
  close(r.duties[0].lateralM,1);
  // Projections are independent and NOT three separate travelled lengths.
  const physical=summarizeObservedDutyTravel(d.snapshot(),h.snapshot(),id);
  assert.ok(r.total.forwardM+r.total.backwardM+r.total.lateralM>physical.totalM);
 }
});
test('ME-PLAYER-33 time-aligned duty changes and overlapping labels preserve real axis totals',()=>{
 const base=createPlayerMovement().snapshot(),d=createObservedAssignmentTimeline(),h=createObservedPlayerTrails();
 for(const [tick,x,y,press] of [[0,0,0,'home-10'],[1,.3,.4,'home-10'],
  [2,.2,.4,'home-9'],[3,.2,.7,'home-10']]){
  const players=base.players.map(p=>({
   ...p,x:p.x+(p.id==='home-10'?x:0),
   y:p.y+(p.id==='home-10'?y:0)
  }));
  const s={...base,players,tick,pressers:{...base.pressers,home:press},
   coverers:{...base.coverers,home:tick===3?'home-10':null}};
  d.record(s);h.record(s);
 }
 const r=summarizeObservedDutyDirections(d.snapshot(),h.snapshot(),'home-10');
 close(r.total.forwardM,.3);close(r.total.backwardM,.1);
 close(r.total.lateralM,.7);
 close(r.assigned.forwardM,.3);close(r.assigned.backwardM,0);
 close(r.assigned.lateralM,.7);
 close(r.unassigned.forwardM,0);close(r.unassigned.backwardM,.1);
 close(r.unassigned.lateralM,0);
 assert.deepEqual(r.duties.map(x=>[x.label,x.ticks]),[['Pressing',2],['Covering',1]]);
 close(r.duties[0].forwardM,.3);close(r.duties[0].lateralM,.7);
 close(r.duties[1].forwardM,0);close(r.duties[1].lateralM,.3);
 assert.ok(Object.isFrozen(r.duties[0]));
});
test('ME-PLAYER-33 stationary players, wrong windows, stale ticks and reset stay honest',()=>{
 const base=createPlayerMovement().snapshot(),d=createObservedAssignmentTimeline(2);
 const h=createObservedPlayerTrails(2);
 for(let tick=0;tick<=5;tick++){
  const s={...base,tick};d.record(s);h.record(s);
 }
 const r=summarizeObservedDutyDirections(d.snapshot(),h.snapshot(),'home-10');
 assert.deepEqual(r.total,{forwardM:0,backwardM:0,lateralM:0});
 assert.equal(r.observedTicks,2);
 assert.equal(r.duties[0].ticks,2);
 const samples=h.snapshot();
 assert.throws(()=>summarizeObservedDutyDirections(d.snapshot(),
  {...samples,maxTicks:3},'home-10'),TypeError);
 assert.throws(()=>summarizeObservedDutyDirections(d.snapshot(),
  {...samples,tick:samples.tick+1},'home-10'),Error);
 assert.throws(()=>summarizeObservedDutyDirections(d.snapshot(),
  {...samples,paths:samples.paths.map((p,i)=>i===9?{...p,
   points:[...p.points.slice(0,1),{...p.points[1],tick:222},...p.points.slice(2)]}:p)
  },'home-10'),Error);
 assert.throws(()=>summarizeObservedDutyDirections(d.snapshot(),samples,'home-99'),TypeError);
 assert.deepEqual(h.snapshot(),samples);
 assert.deepEqual(d.reset().snapshot().samples,[]);
 assert.ok(Object.isFrozen(r.unassigned));
});
test('ME-PLAYER-33 900-tick deterministic Home/Away axes and Rapier ball noninterference',async()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 const d=createObservedAssignmentTimeline(),e=createObservedAssignmentTimeline();
 const x=createObservedPlayerTrails(),y=createObservedPlayerTrails();
 d.record(a.snapshot());e.record(b.snapshot());x.record(a.snapshot());y.record(b.snapshot());
 for(let tick=0;tick<900;tick++){
  const ball={x:tick%260<85?22:tick%260<170?-21:0,y:21*Math.sin(tick/29)};
  const first=a.step(ball),second=b.step(ball);assert.deepEqual(first,second);
  d.record(first);e.record(second);x.record(first);y.record(second);
 }
 for(const id of ['home-10','away-10','home-1']){
  const l=summarizeObservedDutyDirections(d.snapshot(),x.snapshot(),id);
  const r=summarizeObservedDutyDirections(e.snapshot(),y.snapshot(),id);
  assert.deepEqual(l,r);assert.equal(l.observedTicks,120);
  for(const key of ['forwardM','backwardM','lateralM']){
   close(l.assigned[key]+l.unassigned[key],l.total[key]);
   assert.ok(l.total[key]>=0&&l.total[key]<=PLAYER_MAX_SPEED_MPS*2+1e-8);
  }
 }
 const Rapier=await initializeRapier(wasm);
 const left=createEngine(Rapier,{preset:'roll',seed:'direction-observer'});
 const right=createEngine(Rapier,{preset:'roll',seed:'direction-observer'});
 try{
  for(let tick=0;tick<90;tick++){
   const s=left.step(),t=right.step();a.step(s.ball.position);
   assert.equal(canonicalSnapshot(s),canonicalSnapshot(t));
  }
 }finally{left.dispose();right.dispose();}
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});
test('ME-PLAYER-34 baseline and first 60Hz sample have zero immutable measured pace',()=>{
 const world=createPlayerMovement(),duties=createObservedAssignmentTimeline(),trail=createObservedPlayerTrails();
 const blank={ticks:0,movingTicks:0,meanMps:0,peakMps:0};
 const expected={id:'home-10',team:'home',observedTicks:0,
  total:blank,assigned:blank,unassigned:blank,duties:[]};
 assert.deepEqual(summarizeObservedDutyPace(duties.snapshot(),trail.snapshot(),'home-10'),expected);
 const first=world.snapshot();duties.record(first);trail.record(first);
 const report=summarizeObservedDutyPace(duties.snapshot(),trail.snapshot(),'home-10');
 assert.deepEqual(report,expected);
 assert.ok(Object.isFrozen(report)&&Object.isFrozen(report.total)&&Object.isFrozen(report.duties));
 assert.equal(PLAYER_VERSION,'me-player-34-observed-duty-measured-pace-v1');
});
test('ME-PLAYER-34 actual measured pressing, stationary gap and concurrent cover preserve timing',()=>{
 const base=createPlayerMovement().snapshot(),duties=createObservedAssignmentTimeline(),trail=createObservedPlayerTrails();
 for(const [tick,x,press,cover] of [
  [0,0,'home-10',null],[1,.05,'home-10',null],
  [2,.05,'home-9',null],[3,.08,'home-10','home-10']
 ]){
  const players=base.players.map(p=>p.id==='home-10'?{...p,x:p.x+x}:p);
  const s={...base,tick,players,pressers:{...base.pressers,home:press},
   coverers:{...base.coverers,home:cover}};
  duties.record(s);trail.record(s);
 }
 const r=summarizeObservedDutyPace(duties.snapshot(),trail.snapshot(),'home-10');
 assert.equal(r.observedTicks,3);
 assert.equal(r.total.ticks,3);assert.equal(r.total.movingTicks,2);
 close(r.total.meanMps,1.6);close(r.total.peakMps,3);
 assert.equal(r.assigned.ticks,2);assert.equal(r.assigned.movingTicks,2);
 close(r.assigned.meanMps,2.4);
 assert.deepEqual(r.unassigned,{ticks:1,movingTicks:0,meanMps:0,peakMps:0});
 assert.deepEqual(r.duties.map(d=>[d.label,d.ticks,d.movingTicks]),
  [['Pressing',2,2],['Covering',1,1]]);
 close(r.duties[0].meanMps,2.4);close(r.duties[1].peakMps,1.8);
 assert.ok(Object.isFrozen(r.duties[0]));
});
test('ME-PLAYER-34 Home/Away mirror and physical 0.2 m/s motion threshold are neutral',()=>{
 const base=createPlayerMovement().snapshot(),duties=createObservedAssignmentTimeline(),trail=createObservedPlayerTrails();
 for(const [tick,dx,dy] of [
  [0,0,0],[1,.15*PLAYER_DT,0],[2,.40*PLAYER_DT,.3*PLAYER_DT],
  [3,.40*PLAYER_DT,.3*PLAYER_DT]
 ]){
  const players=base.players.map(p=>({...p,
   x:p.x+(p.id==='home-10'?dx:p.id==='away-10'?-dx:0),
   y:p.y+(['home-10','away-10'].includes(p.id)?dy:0)
  }));
  const s={...base,tick,players};duties.record(s);trail.record(s);
 }
 const h=summarizeObservedDutyPace(duties.snapshot(),trail.snapshot(),'home-10');
 const a=summarizeObservedDutyPace(duties.snapshot(),trail.snapshot(),'away-10');
 assert.equal(h.total.ticks,3);assert.equal(h.total.movingTicks,1);
 assert.equal(a.total.movingTicks,1);
 close(h.total.peakMps,Math.hypot(.25,.3));
 close(h.total.meanMps,(.15+Math.hypot(.25,.3))/3);
 close(a.total.meanMps,h.total.meanMps);
 close(a.total.peakMps,h.total.peakMps);
 assert.equal(h.duties[0].label,'Pressing');
 assert.equal(a.duties[0].label,'Pressing');
});
test('ME-PLAYER-34 bounded windows reject forged or unsynchronised duty evidence',()=>{
 const base=createPlayerMovement().snapshot(),duties=createObservedAssignmentTimeline(2),trail=createObservedPlayerTrails(2);
 for(let tick=0;tick<=5;tick++){
  const s={...base,tick};duties.record(s);trail.record(s);
 }
 const a=summarizeObservedDutyPace(duties.snapshot(),trail.snapshot(),'home-10');
 assert.equal(a.observedTicks,2);
 assert.deepEqual(a.total,{ticks:2,movingTicks:0,meanMps:0,peakMps:0});
 const history=trail.snapshot(),timeline=duties.snapshot();
 assert.throws(()=>summarizeObservedDutyPace(timeline,{...history,maxTicks:3},'home-10'),TypeError);
 assert.throws(()=>summarizeObservedDutyPace({...timeline,tick:99},history,'home-10'),Error);
 assert.throws(()=>summarizeObservedDutyPace(timeline,{...history,
  paths:history.paths.map((p,i)=>i===7?{...p,
   points:p.points.map((x,j)=>j===1?{...x,tick:44}:x)}:p)},'home-10'),Error);
 assert.throws(()=>summarizeObservedDutyPace(timeline,history,'home-99'),TypeError);
 assert.deepEqual(trail.snapshot(),history);
 assert.deepEqual(duties.reset().snapshot().samples,[]);
});
test('ME-PLAYER-34 900 deterministic physical ticks, pace reconciliation and Rapier isolation',async()=>{
 const left=createPlayerMovement(),right=createPlayerMovement();
 const d=createObservedAssignmentTimeline(),e=createObservedAssignmentTimeline();
 const x=createObservedPlayerTrails(),y=createObservedPlayerTrails();
 d.record(left.snapshot());e.record(right.snapshot());x.record(left.snapshot());y.record(right.snapshot());
 for(let tick=0;tick<900;tick++){
  const ball={x:tick%270<90?21:tick%270<180?-22:0,y:19*Math.sin(tick/32)};
  const first=left.step(ball),second=right.step(ball);
  assert.deepEqual(first,second);d.record(first);e.record(second);x.record(first);y.record(second);
 }
 for(const id of ['home-10','away-10','home-1']){
  const a=summarizeObservedDutyPace(d.snapshot(),x.snapshot(),id);
  const b=summarizeObservedDutyPace(e.snapshot(),y.snapshot(),id);
  assert.deepEqual(a,b);assert.equal(a.observedTicks,120);
  assert.equal(a.total.ticks,120);
  assert.equal(a.total.ticks,a.assigned.ticks+a.unassigned.ticks);
  assert.equal(a.total.movingTicks,a.assigned.movingTicks+a.unassigned.movingTicks);
  assert.ok(a.total.meanMps>=0&&a.total.meanMps<=PLAYER_MAX_SPEED_MPS+1e-6);
  assert.ok(a.total.peakMps>=0&&a.total.peakMps<=PLAYER_MAX_SPEED_MPS+1e-6);
 }
 const Rapier=await initializeRapier(wasm);
 const a=createEngine(Rapier,{preset:'roll',seed:'duty-pace'});
 const b=createEngine(Rapier,{preset:'roll',seed:'duty-pace'});
 try{
  for(let i=0;i<90;i++){
   const first=a.step(),second=b.step();left.step(first.ball.position);
   assert.equal(canonicalSnapshot(first),canonicalSnapshot(second));
  }
 }finally{a.dispose();b.dispose();}
 assert.deepEqual(left.reset().snapshot(),createPlayerMovement().snapshot());
});
