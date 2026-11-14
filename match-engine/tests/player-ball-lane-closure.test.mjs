// ME-PB-26 — real dynamically moving opponent from STANDARD 22-player
// formation. Every collision is a Rapier shoe START, never an intent label.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RapierModule from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot,FIXED_DT}
 from '../src/core.mjs';
import {INITIAL_PLAYERS,createPlayerMovement,PLAYER_MAX_SPEED_MPS,
 PLAYER_DT} from '../src/player-movement.mjs';
import {chooseObservedLaneClosure,releaseObservedLaneClosure,
 retargetObservedLaneClosure,abandonObservedLaneClosure,
 observeReleasedLaneRejoin,LOCAL_LANE_REJOIN_VERSION,
 LOCAL_LANE_REJOIN_DISTANCE_M,LOCAL_LANE_REJOIN_CONFIRM_TICKS,
 LOCAL_LANE_REJOIN_BLOCKED_TICKS,
 LOCAL_LANE_ABANDON_VERSION,LOCAL_LANE_ABANDON_CONFIRM_TICKS,
 LOCAL_LANE_ABANDON_PASSED_MARGIN_M,
 LOCAL_LANE_RETARGET_VERSION,
 LOCAL_LANE_RETARGET_MAX_STEP_M,LOCAL_LANE_RETARGET_MIN_INTERVAL_TICKS,
 LOCAL_LANE_CLOSURE_VERSION,LOCAL_LANE_RELEASE_VERSION}
 from '../src/player-ball-lane-closure.mjs';
import {FOOT_CONTACT_VERSION} from '../src/player-foot-contact.mjs';
import {readFileSync} from 'node:fs';
const RAPIER=await initializeRapier(RapierModule);
const demo={preset:'roll',seed:'local-ai-exchange',
 x:-19.35,y:0,z:0,vx:0,vy:0,vz:0};
const coreFlags={diagnosticPlayerFootContactsEnabled:true,
 diagnosticLocalAiExchangeEnabled:true,
 diagnosticLocalAiAutonomousDefenseEnabled:true};
const playerFlags={experimentalAiExchangeApproach:true,
 experimentalAiAutonomousDefense:true};
