// #628 ACTIONS-B01: complete a basic CROSS attempt before tuning numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {INITIAL_PLAYERS,PLAYER_VERSION,PLAYER_MIN_SEPARATION_M}
 from '../src/player-movement.mjs';
import {selectUniformAutonomousContactAction}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {initialResearchShotLineup}
 from '../src/research-shot-initial-lineup.mjs';
import {CROSS_LAB_STARTS,ACTION_LAB_SCENARIOS}
 from '../src/action-lab-scenarios.mjs';
import {initializeRapier,createEngine,normalizeScenario} from '../src/core.mjs';
import {LAB_SHOT_PROFILES,calculateCurrentLabShotCalibration,selectLabShotTarget} from '../src/lab-shot-calibration.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {calculateLowCrossReceivingCushion,M25_CROSS_CUSHION_MAX_IMPULSE_NS,
 calculateLowCrossSpinCushion,M25_CROSS_MAX_ANGULAR_IMPULSE_NMS,
 calculateOrientedReceivingCushion,CURRENT_LAB_DYNAMICS_VERSION}
 from '../src/physical-receiving-cushion-m25.mjs';

const frame=(players,tick=1)=>Object.freeze({
 version:PLAYER_VERSION,tick,
 players:Object.freeze(players)
});
const choose=(side,players,ball)=>selectUniformAutonomousContactAction({
 tick:1,contactStarted:[side+'-10'],contactActive:[side+'-10'],
 playerFrame:frame(players),ballPosition:{x:ball.x,y:ball.y,z:0.11},
 ballVelocity:{x:0,y:0,z:0},ballRadiusM:0.11
});
test('ACTIONS-B01 original uniform policy selects a genuine wide CROSS candidate for both teams',()=>{
 for(const side of ['home','away']){
  const start=CROSS_LAB_STARTS[side];
  const staged=initialResearchShotLineup(INITIAL_PLAYERS,side,start,{wideCross:true});
  assert.deepEqual(staged.map(x=>x.id),INITIAL_PLAYERS.map(x=>x.id));
  for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
   assert.ok(Math.hypot(staged[i].x-staged[j].x,
    staged[i].y-staged[j].y)>=PLAYER_MIN_SEPARATION_M-1e-8);
  const action=choose(side,staged,start);
  assert.equal(action.action,'cross');
  assert.equal(action.playerId,side+'-10');
  assert.equal(action.recipientId,side+'-9');
  assert.equal(action.team,side);
  assert.equal(action.passTarget,null);
  assert.equal(action.shotTarget,null);
  assert.equal(action.crossTarget.recipientId,side+'-9');
  assert.equal(action.crossTarget.physicsTick,1);
  assert.equal(action.crossTarget.physicalCrossAttemptOnly,true);
  assert.equal(action.crossTarget.crossCompleted,false);
  assert.ok(action.crossTarget.distanceM>=8);
  assert.ok(action.crossTarget.laneClearanceM>=1.4);
  assert.equal(action.decisionContext.rule,'wide-live-teammate-lofted-cross');
  assert.ok(action.impulseNs.x*(side==='home'?1:-1)>0);
  assert.ok(action.impulseNs.y*(side==='home'?-1:1)>0);
  assert.ok(action.impulseNs.z>0);
  assert.ok(Math.abs(Math.hypot(...Object.values(action.impulseNs))-2.7)<1e-8);
  assert.equal(action.appliedByRapier,false,
   'pure decision is never its own physical authorization');
  assert.equal(action.officialMatchAction,false);
  assert.equal(action.officialMatchPossession,false);
 }
});
test('ACTIONS-B01 no live teammate or no exclusive shoe START means no cross',()=>{
 const side='home',start=CROSS_LAB_STARTS.home;
 const staged=initialResearchShotLineup(INITIAL_PLAYERS,side,start,{wideCross:true});
 const noTarget=staged.map(p=>p.id==='home-9'?
  Object.freeze({...p,x:-5,y:-18}):p);
 const nonCross=choose(side,noTarget,start);
 assert.notEqual(nonCross?.action,'cross');
 assert.equal(selectUniformAutonomousContactAction({
  tick:1,contactStarted:['home-10','away-10'],
  contactActive:['home-10','away-10'],
  playerFrame:frame(staged),
  ballPosition:{x:start.x,y:start.y,z:0.11},
  ballVelocity:{x:0,y:0,z:0},ballRadiusM:0.11
 }),null);
 const center=choose('home',staged,{x:30,y:0});
 assert.notEqual(center?.action,'cross');
 assert.throws(()=>initialResearchShotLineup(INITIAL_PLAYERS,'home',start,{
  blockedLane:true,wideCross:true}),TypeError);
 assert.equal(ACTION_LAB_SCENARIOS.filter(s=>s.id==='cross').length,1);
});
test('ACTIONS-B01 real HOME/AWAY canonical Rapier shoe START, lofted CROSS impulse and 3D ball flight',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['home','away']){
  const a=createControlledActionLab(R,'cross',{shotSide:side,historicalEvidenceBaseline:true});
  const b=createControlledActionLab(R,'cross',{shotSide:side,historicalEvidenceBaseline:true});
  try{
   const zero=a.snapshot();
   assert.equal(zero.physicsTick,0);
   assert.equal(zero.action,null);
   assert.equal(zero.starts.length,0);
   assert.equal(zero.players.length,22);
   let first=null,flight=false;
   for(let t=1;t<=100;t++){
    const x=a.step(),y=b.step();
    assert.deepEqual(x,y,'HOME/AWAY physical replay must be deterministic');
    assert.equal(x.officialMatchPossession,false);
    assert.equal(x.officialMatchResult,null);
    assert.equal(x.evidence.officialGoal,false);
    assert.equal(x.evidence.passCompleted,null);
    if(x.action?.action==='cross'&&!first){
     first=x.action;
     assert.deepEqual(x.starts,[side+'-10']);
     assert.equal(x.evidence.verifiedShoeImpulse,true);
     assert.equal(x.action.appliedByRapier,true);
     assert.equal(x.action.actualPhysicsImpulseApplied,true);
     assert.equal(x.action.crossTarget.physicalCrossAttemptOnly,true);
     assert.equal(x.action.crossTarget.crossCompleted,false);
     assert.equal(x.action.officialMatchAction,false);
     assert.ok(x.action.impulseNs.z>0);
    }
    if(x.shotFlight?.actionType==='cross'&&
       x.shotFlight.observed3DFlight){
     flight=true;
     assert.ok(x.shotFlight.maxCenterZM>x.shotFlight.origin.z+0.02);
     assert.ok(x.shotFlight.path3DM>0);
    }
   }
   assert.ok(first,'CROSS requires a true native Rapier shoe START on '+side);
   assert.ok(flight,'cross must produce actual measured ball flight on '+side);
   process.stdout.write('ME_628_ACTION_CROSS_'+side.toUpperCase()+' '+
    JSON.stringify({actionTick:first.tick,
     actor:first.playerId,recipient:first.crossTarget.recipientId,
     trueRapierImpulse:first.impulseNs,observed3DFlight:flight,
     officialPossession:false,crossCompleted:false})+'\\n');
  }finally{a.dispose();b.dispose();}
 }
});