test('ME-PB-26 observed lane defense only triggers on real forward moving ball',()=>{
 const data={players:INITIAL_PLAYERS,
  ballPosition:{x:-19.35,y:0},
  ballVelocity:{x:6.2,y:0}};
 const plan=chooseObservedLaneClosure(data);
 assert.ok(plan);
 assert.equal(plan.version,LOCAL_LANE_CLOSURE_VERSION);
 assert.equal(plan.defenderId,'away-10');
 assert.ok(plan.waypoint.x<0,'forward player chooses a lane WEST of normal Away #10 start');
 assert.ok(Math.abs(plan.waypoint.y)<0.001);
 assert.equal(plan.observedFlightOnly,true);
 assert.equal(plan.interceptionProven,false);
 assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.waypoint));
 for(const delta of [
  {ballVelocity:{x:0,y:0}},{ballVelocity:{x:-7,y:0}},
  {ballVelocity:{x:1,y:0}},
  {ballPosition:{x:3,y:0}}
 ])assert.equal(chooseObservedLaneClosure({...data,...delta}),null);
 assert.throws(()=>chooseObservedLaneClosure({...data,players:[]}),/Canonical/);
 assert.throws(()=>chooseObservedLaneClosure({...data,
  ballVelocity:{x:NaN,y:0}}),/Canonical/);
});
test('ME-PB-26 dynamic selection uses current observed defender positions',()=>{
 const data={players:INITIAL_PLAYERS,
  ballPosition:{x:-19.35,y:0},ballVelocity:{x:6.2,y:0}};
 const standard=chooseObservedLaneClosure(data);
 const alternative=INITIAL_PLAYERS.map(p=>p.id==='away-10'?
   {...p,x:20,y:25}:p.id==='away-9'?
   {...p,x:5,y:0}:p);
 const changed=chooseObservedLaneClosure({...data,players:alternative});
 assert.equal(standard.defenderId,'away-10');
 assert.equal(changed.defenderId,'away-9');
 assert.notDeepEqual(changed.selection,standard.selection);
});
test('ME-PB-26 standard lineup at tick zero; no forged lane closure or teleport',()=>{
 const m=createPlayerMovement(playerFlags),zero=m.snapshot();
 assert.equal(zero.observedLaneClosure,null);
 assert.deepEqual(zero.players,INITIAL_PLAYERS);
 const x0=zero.players.find(p=>p.id==='away-10').x;
 assert.equal(x0,5);
 const first=m.step({x:-19.35,y:0},{velocity:{x:0,y:0}});
 assert.equal(first.tick,1);
 assert.equal(first.observedLaneClosure,null);
 assert.ok(Math.hypot(first.players.find(p=>p.id==='away-10').x-x0,
  first.players.find(p=>p.id==='away-10').y)<=PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-6);
 const still=m.step({x:-19.35,y:0},{velocity:{x:0,y:0}});
 assert.equal(still.observedLaneClosure,null);
 const active=m.step({x:-19.1,y:0},{velocity:{x:6.2,y:0}});
 assert.ok(active.observedLaneClosure);
 assert.equal(active.observedLaneClosure.activatedAtTick,3);
 assert.equal(active.observedLaneClosure.defenderId,'away-10');
 assert.ok(active.players.find(p=>p.id==='away-10').x<5);
 assert.deepEqual(m.reset().snapshot(),zero);
});
test('ME-PB-26 strict opt-in and mutually exclusive with pre-positioned opponent',()=>{
 for(const flags of [
  {diagnosticLocalAiAutonomousDefenseEnabled:true},
  {diagnosticPlayerFootContactsEnabled:true,
   diagnosticLocalAiAutonomousDefenseEnabled:true},
  {...coreFlags,diagnosticLocalAiOpponentLaneEnabled:true},
  {...coreFlags,diagnosticLocalAiAutonomousDefenseEnabled:'true'}
 ])assert.throws(()=>createEngine(RAPIER,demo,flags),
  /autonomous|lane|boolean|exchange/i);
 for(const flags of [
  {experimentalAiAutonomousDefense:true},
  {...playerFlags,experimentalAiOpponentLane:true},
  {...playerFlags,experimentalAiAutonomousDefense:'true'}
 ])assert.throws(()=>createPlayerMovement(flags),/Exclusive boolean/);
 const base=createEngine(RAPIER,demo,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticLocalAiExchangeEnabled:true});
 try{
  assert.equal(base.localAiExchangeSnapshot().autonomousDefenderFromDefaultFormation,false);
 }finally{base.dispose();}
});
function simulate(limit=390){
 const world=createEngine(RAPIER,demo,coreFlags);
 const movement=createPlayerMovement(playerFlags);
 let firstPass=null,firstPlan=null,contact=null;
 const samples=[];
 try{
  assert.deepEqual(movement.snapshot().players,INITIAL_PLAYERS);
  for(let tick=1;tick<=limit;tick++){
   const before=world.snapshot();
   const frame=movement.step(before.ball.position,{
    velocity:before.ball.velocity,footContact:world.footContactSnapshot()
   });
   const snap=world.step(frame);
   const match=world.localAiExchangeSnapshot();
   const starts=world.footContactSnapshot().started;
   if(frame.observedLaneClosure&&!firstPlan){
    firstPlan=frame.observedLaneClosure;
    assert.ok(match.pass,'defensive flight response must follow an actual pass');
    assert.ok(firstPlan.activatedAtTick>match.pass.tick);
   }
   if(match.pass&&!firstPass){
    firstPass=match.pass;
    assert.equal(firstPass.tick,tick);
    assert.ok(starts.includes('home-7'));
   }
   if(match.oppositionContact&&!contact){
    contact=match.oppositionContact;
    assert.equal(contact.tick,tick);
    assert.ok(starts.includes(contact.playerId),
      'physical interruption needs actual same-tick Rapier START');
    assert.equal(contact.inferredPossession,false);
    assert.equal(contact.interceptionInferred,false);
   }
   samples.push(Object.freeze({
    tick,ball:canonicalSnapshot(snap),
    defender:Object.freeze({...frame.players.find(p=>p.id==='away-10')}),
    receiver:Object.freeze({...frame.players.find(p=>p.id==='home-10')}),
    closure:frame.observedLaneClosure,
    dutyRecovery:frame.observedLaneRecovery,
    started:Object.freeze([...starts]),
    stages:Object.freeze(match.events.map(e=>e.stage))
   }));
  }
  return Object.freeze({firstPass,firstPlan,contact,
   state:world.localAiExchangeSnapshot(),
   samples:Object.freeze(samples)});
 }finally{world.dispose();}
}
test('ME-PB-26 real 60Hz moving defender attempts live lane closure after actual pass',()=>{
 const r=simulate();
 assert.ok(r.firstPass,'Home #7 must physically pass the real Rapier ball');
 assert.ok(r.firstPlan,'observed-flight lane response is required');
 assert.ok(r.samples[119].receiver.y>3,
  'Home #10 must make a real bounded off-ball support run, not remain in the physical crossing');
 assert.equal(r.firstPlan.defenderId,'away-10');
 assert.equal(r.firstPlan.activatedAtTick,14);
 const before=r.samples[0].defender,at=r.samples[r.firstPlan.activatedAtTick-1].defender;
 assert.ok(Math.hypot(before.x-at.x,before.y-at.y)>0,
  'defender must have genuinely moved from its standard starting formation');
 assert.equal(r.state.opponentLanePrepositioned,false);
 assert.equal(r.state.autonomousDefenderFromDefaultFormation,true);
 if(!r.contact)process.stdout.write('ME_PB_26_LANE_DIAGNOSTIC '+JSON.stringify({
  firstPassTick:r.firstPass.tick,plan:r.firstPlan,
  realDefenderStarts:r.samples.filter(x=>x.started.includes('away-10')).slice(0,8)
    .map(x=>({tick:x.tick,ball:x.ball,defender:x.defender})),
  samples:r.samples.filter(x=>[14,80,120,145,160,180,220,260].includes(x.tick))
    .map(x=>({tick:x.tick,ball:x.ball,defender:x.defender,starts:x.started})),
  nearBall:r.samples.filter(x=>x.tick>=115&&x.tick<=185&&x.tick%5===0)
    .map(x=>({tick:x.tick,ball:x.ball,defender:x.defender,starts:x.started})),
  finalStages:r.state.events.map(x=>x.stage)
 })+'\n');
 assert.ok(r.contact,
  'an autonomous defender must physically interrupt this pass with a real shoe START');
 assert.ok(r.contact.tick>r.firstPlan.activatedAtTick);
 assert.equal(r.contact.playerId,r.firstPlan.defenderId);
 assert.equal(r.state.returnPass,null);
 assert.ok(r.samples[r.contact.tick-1].started.includes('away-10'));
 assert.equal(r.samples[r.contact.tick-2].closure.phase,'closing');
 const post=r.samples[r.contact.tick].closure;
 assert.equal(post.phase,'released-after-physical-contact');
 assert.equal(post.releaseVersion,LOCAL_LANE_RELEASE_VERSION);
 assert.equal(post.observedRapierShoeStartTick,r.contact.tick);
 assert.equal(post.releasedAtMovementTick,r.contact.tick+1);
 assert.equal(post.interceptionProven,false);
 assert.strictEqual(r.samples.at(-1).closure,post,
  'after physical START, the assignment must never retarget or revive');
 assert.equal(r.samples[r.contact.tick].dutyRecovery.version,
  LOCAL_LANE_REJOIN_VERSION);
 assert.equal(r.samples[r.contact.tick].dutyRecovery.releasePhase,
  'released-after-physical-contact');
 assert.equal(r.samples[r.contact.tick-1].dutyRecovery,null);
 assert.equal(r.samples.at(-1).dutyRecovery.tick,r.samples.at(-1).tick);
 assert.ok(r.samples.at(-1).dutyRecovery.actualMovementM<=
  PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-6);
 process.stdout.write('ME_PB_26_LIVE_CLOSURE '+JSON.stringify({
  passTick:r.firstPass.tick,
  closureActivatedTick:r.firstPlan.activatedAtTick,
  realAwayContactTick:r.contact.tick,
  defenderId:r.firstPlan.defenderId,
  initialFormationRetained:true,
  noFakePossession:true
 })+'\n');
});
test('ME-PB-26 independently repeats both trajectory and physical contact timeline',()=>{
 assert.deepEqual(simulate(275),simulate(275));
});
test('ME-PB-26 LAB dropdown choice and canonical replay are opt-in only',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.match(html,/id="preset-opt-ai-defend-auto" data-value="ai-defend-auto"/);
 assert.doesNotMatch(html,/id="ai-defend-auto-demo"/);
 assert.match(lab,/diagnosticLocalAiAutonomousDefenseEnabled:autonomousDefendActive/);
 assert.match(lab,/experimentalAiAutonomousDefense:autonomousDefendActive/);
 assert.match(lab,/autonomousDefendActive=choice==='ai-defend-auto'/);
 assert.match(lab,/velocity:physicsTickSnapshot.ball.velocity/);
});

test('ME-PB-27 release only on synchronized actual previous-tick defender START',()=>{
 const selected=chooseObservedLaneClosure({players:INITIAL_PLAYERS,
  ballPosition:{x:-19.35,y:0},ballVelocity:{x:6.2,y:0}});
 const plan=Object.freeze({...selected,activatedAtTick:14,phase:'closing'});
 const frame=(tick,started)=>({version:FOOT_CONTACT_VERSION,tick,started});
 const decide=(contactFrame,previousTick=156)=>releaseObservedLaneClosure({
  plan,contactFrame,previousTick
 });
 assert.strictEqual(decide(null),plan);
 assert.strictEqual(decide(frame(156,['away-9'])),plan);
 assert.strictEqual(decide(frame(13,['away-10']),13),plan);
 for(const invalid of [
  frame(155,['away-10']),{...frame(156,['away-10']),version:'wrong'},
  frame(156,['away-10','away-10']),frame(156,['forged']),
  frame(156,null)
 ])assert.throws(()=>decide(invalid),/Synchronized canonical/);
 const released=decide(frame(156,['away-10']));
 assert.equal(released.phase,'released-after-physical-contact');
 assert.equal(released.releaseVersion,LOCAL_LANE_RELEASE_VERSION);
 assert.equal(released.releasedAtMovementTick,157);
 assert.equal(released.officialPossession,false);
 assert.ok(Object.isFrozen(released));
 assert.strictEqual(releaseObservedLaneClosure({
  plan:released,contactFrame:frame(157,['away-10']),previousTick:157
 }),released,'idempotent after physical release');
});
test('ME-PB-27 actual physical release replays and malformed frames do not advance',()=>{
 const real=simulate(230);
 assert.ok(real.contact);
 assert.equal(real.samples[real.contact.tick].closure.phase,
  'released-after-physical-contact');
 const m=createPlayerMovement(playerFlags);
 const activated=m.step({x:-19.35,y:0},{
  velocity:{x:6.2,y:0},
  footContact:{version:FOOT_CONTACT_VERSION,tick:0,started:[]}
 });
 assert.equal(activated.observedLaneClosure.phase,'closing');
 assert.throws(()=>m.step({x:-19.2,y:0},{
  velocity:{x:6.2,y:0},
  footContact:{version:FOOT_CONTACT_VERSION,tick:999,started:['away-10']}
 }),/Synchronized canonical/);
 assert.equal(m.snapshot().tick,1);
 const reset=m.reset().snapshot();
 assert.deepEqual(reset.players,INITIAL_PLAYERS);
 assert.equal(reset.observedLaneClosure,null);
 assert.deepEqual(simulate(230),real);
});