test('CROSS-01 isolated native lofted cross measures first low arrival for both sides',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 assert.throws(()=>createControlledActionLab(R,'cross-pair',{bodyGuardEnabled:true}),TypeError);
 for(const side of ['home','away'])for(const variantIndex of [0,1,9,21,29]){
  const lab=createControlledActionLab(R,'cross-pair',{shotSide:side,variantIndex});
  try{
   let frame=lab.snapshot(),count=0,firstTouch=null;
   assert.equal(frame.genuinePhysicalPlayerCount,2);
   assert.deepEqual(lab.focus,[side+'-9',side+'-10']);
   for(let t=1;t<=240;t++){
    frame=lab.step();
    assert.equal(frame.officialMatchPossession,false);
    assert.equal(frame.officialMatchResult,null);
    assert.ok(frame.starts.every(id=>lab.focus.includes(id)));
    const cushion=frame.crossPairAudit.receivingCushion;
    if(cushion&&!firstTouch){
     firstTouch=cushion;
     assert.equal(cushion.tick,frame.physicsTick);
     assert.deepEqual(frame.starts,[side+'-9']);
     assert.equal(frame.action,null,'no second football action');
     assert.equal(cushion.actualPhysicsImpulseApplied,true);
     assert.deepEqual(frame.ball.velocity,cushion.realPostBallVelocity);
    }else if(cushion)assert.equal(cushion,firstTouch,'only one first-touch impulse');
    if(frame.action){
     count++;
     assert.equal(frame.action.action,'cross');
     assert.equal(frame.action.playerId,side+'-10');
     assert.equal(frame.action.crossTarget.recipientId,side+'-9');
     assert.deepEqual(frame.starts,[side+'-10']);
     assert.equal(frame.action.actualPhysicsImpulseApplied,true);
     const c=frame.action.isolatedCrossCalibration;
     assert.ok(c.scale>=1&&c.scale<=3.8);
     for(const axis of ['x','y','z'])
      assert.equal(frame.action.impulseNs[axis],c.originalImpulseNs[axis]*c.scale);
     assert.ok(frame.action.impulseNs.z>0);
    }
   }
   assert.equal(count,1);
   rows.push({side,variantIndex,...frame.crossPairAudit});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_CROSS_PAIR '+JSON.stringify(rows)+'\n');
 assert.equal(rows.length,10);
 for(const row of rows){
  assert.equal(row.airborne,true,JSON.stringify(row));
  assert.ok(row.peakClearanceM>=1&&row.peakClearanceM<=5,JSON.stringify(row));
  assert.ok(row.arrival&&row.arrival.timeS>0.5&&row.arrival.timeS<=3,JSON.stringify(row));
  assert.ok(['native-ground-solver-pair','native-receiving-shoe-start'].includes(row.arrival.source),JSON.stringify(row));
  assert.ok(row.arrival.targetGapM<=3,JSON.stringify(row));
  assert.ok(row.firstLowSample,JSON.stringify(row));
  if(row.firstGroundContact)assert.ok(row.firstGroundContact.ground.solverContacts>0);
  if(row.firstReceivingShoeStart)assert.equal(row.firstReceivingShoeStart.realRapierShoeStart,true);
  assert.equal(row.officialReception,false);
  assert.equal(row.officialCrossCompleted,false);
  assert.equal(row.arrival.source,'native-receiving-shoe-start');
  // Preserve approved launch and first contact (original ten cases).
  assert.ok(row.arrival.timeS>=1.30&&row.arrival.timeS<=1.55,JSON.stringify(row));
  assert.ok(row.peakClearanceM>=2.10&&row.peakClearanceM<=2.90,JSON.stringify(row));
  assert.ok(row.arrival.targetGapM<=0.18,JSON.stringify(row));
  const c=row.receivingCushion;
  assert.ok(c&&c.tick===row.arrival.tick,JSON.stringify(row));
  assert.equal(c.nativeExclusiveShoeStart,true);
  assert.equal(c.version,CURRENT_LAB_DYNAMICS_VERSION);
  assert.equal(c.verifiedBallControl,false);
  const pre=c.realPreBallVelocity,post=c.realPostBallVelocity;
  const magnitude=Math.hypot(...Object.values(c.impulseNs));
  assert.ok(magnitude<=M25_CROSS_CUSHION_MAX_IMPULSE_NS+1e-9);
  assert.ok(Math.hypot(...Object.values(pre))>10);
  assert.ok(Math.hypot(post.x,post.y)>=1.0&&Math.hypot(post.x,post.y)<=1.5,JSON.stringify(row));
  assert.ok(Math.abs(post.z)<=0.10,JSON.stringify(row));
  assert.ok(post.x*c.controlDirection.x+post.y*c.controlDirection.y>=1.0);
  assert.ok(c.bodyProjection>=0.15&&c.shoeProjection>=0.15);
  assert.ok(Math.hypot(...Object.values(post))<Math.hypot(...Object.values(pre)));
  const preSpin=c.realPreAngularVelocity,postSpin=c.realPostAngularVelocity;
  if(c.spinCushion){
   const torque=c.spinCushion.torqueImpulseNms,target=c.spinCushion.targetAngularVelocity;
   const slip=w=>Math.hypot(w.x-target.x,w.y-target.y,w.z-target.z);
   assert.ok(Math.hypot(...Object.values(torque))<=M25_CROSS_MAX_ANGULAR_IMPULSE_NMS+1e-9);
   assert.ok(slip(postSpin)<=slip(preSpin)+1e-5);
  }
  const follow=row.receiverFollowThrough;
  assert.ok(follow?.completed&&follow.samples===121,JSON.stringify(row));
  assert.ok(follow.maxGapM<=1.6,JSON.stringify(row));
  assert.ok(follow.maxHorizontalSpeedMps<=1.65,JSON.stringify(row));
  assert.ok(follow.atQuarterSecond.horizontalSpeedMps>=0.35,JSON.stringify(row));
  assert.ok(follow.atHalfSecond.horizontalSpeedMps>=0.20&&follow.atHalfSecond.horizontalSpeedMps<=1.3,JSON.stringify(row));
  assert.ok(follow.atOneSecond.directedTravelM>=0.25&&follow.atOneSecond.directedTravelM<=1.25,JSON.stringify(row));
  assert.ok(follow.minDirectedTravelM>=-0.10&&follow.maxCrossTrackM<=0.40,JSON.stringify(row));
  assert.ok(follow.atTwoSeconds.speedMps<=0.30,JSON.stringify(row));
  assert.ok(follow.atTwoSeconds.clearanceM<=0.05,JSON.stringify(row));
 }
});

test('CROSS-02c controls towards goalward space away from receiver and shoe, mirrored, bounded',()=>{
 const args={ballVelocity:{x:10,y:-10,z:1.9},playerVelocity:{x:0,y:0},
  ballCentreZ:0.235,ballRadiusM:0.11,realBallPlayerGapM:0.15,ballMassKg:0.43,
  ballPosition:{x:0.06,y:0.12},receiverPosition:{x:0,y:0},shoePosition:{x:-0.11,y:0.19},attackingSide:'home'};
 const c=calculateLowCrossReceivingCushion(args);
 assert.ok(c);
 assert.ok(c.controlDirection.x>0&&c.bodyProjection>=0.15&&c.shoeProjection>=0.15);
 assert.ok(Math.hypot(...Object.values(c.impulseNs))<=6.5);
 const post=Object.keys(args.ballVelocity).map(k=>args.ballVelocity[k]+c.impulseNs[k]/args.ballMassKg);
 assert.ok(Math.abs(Math.hypot(...post)-1.25)<1e-10);
 assert.ok(Math.abs(post[2])<1e-10);
 const mirror=calculateLowCrossReceivingCushion({...args,attackingSide:'away',
  ballVelocity:{...args.ballVelocity,x:-10},ballPosition:{x:-0.06,y:0.12},shoePosition:{x:0.11,y:0.19}});
 assert.equal(mirror.controlDirection.x,-c.controlDirection.x);
 assert.equal(mirror.controlDirection.y,c.controlDirection.y);
 assert.equal(c.officialPossession,false);
 for(const patch of [{ballCentreZ:1.5},{realBallPlayerGapM:1},{ballVelocity:{x:19,y:0,z:0}},{ballVelocity:{x:0.1,y:0,z:0}}])
  assert.equal(calculateLowCrossReceivingCushion({...args,...patch}),null);
 assert.throws(()=>calculateLowCrossReceivingCushion({...args,ballMassKg:0}),TypeError);
});

test('CROSS-02c bounded spin alignment towards outgoing natural roll',()=>{
 const args={angularVelocity:{x:10,y:20,z:-3},principalInertia:{x:0.00347,y:0.00347,z:0.00347},
  ballRadiusM:0.11,linearImpulseNs:5.5,outgoingVelocity:{x:1.25,y:0}};
 const c=calculateLowCrossSpinCushion(args);
 assert.ok(c);
 assert.ok(Math.hypot(...Object.values(c.torqueImpulseNms))<=0.15);
 const post=Object.keys(args.angularVelocity).map(k=>args.angularVelocity[k]+c.torqueImpulseNms[k]/args.principalInertia.x);
 assert.ok(Math.hypot(post[0],post[1]-1.25/0.11,post[2])<1e-10);
 assert.equal(calculateLowCrossSpinCushion({...args,angularVelocity:{x:0,y:1.25/0.11,z:0}}),null);
 assert.equal(calculateLowCrossSpinCushion({...args,linearImpulseNs:0}),null);
 const limited=calculateLowCrossSpinCushion({...args,angularVelocity:{x:300,y:0,z:0}});
 assert.ok(Math.abs(Math.hypot(...Object.values(limited.torqueImpulseNms))-0.15)<1e-10);
 assert.throws(()=>calculateLowCrossSpinCushion({...args,principalInertia:{x:1,y:2,z:3}}),TypeError);
});

test('current LAB oriented control shares the same policy for grounded and lofted deliveries, with pressure',()=>{
 const args={ballVelocity:{x:8,y:0,z:0},playerVelocity:{x:0,y:0},
  ballCentreZ:0.11,ballRadiusM:0.11,realBallPlayerGapM:0.35,ballMassKg:0.43,
  ballPosition:{x:0.35,y:0},receiverPosition:{x:0,y:0},shoePosition:{x:0.22,y:0},attackingSide:'home'};
 const pass=calculateOrientedReceivingCushion({...args,deliveryKind:'pass'});
 const cross=calculateOrientedReceivingCushion({...args,deliveryKind:'cross'});
 assert.ok(pass&&cross);
 assert.deepEqual(pass.impulseNs,cross.impulseNs);
 assert.deepEqual(pass.controlDirection,cross.controlDirection);
 const pressured=calculateOrientedReceivingCushion({...args,deliveryKind:'pass',opponents:[{x:1.3,y:0}]});
 assert.ok(pressured&&Math.abs(pressured.controlDirection.y)>0);
 assert.equal(pressured.underImmediatePressure,true);
 assert.equal(pressured.noActiveOpponents,false);
 const slow=calculateOrientedReceivingCushion({...args,deliveryKind:'pass',ballVelocity:{x:0.6,y:0,z:0}});
 assert.ok(slow&&slow.targetSpeedMps<0.6);
});
test('every current gameplay Action LAB defaults to the same dynamics version',async()=>{
 const R=await initializeRapier(rapier);
 for(const spec of [...ACTION_LAB_SCENARIOS,...(await import('../src/small-sided-lab-scenarios.mjs')).SMALL_SIDED_LAB_SCENARIOS]){
  const lab=createControlledActionLab(R,spec.id);
  try{
   assert.equal(lab.snapshot().labDynamicsVersion,spec.mode==='referee'?null:CURRENT_LAB_DYNAMICS_VERSION,spec.id);
   for(let i=0;i<100;i++){
    const frame=lab.step();
    if(frame.action?.action==='pass')assert.ok(frame.action.isolatedGroundPassCalibration,spec.id);
    if(frame.action?.action==='cross')assert.ok(frame.action.isolatedCrossCalibration,spec.id);
    if(frame.action?.action==='shot')assert.ok(frame.action.labShotCalibration,spec.id);
    const c=frame.latestOrientedReception;
    if(c?.tick===frame.physicsTick){
     assert.equal(c.version,CURRENT_LAB_DYNAMICS_VERSION);
     assert.deepEqual(frame.starts,[c.actorId]);
     assert.equal(frame.action,null);
     assert.equal(c.officialPossession,false);
    }
   }
  }finally{lab.dispose();}
 }
});

// SHOT-01 stays in the focused delivery test entry point until a separate
// test file can be registered without multiplying CI runs.
test('SHOT-01 authentic empty-goal strike, actual full-ball crossing HOME/AWAY', {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 for(const side of ['home','away'])for(const variantIndex of [0,1,9,21,29]){
  const lab=createControlledActionLab(R,'shot-solo',{shotSide:side,variantIndex});
  try{
   assert.deepEqual(lab.focus,[side+'-10']);
   assert.equal(lab.snapshot().genuinePhysicalPlayerCount,1);
   let frame=lab.snapshot(),count=0;
   for(let i=0;i<180;i++){
    frame=lab.step();
    assert.equal(frame.officialMatchResult,null);
    if(frame.action){
     count++;
     assert.equal(frame.action.action,'shot');
     assert.deepEqual(frame.starts,[side+'-10']);
     assert.equal(frame.action.actualPhysicsImpulseApplied,true);
     assert.ok(frame.action.labShotCalibration);
     assert.ok(Math.hypot(...Object.values(frame.action.impulseNs))<=13+1e-8);
    }
    if(frame.shotSoloAudit.crossing)break;
   }
   assert.equal(count,1);
   rows.push({side,variantIndex,...frame.shotSoloAudit});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_SHOT_SOLO '+JSON.stringify(rows)+'\n');
 for(const row of rows){
  assert.ok(row.launchSpeedMps>=28&&row.launchSpeedMps<=31,JSON.stringify(row));
  assert.ok(row.peakClearanceM>=0.2&&row.peakClearanceM<=2.8,JSON.stringify(row));
  assert.ok(row.crossing?.fullBallCrossed&&row.crossing.goal,JSON.stringify(row));
  assert.equal(row.crossing.scoringTeam,row.side);
  assert.ok(row.crossing.timeS>=0.30&&row.crossing.timeS<=1.8,JSON.stringify(row));
  assert.ok(row.crossing.lateralErrorM<=0.35,JSON.stringify(row));
  assert.ok(row.crossing.heightErrorM<=0.35,JSON.stringify(row));
  assert.equal(row.crossing.officialGoal,false);
 }
});

test('SHOT-02 distinct native shot profiles on mirrored empty-goal starts',{timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 for(const profile of LAB_SHOT_PROFILES)for(const side of ['home','away'])for(const variantIndex of [0,1,9,21,29]){
  const lab=createControlledActionLab(R,'shot-solo',{shotSide:side,variantIndex,shotProfile:profile});
  try{
   let frame=lab.snapshot(),count=0;
   for(let i=0;i<240;i++){
    frame=lab.step();
    if(frame.action){
     count++;
     assert.equal(frame.action.action,'shot');
     assert.deepEqual(frame.starts,[side+'-10']);
     assert.equal(frame.action.labShotCalibration.profile,profile);
     assert.ok(Math.hypot(...Object.values(frame.action.impulseNs))<=13+1e-8);
     assert.equal(Boolean(frame.action.labShotSpin),['low','curled','tap-in'].includes(profile));
    }
    if(frame.shotSoloAudit.crossing)break;
   }
   assert.equal(count,1);
   rows.push({side,variantIndex,...frame.shotSoloAudit});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_SHOT_PROFILES '+JSON.stringify(rows)+'\n');
 for(const row of rows){
  assert.ok(row.crossing?.fullBallCrossed&&row.crossing.goal,JSON.stringify(row));
  assert.equal(row.crossing.scoringTeam,row.side);
  assert.equal(row.crossing.officialGoal,false);
  assert.ok(row.crossing.lateralErrorM<=0.50,JSON.stringify(row));
  assert.ok(row.crossing.heightErrorM<=0.45,JSON.stringify(row));
  const power=rows.find(x=>x.profile==='power'&&x.side===row.side&&x.variantIndex===row.variantIndex);
  if(row.profile==='low')assert.ok(row.peakClearanceM<=0.12,JSON.stringify(row));
  if(row.profile==='power')assert.ok(row.launchSpeedMps>=28&&row.launchSpeedMps<=31,JSON.stringify(row));
  if(row.profile==='tap-in'){
   assert.ok(row.distanceM>=0.95&&row.distanceM<=6.05,JSON.stringify(row));
   assert.ok(row.launchSpeedMps>=4.16&&row.launchSpeedMps<=9.73,JSON.stringify(row));
   assert.ok(row.peakClearanceM<=0.12,JSON.stringify(row));
  }
  if(row.profile==='placed')assert.ok(Math.abs(row.crossing.position.y)>=2.15&&row.launchSpeedMps<power.launchSpeedMps,JSON.stringify(row));
  if(row.profile==='chip')assert.ok(row.peakClearanceM>power.peakClearanceM+0.5&&row.crossing.timeS>power.crossing.timeS,JSON.stringify(row));
  if(row.profile==='curled')assert.ok(row.launchSpinRadS>=30&&row.maxLateralBendM>=0.20,JSON.stringify(row));
  if(row.profile!=='curled')assert.ok(row.maxLateralBendM<=0.12,JSON.stringify(row));
 }
 assert.throws(()=>createControlledActionLab(R,'pass-pair',{shotProfile:'tap-in'}),TypeError);
 assert.throws(()=>createControlledActionLab(R,'shot-solo',{shotProfile:'unknown'}),TypeError);
});

test('SHOT-03 tap-in uses all 30 mirrored close starts, authentic one-touch and no automatic goal',{timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 const {smallSidedSetup}=await import('../src/small-sided-lab-scenarios.mjs');
 const seen=new Set(),rows=[];
 for(let variantIndex=0;variantIndex<30;variantIndex++){
  const home=smallSidedSetup('shot-solo','home',INITIAL_PLAYERS,{variantIndex,tapInStart:true});
  const away=smallSidedSetup('shot-solo','away',INITIAL_PLAYERS,{variantIndex,tapInStart:true});
  assert.equal(home.ball.x,-away.ball.x);assert.equal(home.ball.y,away.ball.y);
  assert.ok(Math.hypot(52.5-home.ball.x,home.ball.y)<=6.05);
  seen.add(home.ball.x+'|'+home.ball.y);
  for(const side of ['home','away']){
   const lab=createControlledActionLab(R,'shot-solo',{shotSide:side,shotProfile:'tap-in',variantIndex});
   try{
    let frame=lab.snapshot(),count=0;
    assert.equal(frame.shotSoloAudit.attempted,false);
    assert.equal(frame.genuinePhysicalPlayerCount,1);
    assert.equal(frame.ball.velocity.x,0);
    const expected=side==='home'?home.ball:away.ball;
    assert.ok(Math.abs(frame.ball.position.x-expected.x)<1e-5);
    assert.ok(Math.abs(frame.ball.position.y-expected.y)<1e-5);
    for(let tick=0;tick<240;tick++){
     frame=lab.step();
     if(frame.action){count++;assert.equal(frame.action.labShotCalibration.profile,'tap-in');assert.deepEqual(frame.starts,[side+'-10']);}
     if(frame.shotSoloAudit.crossing)break;
    }
    const crossing=frame.shotSoloAudit.crossing;
    // A genuine grounded ball must remain supported across the FULL
    // goal line, even for slow oblique shots (reported V03 HOME/AWAY).
    // Retain the existing B05 height threshold and raw solver evidence.
    rows.push({side,variantIndex,count,...frame.shotSoloAudit,
     crossingCentreAboveGroundTolerance:crossing!==null&&crossing.position.z>=0.09});
   }finally{lab.dispose();}
  }
 }
 process.stdout.write('ME_628_TAP_IN '+JSON.stringify(rows)+'\n');
 assert.equal(seen.size,30);
 for(const row of rows){
  assert.equal(row.count,1,JSON.stringify(row));
  assert.ok(row.crossingCentreAboveGroundTolerance,JSON.stringify(row));
  assert.ok(row.crossing?.goal&&row.crossing.fullBallCrossed,JSON.stringify(row));
  assert.ok(Math.abs(Math.abs(row.crossing.position.x)-52.61)<1e-8,JSON.stringify(row));
  assert.ok(row.crossing.lateralErrorM<=0.05,JSON.stringify(row));
  assert.ok(Math.abs(row.aimY-row.launchPosition.y)<=1e-5,JSON.stringify(row));
  assert.ok(Math.abs(row.distanceM-(52.5-Math.abs(row.launchPosition.x)))<=1e-5,JSON.stringify(row));
  assert.equal(row.targetSelection.policy,'nearest-safe-goal-mouth');
  assert.equal(row.crossing.officialGoal,false);
  assert.ok(row.launchSpeedMps>=4.16&&row.launchSpeedMps<=9.73&&row.peakClearanceM<=0.12,JSON.stringify(row));
  const dx=52.5-Math.abs(row.launchPosition.x),dy=row.aimY-row.launchPosition.y;
  const expectedSpeed=Math.max(4.2,Math.min(9.7,4.0+0.90*Math.hypot(dx+0.11,dy)));
  assert.ok(Math.abs(row.launchSpeedMps-expectedSpeed)<=0.03,JSON.stringify(row));
  assert.ok(Math.abs(row.launchSpinRadS-row.launchSpeedMps/0.11)<=1.0,JSON.stringify(row));
 }
});

test('SHOT-03 canonical close-range starts do not relax manual or unrelated LAB input bounds',async()=>{
 const R=await initializeRapier(rapier);
 const {smallSidedSetup}=await import('../src/small-sided-lab-scenarios.mjs');
 for(const side of ['home','away']){
  const start=smallSidedSetup('shot-solo',side,INITIAL_PLAYERS,{tapInStart:true}).ball;
  assert.ok(Math.abs(start.x)>48);
  assert.throws(()=>normalizeScenario(start),/Invalid value for x/);
  assert.throws(()=>createEngine(R,start),/Invalid value for x/);
  const options={diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true,diagnosticLatestLabDynamics:true,
   diagnosticSmallSidedSituation:'shot-solo',diagnosticSmallSidedSide:side,
   diagnosticIsolatedShotProfile:'tap-in'};
  for(const patch of [{x:start.x+(side==='home'?0.1:-0.1)},{y:start.y+0.1},{vx:1},{seed:'not-canonical'}]){
   assert.throws(()=>createEngine(R,{...start,...patch},options),/canonical stationary close-range start/);
  }
  assert.throws(()=>createEngine(R,{...start,x:side==='home'?53:-53},options),/Invalid value for x/);
  assert.throws(()=>createEngine(R,start,{...options,diagnosticIsolatedShotProfile:'power'}),/Invalid value for x/);
 }
});

test('SHOT-04 safe goal-mouth ranking: nearest tap-in, varied corners, live defenders and vertical candidates',()=>{
 for(const side of [1,-1]){
  const target={targetX:side*52.5,targetY:0},ballRadiusM=0.11;
  for(const y of [-2.1,0,1.8,3.3]){
   const position={x:side*49,y,z:0.11};
   const a=selectLabShotTarget({target,position,ballRadiusM,profile:'tap-in'});
   assert.ok(Math.abs(a.targetY-Math.max(-2.85,Math.min(2.85,y)))<1e-8);
   assert.equal(a.targetCentreZM,ballRadiusM);
   assert.ok(a.postMarginM>=0.70-1e-8);
  }
  for(const profile of ['power','low','placed','chip','curled']){
   const aim=y=>selectLabShotTarget({target,position:{x:side*30,y,z:0.11},ballRadiusM,profile});
   const left=aim(-7),right=aim(7);
   assert.ok(left.targetY*right.targetY<0,profile);
   assert.ok(Math.abs(left.targetY)>=2&&Math.abs(right.targetY)>=2,profile);
   assert.ok(left.candidateCount>=5);
   assert.ok(left.postMarginM>=0.60&&left.barMarginM>=0.25);
  }
  const position={x:side*30,y:0,z:0.11};
  const positiveBlock={x:side*52,y:2.65,role:'goalkeeper'};
  const negativeBlock={x:side*52,y:-2.65,role:'goalkeeper'};
  const aim=opponents=>selectLabShotTarget({target,position,ballRadiusM,profile:'power',opponents});
  assert.ok(aim([positiveBlock]).targetY<0);
  assert.ok(aim([negativeBlock]).targetY>0);
  assert.ok(aim([positiveBlock]).laneClearanceM>=2.4);
  // No scoring probability or result is manufactured by ranking.
  assert.equal(aim([positiveBlock]).officialGoal,false);
 }
});

test('SHOT-05 first-time ground deliveries use real incoming momentum and one native strike',{timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 for(const profile of LAB_SHOT_PROFILES)for(const side of ['home','away']){
  const variants=profile==='tap-in'?Array.from({length:30},(_,i)=>i):[0,7,14,21,28,29];
  for(const variantIndex of variants){
   const lab=createControlledActionLab(R,'shot-solo',{shotSide:side,variantIndex,shotProfile:profile,firstTimeShot:true});
   try{
    let frame=lab.snapshot(),count=0,firstContactTick=null,prior=frame.ball;
    assert.equal(frame.shotSoloAudit.firstTimeShot,true);
    assert.equal(frame.shotSoloAudit.attempted,false);
    assert.equal(frame.genuinePhysicalPlayerCount,1);
    assert.ok(Math.hypot(prior.velocity.x,prior.velocity.y)>=3.99);
    for(let i=0;i<300;i++){
     frame=lab.step();
     if(frame.starts.includes(side+'-10'))firstContactTick??=frame.physicsTick;
     assert.equal(frame.officialMatchResult,null);
     assert.equal(frame.latestOrientedReception,null);
     if(frame.action){
      count++;
      assert.equal(frame.action.action,'shot');
      assert.equal(frame.physicsTick,firstContactTick,'must strike on first native contact');
      assert.deepEqual(frame.starts,[side+'-10']);
      assert.equal(frame.action.actualPhysicsImpulseApplied,true);
      const e=frame.action.firstTimeShotEvidence;
      assert.equal(e.nativeExclusiveShoeStart,true);
      assert.deepEqual(e.priorNativeBallVelocity,prior.velocity);
      assert.ok(Math.hypot(e.priorNativeBallVelocity.x,e.priorNativeBallVelocity.y)>2.5);
      assert.ok(Math.hypot(...Object.values(e.appliedImpulseNs))<=(profile==='tap-in'?6.5:13)+1e-8);
      for(const k of ['x','y','z'])assert.ok(Math.abs(
       e.postSolverVelocity[k]+e.appliedImpulseNs[k]/e.ballMassKg-e.postStrikeVelocity[k])<1e-4);
     }
     prior=frame.ball;
     if(frame.shotSoloAudit.crossing)break;
    }
    rows.push({side,variantIndex,count,firstContactTick,...frame.shotSoloAudit});
   }finally{lab.dispose();}
  }
 }
 process.stdout.write('ME_628_FIRST_TIME '+JSON.stringify(rows)+'\n');
 for(const row of rows){
  assert.equal(row.count,1,JSON.stringify(row));
  assert.ok(row.firstContactTick>1&&row.firstContactTick<=30,JSON.stringify(row));
  assert.equal(row.launchTick,row.firstContactTick);
  assert.ok(row.crossing?.fullBallCrossed,JSON.stringify(row));
  assert.equal(row.crossing.officialGoal,false);
  assert.ok((row.side==='home'?1:-1)*row.launchVelocity.x>0,JSON.stringify(row));
  assert.equal(row.postStrikeSamples.length,6,JSON.stringify(row));
  for(const [i,sample] of row.postStrikeSamples.entries()){
   assert.equal(sample.tick,row.launchTick+i+1);
   if(row.profile==='tap-in')assert.equal(sample.nativeShotRelease,null);
   else{
    const release=sample.nativeShotRelease;
    assert.equal(release.source,'native-shoe-recovery-v1');
    assert.equal(release.strikeTick,row.launchTick);
    assert.equal(release.actorId,row.shooterId);
    assert.equal(release.colliderRetained,true);
    assert.ok(release.speedMps<=7+1e-3,JSON.stringify(row));
   }
  }
  if(row.profile==='tap-in'){
   assert.ok(row.crossing.goal&&row.crossing.scoringTeam===row.side,JSON.stringify(row));
   assert.ok(row.peakClearanceM<=0.15&&row.crossing.lateralErrorM<=0.35,JSON.stringify(row));
   assert.ok(Math.abs(row.aimY-row.launchPosition.y)<1e-5,JSON.stringify(row));
  }
 }
 // No fake goal guarantee: bounded impulse may miss on a difficult arrival.
 // Nevertheless each profile must physically score from most easy empty-goal
 // samples. All actual misses remain observable in the reported matrix.
 for(const profile of LAB_SHOT_PROFILES){
  const subset=rows.filter(row=>row.profile===profile);
  assert.ok(subset.filter(row=>row.crossing?.goal).length>=Math.ceil(subset.length*0.75),profile+' '+JSON.stringify(subset));
 }
 assert.throws(()=>createControlledActionLab(R,'pass-pair',{firstTimeShot:true}),TypeError);
 assert.throws(()=>createControlledActionLab(R,'shot-solo',{firstTimeShot:'yes'}),TypeError);
});