test('ME-PB-29 bounded lateral retarget uses ONLY fresh measured ball flight',()=>{
 const choice=chooseObservedLaneClosure({
  players:INITIAL_PLAYERS,ballPosition:{x:-19.35,y:0},
  ballVelocity:{x:6.2,y:0}
 });
 const plan=Object.freeze({...choice,activatedAtTick:14,phase:'closing'});
 const sample=(target,position,velocity,movementTick)=>retargetObservedLaneClosure({
  plan:target,ballPosition:position,ballVelocity:velocity,movementTick
 });
 const baseline=sample(plan,{x:-18,y:0},{x:5.9,y:0},15);
 assert.strictEqual(baseline,plan,'ordinary longitudinal slowdown may not cause lane jitter');
 const change=sample(plan,{x:-18,y:1.7},{x:5.9,y:1.6},15);
 assert.notStrictEqual(change,plan);
 assert.equal(change.retargetVersion,LOCAL_LANE_RETARGET_VERSION);
 assert.equal(change.retargetCount,1);
 assert.equal(change.lastRetargetMovementTick,15);
 assert.equal(change.defenderId,plan.defenderId,'never swap the physical defender');
 assert.equal(change.waypoint.x,plan.waypoint.x,'hold original longitudinal crossing');
 assert.ok(Math.abs(change.waypoint.y-plan.waypoint.y)<=
  LOCAL_LANE_RETARGET_MAX_STEP_M+1e-12);
 assert.equal(change.observedLateralBallPositionM,1.7);
 assert.equal(change.observedLateralBallVelocityMps,1.6);
 assert.equal(change.interceptionProven,false);
 assert.equal(change.officialPossession,false);
 assert.ok(Object.isFrozen(change)&&Object.isFrozen(change.waypoint));
 assert.equal(plan.waypoint.y,0,'never mutate an earlier frozen physics decision');
 assert.strictEqual(sample(change,{x:-17.8,y:2.1},{x:5.7,y:1.5},16),change,
  'short-interval retargets cannot flicker at 60Hz');
 const next=sample(change,{x:-17.6,y:2.3},{x:5.5,y:1.5},
   15+LOCAL_LANE_RETARGET_MIN_INTERVAL_TICKS);
 assert.equal(next.retargetCount,2);
 assert.ok(next.waypoint.y>change.waypoint.y);
 const bendBack=sample(next,{x:-17.5,y:-2.4},{x:5.4,y:-1.7},21);
 assert.equal(bendBack.defenderId,plan.defenderId);
 assert.equal(bendBack.retargetCount,3);
 assert.ok(bendBack.waypoint.y<next.waypoint.y,
  'fresh observed opposite lateral ball motion reverses the waypoint gradually');
 assert.strictEqual(sample(next,{x:-17,y:8},{x:0.5,y:2},19),next,
  'lost/slow forward flight may not keep extrapolating lane targets');
 for(const [state,position,velocity,tick] of [
  [plan,{x:-18,y:1},{x:5,y:NaN},15],
  [plan,{x:NaN,y:1},{x:5,y:1},15],
  [plan,{x:-18,y:1},{x:5,y:1},13],
  [next,{x:-18,y:1},{x:5,y:1},18]
 ])assert.throws(()=>sample(state,position,velocity,tick),
   /Measured finite|Fresh monotonic/);
 const foot={version:FOOT_CONTACT_VERSION,tick:156,started:['away-10']};
 const released=releaseObservedLaneClosure({
  plan,contactFrame:foot,previousTick:156
 });
 const after=sample(released,{x:-6,y:10},{x:5,y:8},157);
 assert.strictEqual(after,released,'no revival after a real Rapier shoe START');
 assert.equal(after.phase,'released-after-physical-contact');
});

function simulatePhysicalObliqueRetarget(limit=145){
 // The ball below is a REAL Rapier world with grounded rolling friction,
 // sampled from its completed 60Hz position and velocity; no synthetic
 // interception, teleported defender or externally edited ball snapshot.
 const world=createEngine(RAPIER,{
  preset:'roll',seed:'me-pb-29-rapier-oblique-flight',
  x:-19.35,y:0,z:0,vx:12,vy:4,vz:0
 });
 const movement=createPlayerMovement(playerFlags);
 const samples=[];
 try{
  for(let tick=1;tick<=limit;tick++){
   const before=world.snapshot();
   const frame=movement.step(before.ball.position,{
    velocity:before.ball.velocity
   });
   const completed=world.step();
   const lane=frame.observedLaneClosure;
   const defender=frame.players.find(p=>p.id===lane?.defenderId);
   samples.push(Object.freeze({
    tick,measuredBallY:before.ball.position.y,
    measuredBallVy:before.ball.velocity.y,
    actualRapierBallY:completed.ball.position.y,
    lane:lane?Object.freeze({
     phase:lane.phase,defenderId:lane.defenderId,
     waypointY:lane.waypoint.y,
     count:lane.retargetCount??0,
     retargetVersion:lane.retargetVersion??null
    }):null,
    defender:!defender?null:Object.freeze({
     x:defender.x,y:defender.y,vx:defender.vx,vy:defender.vy
    })
   }));
  }
  return Object.freeze(samples);
 }finally{world.dispose();}
}
test('ME-PB-29 actual oblique Rapier roll drives smooth same-defender updates and exact replay',()=>{
 const measured=simulatePhysicalObliqueRetarget();
 assert.equal(measured.length,145);
 const first=measured[0].lane,final=measured.at(-1).lane;
 assert.ok(first&&final);
 assert.equal(first.defenderId,'away-10');
 assert.equal(final.defenderId,first.defenderId);
 assert.ok(final.count>=1,
  'real Rapier ball must shift the observed lane: '+JSON.stringify({
   first,final,actualBallY:measured.at(-1).actualRapierBallY,
   midSample:measured[45],lastSample:measured.at(-1)
  }));
 assert.equal(final.retargetVersion,LOCAL_LANE_RETARGET_VERSION);
 assert.ok(Math.abs(final.waypointY-first.waypointY)>=
   LOCAL_LANE_RETARGET_MAX_STEP_M-1e-10,
  'measured rolling trajectory must change the crossing aim by a bounded step');
 assert.ok(measured.at(-1).actualRapierBallY>measured[0].actualRapierBallY+1,
  'ball trajectory must have truly changed in physics, not just observer data');
 for(let i=1;i<measured.length;i++){
  const a=measured[i-1],b=measured[i];
  if(!a.lane||!b.lane)continue;
  assert.ok(Math.abs(b.lane.waypointY-a.lane.waypointY)<=
    LOCAL_LANE_RETARGET_MAX_STEP_M+1e-9);
  assert.equal(b.lane.defenderId,a.lane.defenderId);
  assert.ok(Math.hypot(b.defender.x-a.defender.x,b.defender.y-a.defender.y)<=
    PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-6,
   'real defender remains within the 7m/s 60Hz movement bound');
 }
 assert.deepEqual(simulatePhysicalObliqueRetarget(),measured,
  'canonical Rapier motion and all adjustments repeat deterministically');
 process.stdout.write('ME_PB_29_RAPIER_RETARGET '+JSON.stringify({
  actualBallLateralM:measured.at(-1).actualRapierBallY,
  initialWaypointY:first.waypointY,finalWaypointY:final.waypointY,
  retargets:final.count,defender:final.defenderId,
  bounded:true,replay:true,officialPossession:false
 })+'\\n');
});

function baseObservedFlightPlan(){
 return Object.freeze({...chooseObservedLaneClosure({
  players:INITIAL_PLAYERS,
  ballPosition:{x:-19.35,y:0},
  ballVelocity:{x:6.2,y:0}
 }),activatedAtTick:14,phase:'closing'});
}
const flightSample=(plan,movementTick,{
 x=-18,y=0,vx=5,vy=0,defenderX=5,defenderY=0
}={})=>abandonObservedLaneClosure({
 plan,movementTick,
 ballPosition:{x,y},ballVelocity:{x:vx,y:vy},
 defender:{id:plan.defenderId,team:'away',x:defenderX,y:defenderY}
});
test('ME-PB-30 each observed flight-loss cause requires consecutive 60Hz evidence',()=>{
 const scenarios=[
  {reason:'slowed',value:{vx:0.7},ticks:LOCAL_LANE_ABANDON_CONFIRM_TICKS.slowed},
  {reason:'reversed',value:{vx:-1.4},ticks:LOCAL_LANE_ABANDON_CONFIRM_TICKS.reversed},
  {reason:'passed-defender',value:{x:-3,defenderX:-7},
   ticks:LOCAL_LANE_ABANDON_CONFIRM_TICKS['passed-defender']}
 ];
 for(const {reason,value,ticks} of scenarios){
  let plan=baseObservedFlightPlan();
  for(let i=0;i<ticks;i++){
   plan=flightSample(plan,15+i,value);
   if(i<ticks-1){
    assert.equal(plan.phase,'closing','one measurement must never abandon');
    assert.equal(plan.flightLossCandidate,reason);
    assert.equal(plan.flightLossEvidenceTicks,i+1);
   }
  }
  assert.equal(plan.phase,'released-after-observed-flight');
  assert.equal(plan.releaseVersion,LOCAL_LANE_ABANDON_VERSION);
  assert.equal(plan.releaseReason,reason);
  assert.equal(plan.confirmedFlightLossTicks,ticks);
  assert.equal(plan.releasedAtMovementTick,14+ticks);
  assert.equal(plan.interceptionProven,false);
  assert.equal(plan.officialPossession,false);
  assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.waypoint));
  assert.strictEqual(flightSample(plan,15+ticks,{vx:9,x:-17}),plan,
   'terminal release never resumes a chase after flight recovers');
  assert.strictEqual(releaseObservedLaneClosure({plan,contactFrame:{
   version:FOOT_CONTACT_VERSION,tick:15+ticks,started:[plan.defenderId]
  },previousTick:15+ticks}),plan,
  'a later contact frame cannot rewrite an observed-flight release');
 }
});
test('ME-PB-30 hysteresis clears transient observations and rejects stale/forged state',()=>{
 let state=baseObservedFlightPlan();
 const advance=(tick,values)=>{state=flightSample(state,tick,values);};
 advance(15,{vx:0.5});advance(16,{vx:0.5});
 assert.equal(state.flightLossEvidenceTicks,2);
 advance(17,{vx:3});
 assert.equal(state.phase,'closing');
 assert.equal(state.flightLossCandidate,null);
 assert.equal(state.flightLossEvidenceTicks,0);
 advance(18,{vx:-1});
 assert.equal(state.flightLossCandidate,'reversed');
 assert.equal(state.flightLossEvidenceTicks,1);
 advance(19,{vx:0.4});
 assert.equal(state.flightLossCandidate,'slowed');
 assert.equal(state.flightLossEvidenceTicks,1,
  'changing loss cause must reset its consecutive-evidence counter');
 assert.throws(()=>flightSample(state,19,{vx:0.3}),/Fresh monotonic/);
 assert.throws(()=>flightSample(state,18,{vx:0.3}),/Fresh monotonic/);
 assert.throws(()=>flightSample(state,20,{vx:NaN}),/Measured canonical/);
 assert.throws(()=>abandonObservedLaneClosure({
  plan:state,movementTick:20,ballPosition:{x:-18,y:0},
  ballVelocity:{x:0.1,y:0},defender:{id:'away-9',team:'away',x:5,y:0}
 }),/Measured canonical/);
 assert.equal(state.phase,'closing','invalid measurements do not mutate frozen state');
 const plan=baseObservedFlightPlan();
 // Merely moving past the INITIAL waypoint is not enough. Actual physical
 // player XY must also show that the ball is beyond the defender.
 const justBeyond=flightSample(plan,15,{
  x:plan.waypoint.x+LOCAL_LANE_ABANDON_PASSED_MARGIN_M+0.1,
  defenderX:plan.waypoint.x+LOCAL_LANE_ABANDON_PASSED_MARGIN_M
 });
 assert.equal(justBeyond.flightLossCandidate,null);
});
test('ME-PB-30 physical shoe START always outranks simultaneous flight-loss',()=>{
 const m=createPlayerMovement(playerFlags);
 m.step({x:-19.35,y:0},{velocity:{x:6.2,y:0},
  footContact:{version:FOOT_CONTACT_VERSION,tick:0,started:[]}});
 const contact=m.step({x:-19.1,y:0},{velocity:{x:-2,y:0},
  footContact:{version:FOOT_CONTACT_VERSION,tick:1,started:['away-10']}});
 assert.equal(contact.observedLaneClosure.phase,'released-after-physical-contact');
 assert.equal(contact.observedLaneClosure.releaseVersion,LOCAL_LANE_RELEASE_VERSION);
 assert.equal(contact.observedLaneClosure.releaseReason,undefined);
 assert.equal(contact.observedLaneClosure.interceptionProven,false);
 const next=m.step({x:-19,y:0},{velocity:{x:0,y:0},
  footContact:{version:FOOT_CONTACT_VERSION,tick:2,started:[]}});
 assert.strictEqual(next.observedLaneClosure,contact.observedLaneClosure);
 assert.deepEqual(m.reset().snapshot().players,INITIAL_PLAYERS);
});
function simulateRapierFlightAbandon(vx,limit=260){
 // Independent real Rapier rolling ball: no AI impulse, fake ball movement,
 // manually forged contact, or disabled kinematic speed bound.
 const world=createEngine(RAPIER,{
  preset:'roll',seed:'me-pb-30-rapier-observed-lost-flight',
  x:-19.35,y:0,z:0,vx,vy:0,vz:0
 });
 const movement=createPlayerMovement(playerFlags),samples=[];
 try{
  assert.deepEqual(movement.snapshot().players,INITIAL_PLAYERS);
  for(let t=1;t<=limit;t++){
   const before=world.snapshot();
   const frame=movement.step(before.ball.position,{
    velocity:before.ball.velocity
   });
   const after=world.step();
   const assignment=frame.observedLaneClosure;
   const defender=frame.players.find(p=>p.id==='away-10');
   samples.push(Object.freeze({
    tick:t,ball:canonicalSnapshot(after),
    measuredBallX:before.ball.position.x,
    measuredBallVx:before.ball.velocity.x,
    defender:Object.freeze({x:defender.x,y:defender.y}),
    plan:assignment?Object.freeze({
     phase:assignment.phase,reason:assignment.releaseReason??null,
     releaseTick:assignment.releasedAtMovementTick??null,
     startTick:assignment.activatedAtTick,
     defenderId:assignment.defenderId,
     interceptionProven:assignment.interceptionProven,
     officialPossession:assignment.officialPossession
    }):null,
    dutyRecovery:frame.observedLaneRecovery
   }));
  }
  return Object.freeze(samples);
 }finally{world.dispose();}
}
test('ME-PB-30 actual Rapier rolling ball slows; defender relinquishes chase and replays',()=>{
 const samples=simulateRapierFlightAbandon(2.7);
 const first=samples[0].plan,last=samples.at(-1).plan;
 assert.ok(first);
 assert.equal(first.phase,'closing');
 assert.equal(first.startTick,1);
 assert.equal(first.defenderId,'away-10');
 assert.equal(last.phase,'released-after-observed-flight');
 assert.equal(last.reason,'slowed');
 assert.ok(last.releaseTick>first.startTick);
 assert.equal(last.officialPossession,false);
 assert.equal(last.interceptionProven,false);
 assert.ok(samples.some(s=>s.measuredBallVx<1.25),
  'measured velocity actually fell below the ground-roll threshold');
 const released=samples.filter(s=>s.tick>=last.releaseTick);
 assert.ok(released.every(s=>s.plan.phase==='released-after-observed-flight'));
 assert.ok(released.every(s=>s.dutyRecovery&&
   s.dutyRecovery.version===LOCAL_LANE_REJOIN_VERSION&&
   s.dutyRecovery.tick===s.tick&&
   s.dutyRecovery.releasePhase==='released-after-observed-flight'));
 assert.ok(samples.filter(s=>s.tick<last.releaseTick).every(s=>s.dutyRecovery===null));
 for(let i=1;i<samples.length;i++){
  assert.ok(Math.hypot(
   samples[i].defender.x-samples[i-1].defender.x,
   samples[i].defender.y-samples[i-1].defender.y
  )<=PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-6);
 }
 assert.deepEqual(simulateRapierFlightAbandon(2.7),samples,
  'slow-flight abandonment, real body trajectory and ball physics replay');
 process.stdout.write('ME_PB_30_RAPIER_SLOW_ABANDON '+JSON.stringify({
  releaseTick:last.releaseTick,reason:last.reason,replay:true,
  noInventedContact:true,noOfficialPossession:true
 })+'\\n');
});
test('ME-PB-30 actual Rapier ball past moving defender abandons unreachable corridor',()=>{
 const samples=simulateRapierFlightAbandon(12);
 const last=samples.at(-1).plan;
 assert.ok(last);
 assert.equal(last.phase,'released-after-observed-flight');
 assert.equal(last.reason,'passed-defender');
 assert.ok(last.releaseTick>1);
 assert.ok(samples[last.releaseTick-1].measuredBallX>
  samples[last.releaseTick-1].defender.x+LOCAL_LANE_ABANDON_PASSED_MARGIN_M);
 assert.deepEqual(simulateRapierFlightAbandon(12),samples);
 assert.equal(last.interceptionProven,false);
 assert.equal(last.officialPossession,false);
});
test('ME-PB-30 UI uses existing LAB-10 scenario and explicit observed-flight reason',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 const movement=readFileSync(new URL('../src/player-movement.mjs',import.meta.url),'utf8');
 assert.match(html,/id="preset-opt-ai-defend-auto" data-value="ai-defend-auto"/);
 assert.doesNotMatch(html,/id="ai-abandon-demo"/);
 assert.match(lab,/lane.phase==='released-after-observed-flight'/);
 assert.match(lab,/measured ball slowed/);
 assert.match(lab,/ball passed the defending corridor/);
 assert.match(movement,/abandonObservedLaneClosure\(/);
 assert.match(movement,/if\(observedLaneClosure.phase==='closing'\)/);
});

const realRejoinPlan=phase=>Object.freeze({
 ...baseObservedFlightPlan(),
 phase,releaseVersion:phase==='released-after-observed-flight'?
  LOCAL_LANE_ABANDON_VERSION:LOCAL_LANE_RELEASE_VERSION,
 releasedAtMovementTick:15
});
function rejoinSample(plan,previous,movementTick,{
 before={x:0,y:0},after={x:0,y:0,blockedBy:null},
 target={x:0,y:0},maxStepM=PLAYER_MAX_SPEED_MPS*PLAYER_DT
}={}){
 return observeReleasedLaneRejoin({
  plan,previous,movementTick,maxStepM,
  defenderBefore:{id:plan.defenderId,team:'away',...before},
  defenderAfter:{id:plan.defenderId,team:'away',...after},
  tacticalTarget:target
 });
}
test('ME-PB-31 measured normal-duty rejoin is opt-in and alignment takes six real ticks',()=>{
 const plan=realRejoinPlan('released-after-observed-flight');
 assert.equal(observeReleasedLaneRejoin({
  plan:baseObservedFlightPlan(),previous:null,movementTick:15
 }),null,'active lane still owned by the defensive closer');
 let previous=null;
 for(let tick=15;tick<15+LOCAL_LANE_REJOIN_CONFIRM_TICKS;tick++){
  const next=rejoinSample(plan,previous,tick,{
   before:{x:1.2,y:0},after:{x:1.1,y:0,blockedBy:null},
   target:{x:0.4,y:0}
  });
  assert.equal(next.version,LOCAL_LANE_REJOIN_VERSION);
  assert.equal(next.tick,tick);
  assert.equal(next.defenderId,'away-10');
  assert.ok(Object.isFrozen(next)&&Object.isFrozen(next.tacticalTarget));
  assert.equal(next.tacticalTarget.x,0.4);
  assert.ok(Math.abs(next.actualMovementM-0.1)<1e-10);
  assert.ok(Math.abs(next.distanceToCurrentDutyM-0.7)<1e-10);
  assert.ok(Math.abs(next.actualAdvanceM-0.1)<1e-10);
  assert.equal(next.alignedTicks,tick-14);
  assert.equal(next.status,tick<15+LOCAL_LANE_REJOIN_CONFIRM_TICKS-1?
   'returning-to-current-duty':'aligned-with-current-duty');
  assert.equal(next.observedOnly,true);
  assert.equal(next.officialPossession,false);
  assert.equal(next.interceptionProven,false);
  previous=next;
 }
 const movedTarget=rejoinSample(plan,previous,21,{
  before:{x:1.1,y:0},after:{x:1.1,y:0,blockedBy:null},
  target:{x:5,y:0}
 });
 assert.equal(movedTarget.alignedTicks,0,
  'moving tactical duty cannot be misrepresented as continuously aligned');
 assert.equal(movedTarget.status,'returning-to-current-duty');
 assert.ok(movedTarget.distanceToCurrentDutyM>LOCAL_LANE_REJOIN_DISTANCE_M);
});
test('ME-PB-31 real player blocking requires persistence and does not fake progress',()=>{
 const plan=realRejoinPlan('released-after-physical-contact');
 let previous=null;
 for(let tick=15;tick<15+LOCAL_LANE_REJOIN_BLOCKED_TICKS;tick++){
  const next=rejoinSample(plan,previous,tick,{
   before:{x:5,y:0},after:{x:5,y:0,blockedBy:'home-8'},
   target:{x:0,y:0}
  });
  assert.equal(next.blockedBy,'home-8');
  assert.equal(next.actualMovementM,0);
  assert.equal(next.actualAdvanceM,0);
  assert.equal(next.blockedTicks,tick-14);
  assert.equal(next.status,tick<15+LOCAL_LANE_REJOIN_BLOCKED_TICKS-1?
   'returning-to-current-duty':'blocked-by-observed-player');
  previous=next;
 }
 const cleared=rejoinSample(plan,previous,21,{
  before:{x:5,y:0},after:{x:4.92,y:0,blockedBy:null},
  target:{x:0,y:0}
 });
 assert.equal(cleared.blockedTicks,0);
 assert.equal(cleared.status,'returning-to-current-duty');
 assert.ok(cleared.actualAdvanceM>0);
});
test('ME-PB-31 invalid timestamps, forged body jumps and wrong defender are rejected',()=>{
 const plan=realRejoinPlan('released-after-observed-flight');
 const first=rejoinSample(plan,null,15);
 for(const tick of [14,16,0,NaN])assert.throws(()=>
  rejoinSample(plan,null,tick),/Contiguous/);
 for(const tick of [15,17])assert.throws(()=>
  rejoinSample(plan,first,tick),/Contiguous/);
 assert.throws(()=>rejoinSample(plan,null,15,{
  before:{x:0,y:0},after:{x:2,y:0,blockedBy:null},
  target:{x:0,y:0}
 }),/Unbounded/);
 assert.throws(()=>rejoinSample(plan,null,15,{
  before:{x:0,y:0},after:{x:NaN,y:0,blockedBy:null}
 }),/Measured canonical/);
 assert.throws(()=>rejoinSample(plan,null,15,{
  after:{x:0,y:0,blockedBy:'away-10'}
 }),/Measured canonical/);
 assert.throws(()=>observeReleasedLaneRejoin({
  plan,previous:null,movementTick:15,maxStepM:PLAYER_MAX_SPEED_MPS*PLAYER_DT,
  defenderBefore:{id:'away-9',team:'away',x:0,y:0},
  defenderAfter:{id:'away-10',team:'away',x:0,y:0,blockedBy:null},
  tacticalTarget:{x:0,y:0}
 }),/Measured canonical/);
 assert.equal(first.officialPossession,false);
});
test('ME-PB-31 normal roster mode remains unchanged and reset removes all rejoin evidence',()=>{
 const regular=createPlayerMovement();
 assert.equal(regular.snapshot().observedLaneRecovery,undefined);
 const special=createPlayerMovement(playerFlags);
 const zero=special.snapshot();
 assert.equal(zero.observedLaneRecovery,null);
 special.step({x:-19.35,y:0},{velocity:{x:6.2,y:0},
  footContact:{version:FOOT_CONTACT_VERSION,tick:0,started:[]}});
 const physical=special.step({x:-19.1,y:0},{velocity:{x:0,y:0},
  footContact:{version:FOOT_CONTACT_VERSION,tick:1,started:['away-10']}});
 assert.equal(physical.observedLaneRecovery.version,LOCAL_LANE_REJOIN_VERSION);
 assert.equal(physical.observedLaneRecovery.tick,2);
 assert.equal(physical.observedLaneRecovery.releasePhase,
  'released-after-physical-contact');
 assert.equal(physical.observedLaneRecovery.officialPossession,false);
 assert.deepEqual(special.reset().snapshot(),zero);
 const samples=simulate(260).samples;
 assert.ok(samples.some(s=>s.dutyRecovery!==null));
 assert.deepEqual(simulate(260).samples,samples,
  'actual Rapier contact, unchanged 22-player body motion and duty evidence replay');
});
test('ME-PB-31 existing LAB-10 UI reports measured duty gap without adding buttons',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.match(html,/id="preset-opt-ai-defend-auto" data-value="ai-defend-auto"/);
 assert.doesNotMatch(html,/id="ai-rejoin-demo"/);
 assert.match(lab,/playerSnapshot.observedLaneRecovery/);
 assert.match(lab,/measured duty gap/);
 assert.match(lab,/aligned-with-current-duty/);
});
