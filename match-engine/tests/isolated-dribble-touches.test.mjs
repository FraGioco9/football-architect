import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {smallSidedSetup} from '../src/small-sided-lab-scenarios.mjs';
import {chooseIsolatedDribbleTouch,chooseDirectedDribbleTouch,directedDribbleApproachTarget,planDribbleShield,observeDribbleShield,createDribbleShieldObserver,planDribbleDefender,chooseDribbleDefensiveTouch,createDribbleTransitionObserver,chooseDribbleRecoveryTouch,planDribbleTransitionTarget,planDribbleContactRelease,dribbleReleaseApproach,chooseSharedDuelTouch,resolveDuelActors,planDefensiveBallRelease,planDuelRecoveryApproach,routeDuelAroundOpponent,planDuelPostContactAlignment,observeEffectiveDuelIntervention,SLIDING_TACKLE_MAX_IMPULSE_NS,SLIDING_TACKLE_TARGET_SPEED_MPS,STANDING_TACKLE_TARGET_SPEED_MPS,isDuelGettingUp,SLIDING_GET_UP_TACKLER_TICKS,SLIDING_GET_UP_RIVAL_TICKS,planDuelShoulderApproach,observeNativeShoulderChallenge} from '../src/isolated-dribble-touches.mjs';
import {advanceD01LiveShoeGait,soloCarryTwoFootPositions}
 from '../src/rapier-foot-contact-bridge.mjs';
import {advanceSoloCarryPhase,soloCarryPhaseConfiguration}
 from '../src/solo-carry-phases.mjs';
test('#628 solo Carry phases use only genuine ball/player speed and gap with hysteresis',()=>{
 const control=advanceSoloCarryPhase({tick:1,
  playerSpeedMps:0,ballSpeedMps:0,ballGapM:0.55});
 assert.equal(control.phase,'control');
 const moderate=advanceSoloCarryPhase({tick:2,previousPhase:'control',
  playerSpeedMps:1.6,ballSpeedMps:1.3,ballGapM:0.52});
 assert.equal(moderate.phase,'moderate');
 const below=advanceSoloCarryPhase({tick:3,previousPhase:'moderate',
  playerSpeedMps:2.45,ballSpeedMps:2.3,ballGapM:0.50});
 assert.equal(below.phase,'moderate');
 const sprint=advanceSoloCarryPhase({tick:4,previousPhase:'moderate',
  playerSpeedMps:2.7,ballSpeedMps:2.6,ballGapM:0.56});
 assert.equal(sprint.phase,'sprint');
 const retained=advanceSoloCarryPhase({tick:5,previousPhase:'sprint',
  playerSpeedMps:2.65,ballSpeedMps:2.1,ballGapM:0.48});
 assert.equal(retained.phase,'sprint');
 const decel=advanceSoloCarryPhase({tick:6,previousPhase:'sprint',
  playerSpeedMps:2.2,ballSpeedMps:1.9,ballGapM:0.38});
 assert.equal(decel.phase,'moderate');
 const regain=advanceSoloCarryPhase({tick:7,previousPhase:'moderate',
  playerSpeedMps:1,ballSpeedMps:0.45,ballGapM:0.35});
 assert.equal(regain.phase,'control');
 assert.ok(soloCarryPhaseConfiguration('sprint').maxSpeedMps>
  soloCarryPhaseConfiguration('moderate').maxSpeedMps);
 assert.ok(soloCarryPhaseConfiguration('control').maxSpeedMps<
  soloCarryPhaseConfiguration('moderate').maxSpeedMps);
 assert.ok(soloCarryPhaseConfiguration('sprint').shoeFrequencyBaseHz<
  soloCarryPhaseConfiguration('moderate').shoeFrequencyBaseHz);
 assert.throws(()=>advanceSoloCarryPhase({tick:1,
  playerSpeedMps:0,ballSpeedMps:1,ballGapM:-1}),TypeError);
 assert.throws(()=>soloCarryPhaseConfiguration('future'),TypeError);
 assert.deepEqual(sprint,advanceSoloCarryPhase({tick:4,
  previousPhase:'moderate',playerSpeedMps:2.7,ballSpeedMps:2.6,ballGapM:0.56}));
 assert.equal(sprint.nativeShoeEventCreated,false);
 assert.equal(sprint.ballImpulseCreated,false);
 assert.equal(sprint.officialPossession,false);
 const source={phaseRad:0,tick:4,
  player:{x:29.45,y:0,vx:3,vy:0,facingRad:0},
  ball:{position:{x:30,y:0,z:0.11},
   velocity:{x:2.6,y:0,z:0}}};
 const foot=advanceD01LiveShoeGait({...source,solo:true,carryPhase:'sprint'});
 assert.equal(foot.carryPhase,'sprint');
 assert.ok(foot.frequencyHz<advanceD01LiveShoeGait({...source,
  solo:true,carryPhase:'moderate'}).frequencyHz);
 assert.ok(foot.nativeShoeEventCreated===false&&foot.ballImpulseCreated===false);
});
test('#628 D01-GAIT-01 pure live player/ball foot target is mirrored, bounded and speed-coupled',()=>{
 const source={phaseRad:0,tick:1,
  player:{x:29.42,y:0.08,vx:2,vy:0,facingRad:0},
  ball:{position:{x:30,y:0,z:0.11},
   velocity:{x:1.8,y:0,z:0}}};
 const a=advanceD01LiveShoeGait(source);
 assert.deepEqual(a,advanceD01LiveShoeGait(source));
 assert.ok(a.frequencyHz>2.45&&a.frequencyHz<2.7);
 assert.ok(a.forwardM>=-0.106&&a.forwardM<=0.161);
 assert.ok(Math.abs(a.sideM)<=0.03);
 assert.equal(a.nativeShoeEventCreated,false);
 assert.equal(a.ballImpulseCreated,false);
 assert.equal(a.possessionAssigned,false);
 const mirrored=advanceD01LiveShoeGait({...source,
  player:{x:-29.42,y:0.08,vx:-2,vy:0,facingRad:Math.PI},
  ball:{position:{x:-30,y:0,z:0.11},velocity:{x:-1.8,y:0,z:0}}});
 assert.ok(Math.abs(a.forwardM-mirrored.forwardM)<1e-12);
 assert.ok(Math.abs(a.frequencyHz-mirrored.frequencyHz)<1e-12);
 const slow=advanceD01LiveShoeGait({...source,
  player:{...source.player,vx:0}});
 const fast=advanceD01LiveShoeGait({...source,
  player:{...source.player,vx:4}});
 assert.ok(slow.frequencyHz<fast.frequencyHz);
 const far=advanceD01LiveShoeGait({...source,phaseRad:Math.PI-0.27,
  ball:{...source.ball,position:{x:30.5,y:0,z:0.11}}});
 const close=advanceD01LiveShoeGait({...source,phaseRad:Math.PI-0.27,
  ball:{...source.ball,position:{x:29.75,y:0,z:0.11}}});
 assert.ok(far.forwardM>close.forwardM,'live long-ball gap can extend forward foot only');
 assert.throws(()=>advanceD01LiveShoeGait({...source,ball:null}),TypeError);
});
test('#628 1v1 pure varied native-ground-touch intent is reproducible and mirrored',()=>{
 const b={x:30,y:2},d={team:'away',x:33,y:1};
 const params={variantIndex:7,tick:10,attackingSide:'home',ballPosition:b,
  ballVelocity:{x:1.2,y:0.1},defender:d};
 const a=chooseIsolatedDribbleTouch(params);
 assert.deepEqual(a,chooseIsolatedDribbleTouch(params));
 const mirror=chooseIsolatedDribbleTouch({...params,attackingSide:'away',
  ballPosition:{x:-30,y:2},ballVelocity:{x:-1.2,y:0.1},
  defender:{team:'home',x:-33,y:1}});
 assert.equal(a.dx,-mirror.dx);assert.equal(a.dy,mirror.dy);
 assert.equal(a.magnitudeNs,mirror.magnitudeNs);
 assert.notEqual(a.magnitudeNs,chooseIsolatedDribbleTouch({...params,variantIndex:9}).magnitudeNs);
 assert.ok(a.magnitudeNs>=chooseIsolatedDribbleTouch({...params,
  ballVelocity:{x:2.9,y:0}}).magnitudeNs,
  'Higher measured forward velocity must not trigger a harder touch');
 assert.throws(()=>chooseIsolatedDribbleTouch({...params,ballVelocity:undefined}),TypeError);
 assert.ok(a.magnitudeNs>=0.095&&a.magnitudeNs<=0.17);
 assert.equal(a.officialPossession,false);assert.equal(a.verifiedSecondTouch,false);
 assert.equal(chooseIsolatedDribbleTouch({...params,variantIndex:0}).magnitudeNs,0.12);
 assert.throws(()=>chooseIsolatedDribbleTouch({...params,variantIndex:30}),TypeError);
});
test('#628 every variant stages the attacker behind the original ball, not overlapping its shoe',()=>{
 for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
  const scenario=smallSidedSetup('dribble-1v1',side,INITIAL_PLAYERS,{variantIndex});
  const forward=side==='home'?1:-1;
  const player=scenario.staged.find(p=>p.id===side+'-10');
  const gap=forward*(scenario.ball.x-player.x);
  assert.ok(gap>=0.499&&gap<=0.671,
   'V'+(variantIndex+1)+' '+side+' starts the original player safely behind the ball');
  assert.ok(Math.hypot(scenario.ball.x-player.x,scenario.ball.y-player.y)>=0.499);
 }
});
test('#628 genuine lateral variation is smooth in time under stable physical pressure',()=>{
 const ballPosition={x:30,y:0},defender={team:'away',x:32,y:1.5},
  ballVelocity={x:1,y:0};
 for(let variantIndex=1;variantIndex<30;variantIndex++)
 for(let tick=1;tick<=179;tick++){
  const args={variantIndex,tick,attackingSide:'home',ballPosition,ballVelocity,defender};
  const current=chooseIsolatedDribbleTouch(args);
  const next=chooseIsolatedDribbleTouch({...args,tick:tick+1});
  assert.ok(Math.abs(current.lateralRatio-next.lateralRatio)<=0.081,
   'No random per-tick zig-zag in real D-01 touch intent');
 }
});
test('#628 actual 1v1 native source: only attacker physical carry, 2 colliders, both sides and Bodies A/B',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),magnitudes=new Set();
 for(const side of ['home','away'])for(const variantIndex of [0,1,9,21]){
  const enemy=side==='home'?'away':'home';
  const setup=smallSidedSetup('dribble-1v1',side,INITIAL_PLAYERS,{variantIndex});
  assert.deepEqual([...setup.activeIds].sort(),[side+'-10',enemy+'-2'].sort());
  for(const bodyGuardEnabled of [false,true]){
   const lab=createControlledActionLab(R,'dribble-1v1',{shotSide:side,variantIndex,bodyGuardEnabled});
   try{
    assert.equal(lab.snapshot().genuinePhysicalPlayerCount,2);
    let touched=0;
    for(let tick=1;tick<=90;tick++){
     const frame=lab.step();
     assert.equal(frame.officialMatchResult,null);
     assert.equal(frame.officialMatchPossession,false);
     assert.ok(frame.starts.every(id=>setup.activeIds.includes(id)));
     if(frame.action){
      touched++;
      assert.equal(frame.action.action,'carry');
      assert.equal(frame.action.playerId,side+'-10');
      assert.deepEqual(frame.starts,[side+'-10']);
      assert.equal(frame.action.appliedByRapier,true);
      assert.equal(frame.action.actualPhysicsImpulseApplied,true);
      assert.equal(frame.action.officialMatchAction,false);
      const touch=frame.action.decisionContext.isolatedDribbleTouch;
      assert.equal(touch?.tick,tick);assert.equal(touch?.variantIndex,variantIndex);
      assert.equal(touch?.verifiedDribble,false);
      assert.ok(touch?.magnitudeNs>=0.095&&touch?.magnitudeNs<=0.17);
      magnitudes.add(touch.magnitudeNs.toFixed(6));
     }
     if(frame.refereeEvidence?.lastEvent)break;
    }
    assert.ok(touched>=1,'Native attacker shoe must touch '+side+' V'+variantIndex);
   }finally{lab.dispose();}
  }
 }
 assert.ok(magnitudes.size>=4,'real Rapier impulses should vary');
});


test('#628 D01-GAIT diagnosis: speed peaks carry native Rapier source witnesses only',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),out=[];
 for(const side of ['home','away'])for(const variantIndex of [0,12,20,23]){
  const lab=createControlledActionLab(R,'dribble-1v1',{
   shotSide:side,variantIndex,bodyGuardEnabled:true
  });
  try{
   for(let tick=1;tick<=180;tick++){
    const frame=lab.step(),a=frame.nativeDribbleAudit;
    assert.equal(a.tick,frame.physicsTick);
    if(!a.peakBallSpeedWitness)continue; // grounded ball may be stationary before first genuine touch
    assert.equal(a.peakBallSpeedWitness.readOnly,true);
    assert.equal(a.peakBallSpeedWitness?.causalAttribution,false);
    assert.ok(Math.abs(a.peakBallSpeedWitness.ballSpeedMps-
     a.peakBallSpeedMps)<1e-8);
    assert.ok(a.peakBallSpeedWitness.tick<=frame.physicsTick);
    assert.equal(a.peakBallSpeedWitness.source,
     'original-post-step-rapier-ball-velocity');
    assert.ok(a.peakBallSpeedWitness.authenticShoeStarts.every(id=>
     [side+'-10',(side==='home'?'away':'home')+'-2'].includes(id)));
    assert.ok(a.peakBallSpeedWitness.nativeLegBallContacts>=0);
    assert.ok(a.peakBallSpeedWitness.nativeTorsoPairs>=0);
    if(frame.refereeEvidence?.lastEvent)break;
   }
   const w=lab.snapshot().nativeDribbleAudit.peakBallSpeedWitness;
   out.push({side,variantIndex,peakMps:+w.ballSpeedMps.toFixed(4),
    tick:w.tick,attackerGapM:+w.attackerGapM.toFixed(3),
    defenderGapM:+w.defenderGapM.toFixed(3),
    starts:w.authenticShoeStarts,active:w.authenticShoeActive,
    legBall:w.nativeLegBallContacts,torsoPairs:w.nativeTorsoPairs,
    carry:w.appliedRealCarryThisTick});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_D01_SOURCE_SPEED_WITNESSES '+JSON.stringify(out)+'\\n');
});

test('#628 D-01 all 30 real 60Hz variants HOME/AWAY Bodies ON/OFF source-only measured distribution',
 {timeout:240000},async()=>{
 const R=await initializeRapier(rapier);
 const samples=[],replays=new Map();
 for(const side of ['home','away'])for(const bodyGuardEnabled of [false,true])
 for(let variantIndex=0;variantIndex<30;variantIndex++){
  const options={shotSide:side,bodyGuardEnabled,variantIndex};
  const lab=createControlledActionLab(R,'dribble-1v1',options);
  let result;
  try{
   for(let tick=1;tick<=180;tick++){
    const frame=lab.step();
    assert.equal(frame.physicsTick,tick);
    assert.equal(frame.nativeDribbleAudit?.tick,tick);
    assert.equal(frame.nativeDribbleAudit?.officialPossession,false);
    assert.equal(frame.nativeDribbleAudit?.dribbleCompleted,false);
    assert.equal(frame.nativeDribbleAudit?.ballProtectionProven,false);
    assert.ok(frame.nativeDribbleAudit.minimumCanonicalSeparationM>=0.98-1e-5);
    assert.ok(frame.nativeDribbleAudit.maximumObservedCanonicalPlayerSpeedMps<=7+1e-5);
    if(frame.refereeEvidence?.lastEvent)break;
   }
   const f=lab.snapshot();result={side,bodyGuardEnabled,variantIndex,
    ticks:f.physicsTick,actionCount:f.nativeDribbleAudit.appliedCarryActions,
    shoeStarts:f.nativeDribbleAudit.attackerShoeStarts,
    shoeEnds:f.nativeDribbleAudit.attackerShoeEnds,
    recontacts:f.nativeDribbleAudit.independentRecontacts,
    defenderStarts:f.nativeDribbleAudit.defenderShoeStarts,
    impulse:f.nativeDribbleAudit.realImpulseMagnitudesNs,
    direction:f.nativeDribbleAudit.actualImpulseDirectionRad,
    pathM:+f.nativeDribbleAudit.ballPath2DM.toFixed(4),
    forwardM:+f.nativeDribbleAudit.ballForwardDistanceM.toFixed(4),
    pressureTicks:f.nativeDribbleAudit.measuredPressureTicks,
    bodyBallTicks:f.nativeDribbleAudit.nativeBodyBallContactTicks,
    torsoTicks:f.nativeDribbleAudit.nativeOpposingTorsoContactTicks,
    peakClearanceM:+f.nativeDribbleAudit.peakGroundClearanceM.toFixed(5),
    airFrames:f.nativeDribbleAudit.airborneFramesAbove2Cm,
    peakBallSpeedMps:+f.nativeDribbleAudit.peakBallSpeedMps.toFixed(4),
    meanTouchIntervalTicks:f.nativeDribbleAudit.meanAppliedTouchIntervalTicks,
    meanAttackerBallGapM:+f.nativeDribbleAudit.averageRealAttackerBallGapM.toFixed(4),
    maxAttackerBallGapM:+f.nativeDribbleAudit.maximumRealAttackerBallGapM.toFixed(4)};
   // Genuine native absence is a measured failed trial, not a forced touch.
   assert.ok(result.actionCount>=0);
   assert.equal(result.impulse.length,result.actionCount);
   assert.ok(result.impulse.every(n=>n>=0.094&&n<=0.171));
   if(variantIndex===0)assert.ok(result.impulse.every(n=>Math.abs(n-0.12)<0.0001));
   samples.push(result);
  }finally{lab.dispose();}
  if(bodyGuardEnabled&&[0,7,17,29].includes(variantIndex)){
   const second=createControlledActionLab(R,'dribble-1v1',options);
   try{
    for(let t=0;t<result.ticks;t++)second.step();
    const a=second.snapshot().nativeDribbleAudit;
    assert.deepEqual(a.realImpulseMagnitudesNs,result.impulse);
    assert.deepEqual(a.actualImpulseDirectionRad,result.direction);
    assert.equal(+a.ballPath2DM.toFixed(4),result.pathM);
    assert.equal(a.independentRecontacts,result.recontacts);
    replays.set(side+'-'+variantIndex,true);
   }finally{second.dispose();}
  }
 }
 assert.equal(samples.length,120);
 assert.equal(replays.size,8);
 const summary={
  trials:samples.length,exactReplayPairs:replays.size,
  withRealCarry:samples.filter(s=>s.actionCount>0).length,
  noRealCarry:samples.filter(s=>s.actionCount===0).length,
  withSecondAction:samples.filter(s=>s.actionCount>1).length,
  withNativeRecontact:samples.filter(s=>s.recontacts>0).length,
  withDefenderShoeStart:samples.filter(s=>s.defenderStarts>0).length,
  withOpposingTorso:samples.filter(s=>s.torsoTicks>0).length,
  withBodyBall:samples.filter(s=>s.bodyBallTicks>0).length,
  distinctImpulseNs:new Set(samples.flatMap(s=>s.impulse.map(x=>x.toFixed(4)))).size,
  distinctPathM:new Set(samples.map(s=>s.pathM.toFixed(2))).size,
  maxActions:Math.max(...samples.map(s=>s.actionCount)),
  maxRecontacts:Math.max(...samples.map(s=>s.recontacts)),
  maximumGroundClearanceM:Math.max(...samples.map(s=>s.peakClearanceM)),
  samplesWithAirFrames:samples.filter(s=>s.airFrames>0).length,
  maximumBallSpeedMps:Math.max(...samples.map(s=>s.peakBallSpeedMps)),
  withFourOrMoreTouches:samples.filter(s=>s.actionCount>=4).length,
  meanTouchesPerTrial:samples.reduce((n,s)=>n+s.actionCount,0)/samples.length,
  meanTouchIntervalTicks:samples.filter(s=>s.meanTouchIntervalTicks!==null)
   .reduce((n,s,_,a)=>n+s.meanTouchIntervalTicks/a.length,0),
  minPressureTicks:Math.min(...samples.map(s=>s.pressureTicks)),
  maxPressureTicks:Math.max(...samples.map(s=>s.pressureTicks)),
  weakSamples:samples.filter(s=>s.actionCount<2||s.forwardM<-1)
   .map(({side,bodyGuardEnabled,variantIndex,actionCount,shoeStarts,
    shoeEnds,recontacts,forwardM,pathM,pressureTicks})=>({side,bodyGuardEnabled,
    variantIndex,actionCount,shoeStarts,shoeEnds,recontacts,forwardM,pathM,pressureTicks})),
  reverseTravels:samples.filter(s=>s.forwardM<0).length,
  meanAttackerBallGapM:+(samples.reduce((n,s)=>n+s.meanAttackerBallGapM,0)/
   samples.length).toFixed(4),
  maximumAttackerBallGapM:Math.max(...samples.map(s=>s.maxAttackerBallGapM)),
  sample:samples.filter(s=>[0,7,17,29].includes(s.variantIndex)),
  largestVertical:samples.toSorted((a,b)=>b.peakClearanceM-a.peakClearanceM).slice(0,8),
  fastestBall:samples.toSorted((a,b)=>b.peakBallSpeedMps-a.peakBallSpeedMps).slice(0,8)
 };
 process.stdout.write('ME_628_D01_REAL_120_TRIAL_MATRIX '+JSON.stringify(summary)+'\\n');
 assert.ok(summary.withRealCarry>=16,'measured physical carries must exist across seeds');
 assert.ok(summary.distinctImpulseNs>=8,'physical impulse must vary across actual shoe starts');
 assert.ok(summary.distinctPathM>=8,'actual Rapier ball paths must vary across seeds');
 // Realism acceptance gates from direct LAB visual feedback: low, close,
 // frequent short native touches, NOT success/possession declarations.
 assert.ok(summary.maximumGroundClearanceM<=0.015,
  'D-01 grounded source must not visibly loft the real ball');
 assert.equal(summary.samplesWithAirFrames,0,
  'D-01 must have no samples more than 2 cm off the grass');
 assert.ok(summary.maximumBallSpeedMps<=3.5,
  'D-01 ground carries must not fire the ball away');
 assert.ok(summary.withRealCarry>=100,'at least 100 genuine source carries');
 assert.ok(summary.withSecondAction>=80,'at least 80 real repeat-touch trials');
 assert.ok(summary.withFourOrMoreTouches>=20,'repeat touches must be frequent');
 assert.ok(summary.meanTouchesPerTrial>=4.0,'repeatable ground-control frequency must not regress');
 assert.equal(summary.noRealCarry,0,'every seed must produce a real shoe-triggered carry');
 assert.equal(summary.reverseTravels,0,'no negative total forward ball travel in D-01');
 assert.ok(summary.withSecondAction>=100,'repeat real carries in almost all trials');
 assert.ok(summary.withFourOrMoreTouches>=75,'many 4+ touch samples, not only V01');
 assert.ok(summary.withDefenderShoeStart>=5,'at least five actual defender interventions');
 assert.ok(summary.withOpposingTorso>=20,'native player pressure must remain observable');
 // The D-01 torso now fits within the canonical 0.98m player gap instead
 // of producing 0.04m of unavoidable overlap. The resulting decrease in
 // secondary leg-ball collisions is EXPECTED, not a disabled collider.
 // Retain a minimum nonzero, repeatable native-body-contact evidence gate.
 assert.ok(summary.withBodyBall>=10,
  'native grounded lower-leg-ball contacts must remain possible after clearance correction');
 const baseline=samples.filter(s=>s.variantIndex===0);
 assert.equal(baseline.length,4);
 assert.ok(baseline.every(s=>s.actionCount>=5&&s.recontacts>=4&&
    s.forwardM>4&&s.peakClearanceM===0&&s.peakBallSpeedMps<3.5),
   'V01 HOME/AWAY Bodies ON/OFF must dribble forward on the grass with true recontacts');
});

test('#628 solo-only actual-speed shoe cadence reduces low-pace stepping without modifying D-01',()=>{
 const source={phaseRad:0,tick:1,player:{
  x:29.45,y:0,vx:1.8,vy:0,facingRad:0
 },ball:{position:{x:30,y:0,z:0.11},
  velocity:{x:1.5,y:0,z:0}}};
 const duel=advanceD01LiveShoeGait(source),solo=advanceD01LiveShoeGait({...source,solo:true});
 assert.ok(duel.frequencyHz>2.4&&duel.frequencyHz<2.7);
 assert.ok(solo.frequencyHz>1.35&&solo.frequencyHz<1.7);
 assert.ok(solo.frequencyHz<duel.frequencyHz);
 assert.ok(Math.abs(solo.forwardM)<Math.abs(duel.forwardM));
 assert.equal(solo.ballImpulseCreated,false);
 assert.equal(solo.nativeShoeEventCreated,false);
 const high=advanceD01LiveShoeGait({...source,solo:true,player:{...source.player,vx:4}});
 assert.ok(high.frequencyHz>solo.frequencyHz);
});

test('#628 solo Carry physical intensity scales original real touch without velocity clamps',()=>{
 const params={variantIndex:0,tick:20,attackingSide:'home',
  ballPosition:{x:30,y:0},ballVelocity:{x:1,y:0}};
 const solo=chooseIsolatedDribbleTouch({...params,solo:true});
 const duel=chooseIsolatedDribbleTouch({...params,defender:{team:'away',x:34,y:1}});
 assert.equal(solo.soloCarry,true);
 assert.equal(solo.fromLiveOpponent,false);
 assert.equal(solo.magnitudeNs,duel.magnitudeNs*0.44);
 assert.equal(solo.fromLiveBallVelocity,true);
 assert.equal(solo.genuineRapierShoeStartRequired,true);
 assert.throws(()=>chooseIsolatedDribbleTouch({...params,solo:true,defender:{team:'away',x:33,y:0}}),TypeError);
});

test('#628 solo physical foot targets oppose stride without creating contacts',()=>{
 const p={x:29.45,y:0,facingRad:0,vx:2,vy:0};
 const b={position:{x:30,y:0,z:0.11},velocity:{x:1.6,y:0,z:0}};
 const gait=advanceD01LiveShoeGait({
  phaseRad:0,tick:1,player:p,ball:b,solo:true,carryPhase:'moderate'});
 const a=soloCarryTwoFootPositions(p,gait);
 assert.equal(a.realContactsOnly,true);
 assert.equal(a.physicsImposed,false);
 assert.ok(a.left.y>a.right.y);
 assert.ok(a.left.y-a.right.y>=0.14,
  'Real lateral shoe tracks must not collapse into one overlapping shoe');
 assert.ok(a.left.x<a.right.x,'At this phase right foot advances while left recovers');
 const next=soloCarryTwoFootPositions(p,{...gait,phaseRad:Math.PI,
  forwardM:0.075,sideM:0});
 assert.ok(next.left.x>next.right.x,
  'Opposite half stride makes left shoe overtake right foot');
 const away=soloCarryTwoFootPositions({...p,x:-p.x,facingRad:Math.PI},
  {...gait,observedAheadM:gait.observedAheadM});
 assert.ok(away.left.x>away.right.x,'Mirrored local foot order rotates with player facing');
 assert.throws(()=>soloCarryTwoFootPositions(null),TypeError);
 assert.throws(()=>soloCarryTwoFootPositions(p,{phaseRad:NaN}),TypeError);
});

test('#628 solo two real Rapier colliders: exclusive per-foot actions only',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 const samples=[];
 for(const side of ['home','away'])for(const variantIndex of [0,3]){
  const lab=createControlledActionLab(R,'carry-solo',{
   shotSide:side,variantIndex,bodyGuardEnabled:true});
  let nativeFootStarts=0,actions=0;
  const footNames=new Set();
  try{
   for(let tick=1;tick<=180;tick++){
    const f=lab.step(),shoes=f.soloNativeFeet;
    assert.equal(f.physicsTick,tick);
    assert.equal(f.genuinePhysicalPlayerCount,1);
    assert.equal(shoes?.source,'rapier-physical-collider-events');
    assert.equal(shoes.independentColliders,2);
    const dyn=shoes.dynamics;
    assert.equal(dyn?.source,'native-rapier-world-step-before-carry-action');
    assert.equal(dyn.tick,tick);
    assert.equal(dyn.causalAttribution,false);
    assert.equal(dyn.readOnly,true);
    assert.ok(Object.isFrozen(dyn)&&Object.isFrozen(dyn.feet));
    const dv=dyn.worldStepBallVelocityDeltaMps;
    assert.ok(Math.abs(Math.hypot(dv.x,dv.y,dv.z)-dv.magnitude)<1e-9);
    for(const footSide of ['left','right']){
     const source=dyn.feet[footSide];
     assert.equal(source.started,shoes.started.includes(footSide));
     assert.equal(source.active,shoes.active.includes(footSide));
     assert.ok(Object.isFrozen(source));
     assert.ok(Number.isFinite(source.totalReportedForceMagnitudeN));
     assert.ok(Number.isInteger(source.nativeForceEventCount));
     assert.ok(Number.isInteger(source.solverContacts));
     assert.ok(Number.isInteger(source.geometricContacts));
    }
    assert.deepEqual(shoes.active,
     ['left','right'].filter(name=>shoes.active.includes(name)));
    assert.equal(shoes.exclusivePhysicalStart,
     shoes.started.length===1&&shoes.active.length===1);
    nativeFootStarts+=shoes.started.length;
    for(const name of shoes.started)footNames.add(name);
    if(f.action?.action==='carry'){
     actions++;
     assert.equal(shoes.exclusivePhysicalStart,true);
     assert.equal(f.action.appliedByRapier,true);
     assert.equal(f.action.actualPhysicsImpulseApplied,true);
     assert.equal(f.action.playerId,side+'-10');
     assert.ok(f.starts.includes(side+'-10'));
    }
    assert.ok(f.nativeDribbleAudit.peakGroundClearanceM<=0.015);
    assert.equal(f.nativeDribbleAudit.airborneFramesAbove2Cm,0);
    assert.ok(f.nativeDribbleAudit.peakBallSpeedMps<=3.5);
   }
   const evidence=lab.snapshot().nativeDribbleAudit;
   assert.equal(evidence.nativePhysicalShoeColliders,2);
   assert.equal(evidence.realActionFeet.length,actions);
   assert.equal(evidence.nativeLeftFootStarts+
    evidence.nativeRightFootStarts,nativeFootStarts);
   assert.equal(evidence.nativePhysicalShoeStarts,nativeFootStarts);
   assert.equal(evidence.nativeShoeStartsWithoutCarryImpulse,
    nativeFootStarts-actions,
    'Real physical START events must reconcile with genuine applied Carry');
   assert.ok(evidence.nativeLeftShoeContactTicks>0);
   assert.ok(evidence.nativeRightShoeContactTicks>0);
   assert.ok(evidence.recentNativeShoeStarts.length<=16);
   assert.ok(evidence.recentNativeShoeStarts.every(x=>
    x.nativeStart&&['left','right'].includes(x.foot)&&
    typeof x.appliedCarryImpulse==='boolean'&&
    typeof x.nativeActorStart==='boolean'&&
    ['control','moderate','sprint'].includes(x.observedCarryPhase)&&
    ['simultaneousFootStarts','otherFootAlreadyActive',
     'exclusiveActorStartNoImpulse','unreleasedSingleFootStart',
     'native-exclusive-actor-carry'].includes(x.classification)&&
    Object.isFrozen(x.priorShoeActive)&&
    Object.isFrozen(x.nativeShoeEnds)&&
    Object.isFrozen(x.nativeShoeStarts)&&
    (x.classification!=='unreleasedSingleFootStart'?
     x.unreleasedHandoffKind===null:
     ['oppositeFootEndStartSameTick','sameFootEndRestartSameTick',
      'multipleFootEndStartSameTick',
      'startWithoutMatchingSameTickEnd'].includes(x.unreleasedHandoffKind))&&
    typeof x.concurrentOtherShoe==='boolean'&&
    Number.isFinite(x.worldStepBallVelocityDeltaMps)&&
    Number.isFinite(x.peakReportedForceMagnitudeN)&&
    x.causalAttribution===false));
   assert.ok(evidence.nonActionStartsWithNativeForceEvents>=0&&
    evidence.nonActionStartsWithNativeForceEvents<=
     evidence.nativeShoeStartsWithoutCarryImpulse);
   assert.ok(evidence.nonActionStartsWithSolverContacts>=0&&
    evidence.nonActionStartsWithSolverContacts<=
     evidence.nativeShoeStartsWithoutCarryImpulse);
   if(evidence.peakNonActionWorldStepBallDeltaWitness){
    assert.equal(evidence.peakNonActionWorldStepBallDeltaWitness.causalAttribution,false);
    assert.equal(evidence.peakNonActionWorldStepBallDeltaWitness.worldStepBallVelocityDeltaMps,
     evidence.peakNonActionWorldStepBallDeltaMps);
   }
   const reasons=evidence.nonActionStartReasons;
   const totalNonAction=Object.values(reasons).reduce((n,x)=>n+x,0);
   assert.equal(totalNonAction,evidence.nativeShoeStartsWithoutCarryImpulse);
   assert.ok(Object.isFrozen(reasons));
   const handoffs=evidence.unreleasedSingleFootEndStartKinds;
   assert.ok(Object.isFrozen(handoffs));
   assert.equal(Object.values(handoffs).reduce((n,x)=>n+x,0),
    reasons.unreleasedSingleFootStart,
    'Every unreleased native shoe START has exactly one event arrangement');
   assert.ok(evidence.recentUnreleasedSingleFootEvents.length<=16);
   for(const ev of evidence.recentUnreleasedSingleFootEvents){
    assert.equal(ev.originalRapierEvent,true);
    assert.equal(ev.causalAttribution,false);
    assert.equal(ev.subTickOrderingKnown,false);
    assert.ok(Object.isFrozen(ev.priorActive));
    assert.ok(Object.isFrozen(ev.nativeEnds));
    assert.ok(Object.isFrozen(ev.nativeStarts));
    assert.ok(Object.isFrozen(ev.afterActive));
    assert.ok(ev.nativeStarts.includes(ev.foot));
    assert.ok(Number.isInteger(ev.solverContacts));
    assert.ok(Number.isInteger(ev.nativeForceEventCount));
    assert.equal(handoffs[ev.kind]>=1,true);
    if(ev.kind==='oppositeFootEndStartSameTick'){
     const other=ev.foot==='left'?'right':'left';
     assert.ok(ev.priorActive.includes(other));
     assert.ok(ev.nativeEnds.includes(other));
     assert.ok(!ev.priorActive.includes(ev.foot));
    }
   }
   assert.ok(evidence.nativeActorContactOnsets>=actions);
   assert.ok(evidence.nativeActorContactOnsets<=nativeFootStarts);
   assert.ok(evidence.nativeActorFullReleaseEvents<=
    evidence.nativeActorContactOnsets);
   assert.ok(evidence.nativeActorStartsAfterFullRelease<=
    evidence.nativeActorFullReleaseEvents);
   assert.ok(evidence.recentFullReleaseToActorStartGaps.length<=16);
   assert.ok(evidence.recentFullReleaseToActorStartGaps.every(x=>
    x.startTick>x.releaseTick&&x.emptyToActorStartGapTicks>0));
   const phaseCounts=['control','moderate','sprint'].map(phase=>{
    const r=evidence.nonActionReasonsByPhase[phase];
    const starts=evidence.nativeStartsByPhase[phase];
    assert.ok(Object.isFrozen(r)&&Object.isFrozen(starts));
    assert.equal(Object.values(r).reduce((n,x)=>n+x,0),
     starts.withoutCarry);
    assert.equal(starts.nativeShoeStarts,
     starts.appliedCarry+starts.withoutCarry);
    assert.equal(Object.values(evidence.unreleasedHandoffKindsByPhase[phase])
     .reduce((n,x)=>n+x,0),r.unreleasedSingleFootStart);
    return starts;
   });
   assert.equal(phaseCounts.reduce((n,x)=>n+x.nativeShoeStarts,0),
    nativeFootStarts);
   assert.equal(phaseCounts.reduce((n,x)=>n+x.appliedCarry,0),actions);
   assert.ok(evidence.verifiedFootAlternations<=Math.max(0,actions-1));
   assert.ok(nativeFootStarts>=actions);
   samples.push({side,variantIndex,nativeFootStarts,actions,
    physicalFeet:[...footNames],realActionFeet:evidence.realActionFeet,
    verifiedFootAlternations:evidence.verifiedFootAlternations,
    peakBallSpeedMps:evidence.peakBallSpeedMps,
    peakGroundClearanceM:evidence.peakGroundClearanceM});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_SOLO_TWO_REAL_FEET '+
  JSON.stringify(samples)+'\\n');
});

test('#628 running steps separate from real Carry touches using live Rapier relative speed',()=>{
 const p={x:29.45,y:0,vx:2.8,vy:0,facingRad:0};
 const makeGait=(ballSpeed,phase='sprint',x=29.92)=>
  advanceD01LiveShoeGait({phaseRad:0,tick:1,player:p,
   ball:{position:{x,y:0,z:0.11},velocity:{x:ballSpeed,y:0,z:0}},
   solo:true,carryPhase:phase});
 const running=makeGait(3.1),catching=makeGait(1.2);
 const open=soloCarryTwoFootPositions(p,running);
 const recover=soloCarryTwoFootPositions(p,catching);
 assert.ok(running.observedBallForwardMps>running.observedPlayerForwardMps);
 assert.ok(open.left.y>recover.left.y+0.025);
 assert.ok(open.right.y<recover.right.y-0.025,
  'open sprint moves both actual foot tracks AROUND the rolling ball');
 const tight=soloCarryTwoFootPositions(p,makeGait(3.1,'sprint',29.79));
 assert.ok(tight.left.y<open.left.y-0.025,
  'actual short runner-ball gap narrows both tracks for a real contact');
 const controlOpen=soloCarryTwoFootPositions(p,makeGait(3.1,'control'));
 const controlSlow=soloCarryTwoFootPositions(p,makeGait(1.2,'control'));
 assert.equal(controlOpen.left.y,controlSlow.left.y,
  'close control does not dodge the ball based on speed');
 const away={...p,x:-p.x,vx:-p.vx,facingRad:Math.PI};
 const mirroredGait=advanceD01LiveShoeGait({phaseRad:0,tick:1,player:away,
  ball:{position:{x:-29.92,y:0,z:0.11},velocity:{x:-3.1,y:0,z:0}},
  solo:true,carryPhase:'sprint'});
 const mirror=soloCarryTwoFootPositions(away,mirroredGait);
 assert.ok(Math.abs(mirror.left.x+open.left.x)<1e-10);
 assert.ok(Math.abs(mirror.right.x+open.right.x)<1e-10);
 assert.equal(running.ballImpulseCreated,false);
 assert.equal(open.realContactsOnly,true);
 assert.equal(open.physicsImposed,false);
});

 test('D-02 directed evasion uses opposite free side and stable mirrored intent',()=>{
  for(const attackingSide of ['home','away']){
   const dir=attackingSide==='home'?1:-1,team=attackingSide==='home'?'away':'home';
   const source={attackingSide,variantIndex:2,tick:1,ballPosition:{x:dir*30,y:0},
    ballVelocity:{x:dir*1,y:0},defender:{team,x:dir*32,y:0.5}};
   const a=chooseDirectedDribbleTouch(source);
   assert.ok(a.desiredVelocity.y<0&&a.desiredVelocity.x*dir>0);
   assert.ok(a.magnitudeNs<=0.30);
   assert.deepEqual(a.desiredVelocity,chooseDirectedDribbleTouch({...source,tick:99}).desiredVelocity);
   assert.ok(chooseDirectedDribbleTouch({...source,defender:{...source.defender,y:-0.5}}).desiredVelocity.y>0);
   const passed=chooseDirectedDribbleTouch({...source,defender:{...source.defender,x:dir*28}});
   assert.equal(passed.bypassSide,0);assert.equal(passed.desiredVelocity.y,0);
   const target=directedDribbleApproachTarget({x:dir*29.3,y:0},source.ballPosition,{x:dir*2,y:1},attackingSide);
   assert.ok(Number.isFinite(target.x)&&Number.isFinite(target.y));
  }
 });
 test('D-02 active 1v1 uses genuine directed ground touches in mirrored variants',{timeout:120000},async()=>{
  const R=await initializeRapier(rapier);
  for(const side of ['home','away']){
   let touches=0,evasive=0;
   for(const variantIndex of [0,2,5,11,19,26]){
    const scene=createControlledActionLab(R,'dribble-1v1',{shotSide:side,variantIndex,bodyGuardEnabled:true,directedDribble:true});
    try{
     for(let n=0;n<420;n++){
      const f=scene.step(),a=f.action;
      if(a?.action==='carry'&&a.playerId===side+'-10'){
       const d=a.decisionContext?.isolatedDribbleTouch;
       assert.equal(d?.version,'me-628-directed-dribble-v1');
       assert.ok(a.appliedByRapier&&a.actualPhysicsImpulseApplied&&f.starts.includes(side+'-10'));
       assert.equal(a.impulseNs.z,0);assert.ok(Math.hypot(a.impulseNs.x,a.impulseNs.y)<=0.30+1e-8);
       touches++;if(d.bypassSide!==0)evasive++;
      }
      if(f.refereeEvidence?.lastEvent)break;
     }
    }finally{scene.dispose();}
   }
   process.stdout.write('ME_628_D02_DIRECTED '+JSON.stringify({side,touches,evasive})+'\n');
   assert.ok(touches>0&&evasive>0,'active 1v1 must exercise physical evasion on both sides');
  }
 });

 test('D-03 mirrored close pressure shields the ball without claiming possession',()=>{
  for(const side of ['home','away']){
   const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
   const b={x:dir*30,y:0},v={x:dir*0.4,y:0};
   const attacker={id:side+'-10',team:side,x:dir*29.6,y:0};
   const defender={id:other+'-2',team:other,x:dir*28.7,y:0.1};
   const shield=planDribbleShield(attacker,defender,b,v,side);
   assert.ok(shield);assert.ok(dir*shield.target.x<dir*b.x);
   assert.ok(observeDribbleShield(attacker,defender,b));
   assert.equal(planDribbleShield(attacker,{...defender,x:dir*33},b,v,side),null);
   assert.equal(planDribbleShield({...attacker,x:dir*27},defender,b,v,side),null);
   const touch=chooseDirectedDribbleTouch({attackingSide:side,variantIndex:0,tick:1,attacker,defender,ballPosition:b,ballVelocity:v});
   assert.equal(touch.shieldingIntent,true);assert.ok(touch.magnitudeNs<=0.18);
   const w=createDribbleShieldObserver(side);
   const sample=(tick,starts=[],bodyStarts=[],action=null)=>w.observe({tick,players:[attacker,defender],ball:{position:b},starts,bodyStarts,action});
   assert.equal(sample(1).shielding,true);
   assert.equal(sample(2,[attacker.id],[],{tick:2,playerId:attacker.id,action:'carry',appliedByRapier:true,actualPhysicsImpulseApplied:true}).retained,true);
   sample(3);sample(4,[],[defender.id]);
   assert.equal(sample(5,[attacker.id],[],{tick:5,playerId:attacker.id,action:'carry',appliedByRapier:true,actualPhysicsImpulseApplied:true}).retained,false);
   assert.equal(sample(6).officialPossession,false);
  }
 });

 test('D-04 defender contains from goal side, presses loose ball and recovers when bypassed',()=>{
  for(const side of ['home','away']){
   const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
   const ballPosition={x:dir*30,y:2},ballVelocity={x:dir*1,y:0.4};
   const attacker={id:side+'-10',x:dir*29.6,y:2};
   const defender={id:other+'-2',x:dir*32,y:2.2};
   const source={attackingSide:side,attacker,defender,ballPosition,ballVelocity};
   const contain=planDribbleDefender(source);
   assert.equal(contain.mode,'contain');assert.ok(dir*(contain.target.x-ballPosition.x)>0);
   const press=planDribbleDefender({...source,attacker:{...attacker,x:dir*27}});
   assert.equal(press.mode,'press');assert.ok(dir*press.target.x<dir*contain.target.x);
   const recover=planDribbleDefender({...source,defender:{...defender,x:dir*28}});
   assert.equal(recover.mode,'recover');assert.ok(dir*recover.target.x>dir*ballPosition.x);
   assert.equal(recover.officialPossession,false);
  }
 });
 test('D-04 live guarded defender pursues physical ball while canonical separation stays valid',{timeout:120000},async()=>{
  const R=await initializeRapier(rapier);
  for(const side of ['home','away']){
   let moved=0;const modes=new Set();let pressure=0;
   for(const variantIndex of [0,2,5,11,19,26]){
    const scene=createControlledActionLab(R,'dribble-1v1',{shotSide:side,variantIndex,bodyGuardEnabled:true,directedDribble:true});
    const id=(side==='home'?'away':'home')+'-2';
    try{
     let prior=scene.snapshot().observedMovementPlayers.find(p=>p.id===id);
     for(let n=0;n<420;n++){
      const f=scene.step(),p=f.observedMovementPlayers.find(p=>p.id===id),audit=f.defensivePositioning;
      assert.ok(audit&&['contain','press','recover'].includes(audit.mode));
      assert.equal(audit.officialPossession,false);
      assert.ok(f.nativeDribbleAudit.minimumCanonicalSeparationM>=0.98-1e-5);
      modes.add(audit.mode);if(audit.defenderGapM<2)pressure++;
      moved+=Math.hypot(p.x-prior.x,p.y-prior.y);prior=p;
      if(f.refereeEvidence?.lastEvent)break;
     }
    }finally{scene.dispose();}
   }
   process.stdout.write('ME_628_D04_DEFENDING '+JSON.stringify({side,moved,modes:[...modes],pressure})+'\n');
   assert.ok(moved>0&&pressure>0,'defender must approach the live ball');
  }
 });

 test('D-05 mirrored exposed ball allows a bounded tackle or interception, never a guaranteed win',()=>{
  for(const side of ['home','away']){
   const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
   const attacker={id:side+'-10',team:side,x:dir*29.6,y:0};
   const defender={id:other+'-2',team:other,x:dir*30.5,y:0};
   const source={attackingSide:side,attacker,defender,ballPosition:{x:dir*30,y:0,z:0.11},ballVelocity:{x:dir*1,y:0,z:0}};
   const tackle=chooseDribbleDefensiveTouch(source);
   assert.equal(tackle.kind,'tackle');assert.ok(Math.abs(tackle.desiredVelocity.y)>2&&tackle.magnitudeNs<=1.25);
   assert.ok(tackle.release.projectedTacklerGapM<tackle.release.projectedOpponentGapM);
   assert.equal(tackle.officialPossession,false);assert.equal(tackle.tackleWon,false);
   assert.equal(chooseDribbleDefensiveTouch({...source,attacker:{...attacker,x:dir*27}}).kind,'interception');
   assert.equal(chooseDribbleDefensiveTouch({...source,defender:{...defender,x:dir*34}}),null);
   assert.equal(chooseDribbleDefensiveTouch({...source,ballPosition:{...source.ballPosition,z:0.5}}),null);
   assert.equal(chooseDribbleDefensiveTouch({...source,defender:{...defender,x:dir*29.25}}),null);
  }
 });
 test('D-05 active mirrored 1v1 defensive actions require native exclusive shoe contact',{timeout:120000},async()=>{
  const R=await initializeRapier(rapier);
  for(const side of ['home','away']){
   let attempts=0,contacts=0;
   const defender=(side==='home'?'away':'home')+'-2';
   for(let variantIndex=0;variantIndex<30;variantIndex++){
    const scene=createControlledActionLab(R,'dribble-1v1',{shotSide:side,variantIndex,bodyGuardEnabled:true,directedDribble:true});
    try{
     for(let tick=0;tick<420;tick++){
      const f=scene.step(),a=f.action;
      if(f.starts.includes(defender))contacts++;
      if(a?.playerId===defender){
       assert.ok(['tackle','interception','carry'].includes(a.action));
       assert.deepEqual(f.starts,[defender]);assert.equal(a.appliedByRapier,true);
       assert.equal(a.actualPhysicsImpulseApplied,true);assert.equal(a.impulseNs.z,0);
       const cap=a.defensiveTarget?.intervention==='sliding-tackle'?SLIDING_TACKLE_MAX_IMPULSE_NS:1.25;
       assert.ok(Math.hypot(a.impulseNs.x,a.impulseNs.y)<=cap+1e-8);
       if(a.action==='carry')assert.equal(a.decisionContext.isolatedDribbleTouch.version,'me-628-directed-dribble-v1');
       else{assert.equal(a.defensiveTarget.officialPossession,false);attempts++;}
      }
      if(f.refereeEvidence?.lastEvent)break;
     }
    }finally{scene.dispose();}
   }
   process.stdout.write('ME_628_D05_DEFENSE '+JSON.stringify({side,contacts,attempts})+'\n');
   assert.ok(attempts>0,'each side needs a genuine executed defensive attempt');
  }
 });

 test('D-06 recovery needs subsequent authentic touch and is invalidated by opponent contact',()=>{
  for(const side of ['home','away']){
   const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
   const attacker={id:side+'-10',team:side,x:dir*28,y:0};
   const defender={id:other+'-2',team:other,x:dir*30.4,y:0};
   const b={x:dir*30,y:0,z:0.11},v={x:-dir*0.8,y:0,z:0};
   const w=createDribbleTransitionObserver(side);
   const sample=(tick,starts=[],active=starts,action=null,bodyStarts=[])=>w.observe({tick,starts,active,bodyStarts,bodyActive:bodyStarts,action,ball:{position:b}});
   const real=(tick,id,kind)=>({tick,playerId:id,action:kind,appliedByRapier:true,actualPhysicsImpulseApplied:true,defensiveTarget:{version:'me-628-duel-recovery-touch-v1'}});
   assert.equal(sample(1,[defender.id]).phase,'recover');
   assert.equal(sample(2,[],[defender.id]).recovered,false);
   assert.equal(sample(3).phase,'recover');
   assert.equal(sample(4,[defender.id],[defender.id],real(4,defender.id,'carry')).recovered,true);
   assert.equal(w.snapshot().phase,'counter');
   assert.equal(sample(5,[attacker.id],[attacker.id],real(5,attacker.id,'carry')).regained,true);
   assert.equal(w.snapshot().officialPossession,false);
   assert.equal(sample(6,[attacker.id,defender.id]).phase,'attack');
   assert.equal(sample(7,[],[],null,[defender.id]).phase,'recover');
   assert.equal(sample(8,[attacker.id]).phase,'attack');
   const touch=chooseDribbleRecoveryTouch({attackingSide:side,attacker,defender,ballPosition:b,ballVelocity:v});
   assert.ok(touch&&touch.dx*dir<0&&touch.magnitudeNs<=0.30);
   const target=planDribbleTransitionTarget(defender,attacker,b,v,side,'counter');
   assert.ok(Number.isFinite(target.x)&&Number.isFinite(target.y));
  }
 });
 test('D-06 live transitions preserve native action authority and actor identities',{timeout:120000},async()=>{
  const R=await initializeRapier(rapier);
  for(const side of ['home','away']){
   let windows=0,recoveries=0,regains=0;
   for(const variantIndex of [0,2,5,11,19,26]){
    const scene=createControlledActionLab(R,'dribble-1v1',{shotSide:side,variantIndex,bodyGuardEnabled:true,directedDribble:true});
    try{
     for(let k=0;k<480;k++){
      const f=scene.step(),w=f.duelTransition;
      assert.equal(w.tick,f.physicsTick);assert.equal(w.officialPossession,false);
      if(w.phase!=='attack')windows++;
      if(w.recovered){recoveries++;assert.equal(f.action?.decisionContext?.isolatedDribbleTouch?.version,'me-628-directed-dribble-v1');assert.deepEqual(f.starts,[f.action.playerId]);}
      if(w.regained){regains++;assert.equal(f.action?.playerId,side+'-10');}
      if(f.refereeEvidence?.lastEvent)break;
     }
    }finally{scene.dispose();}
   }
   process.stdout.write('ME_628_D06_TRANSITION '+JSON.stringify({side,windows,recoveries,regains})+'\n');
  }
 });

 test('D-07 contact release assigns different bounded outward movement targets without changing ball',()=>{
  for(const side of ['home','away']){
   const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
   const attacker={id:side+'-10',x:dir*29.5,y:0},defender={id:other+'-2',x:dir*30.5,y:0};
   const ball={x:dir*30,y:0};
   const release=planDribbleContactRelease({attackingSide:side,attacker,defender,ball});
   assert.equal(release.primaryId,attacker.id);assert.equal(release.movementOnly,true);
   assert.ok(dir*(release.targets[defender.id].x-defender.x)>0.7);
   assert.ok(dir*(release.targets[attacker.id].x-attacker.x)<-0.6);
   const approach=dribbleReleaseApproach(attacker,ball,release);
   assert.ok(Math.hypot(approach.x-ball.x,approach.y-ball.y)<=0.21);
   assert.equal(planDribbleContactRelease({attackingSide:side,attacker,defender,ball,phase:'counter'}).primaryId,defender.id);
  }
 });
 test('D-07 all 60 active duels measure stationary contact rather than counting touches alone',{timeout:180000},async()=>{
  const R=await initializeRapier(rapier);
  const results=[];
  for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
   const scene=createControlledActionLab(R,'dribble-1v1',{shotSide:side,variantIndex,bodyGuardEnabled:true,directedDribble:true});
   let stagnant=0,maxStagnant=0,blocked=0,blockedRun=0,maxBlockedRun=0,ballPath=0,prior=scene.snapshot().ball.position;
   let anchor=prior,anchorTick=0,maxCloseBallStall=0,slideStarts=0,slideContacts=0,recoveryTicks=0,peakSlideSpeed=0;
   let pending=null,defensiveTouches=0,available=0,recoveredCarry=0,rivalCarry=0,expired=0,censored=0,alignmentTicks=0,detourTicks=0;
   const strikeSamples=[],releaseSamples=[];let strike=null,effectiveContacts=0;
   const finish=(reason)=>{if(!pending)return;if(pending.available)available++;if(reason==='carry')recoveredCarry++;else if(reason==='rival')rivalCarry++;else if(reason==='expired')expired++;else censored++;pending=null;};
   try{
    for(let k=0;k<600;k++){
     const f=scene.step(),b=f.ball.position,v=f.ball.velocity;
     if(f.defensiveSlide?.started)slideStarts++;
     if(scene.focus.some(id=>isDuelGettingUp(f.duelTransition,id,f.physicsTick))&&f.duelTransition.lastIntervention?.tick!==f.physicsTick){
      for(const id of scene.focus)if(isDuelGettingUp(f.duelTransition,id,f.physicsTick))assert.notEqual(f.action?.playerId,id,'mixed slide bilateral lock');
     }
     if(f.defensiveSlide?.phase==='recovery'){
      recoveryTicks++;
      assert.notEqual(f.action?.playerId,f.defensiveSlide.actorId,'recovering defender cannot execute a ball action');
     }
     if(f.action?.defensiveTarget?.intervention==='sliding-tackle'){
      slideContacts++;assert.equal(f.defensiveSlide?.phase,'slide');
      assert.deepEqual(f.starts,[f.defensiveSlide.actorId]);
      assert.equal(f.action.appliedByRapier,true);assert.equal(f.action.actualPhysicsImpulseApplied,true);
     }
     const a=f.observedMovementPlayers.find(p=>p.id===side+'-10'),d=f.observedMovementPlayers.find(p=>p.id===(side==='home'?'away':'home')+'-2');
     if(f.defensiveSlide?.phase==='slide'){
      const slider=f.defensiveSlide.actorId===a.id?a:d;
      peakSlideSpeed=Math.max(peakSlideSpeed,Math.hypot(slider.vx,slider.vy));
     }
     assert.ok(Math.hypot(d.vx,d.vy)<=7+1e-5);
     const action=f.action;
     if(strike&&f.physicsTick===strike.tick+12){releaseSamples.push({kind:strike.kind,travelM:Math.hypot(b.x-strike.x,b.y-strike.y)});strike=null;}
     if(action&&['tackle','interception'].includes(action.action)){
      const kind=action.defensiveTarget?.intervention??action.action;
      strikeSamples.push({kind,speedMps:Math.hypot(v.x,v.y),impulseNs:Math.hypot(action.impulseNs.x,action.impulseNs.y)});
      if(f.duelTransition.lastIntervention?.effective)effectiveContacts++;
      strike={kind,tick:f.physicsTick,x:b.x,y:b.y};
     }else if(action)strike=null;
     if(f.smallSidedMovementDecisions?.some(p=>p.postContactAlignment))alignmentTicks++;
     if(f.smallSidedMovementDecisions?.some(p=>p.alignmentDetour))detourTicks++;
     if(pending&&f.physicsTick>pending.tick){
      const tackler=pending.id===a.id?a:d, rival=tackler===a?d:a;
      const dg=Math.hypot(tackler.x-b.x,tackler.y-b.y),ag=Math.hypot(rival.x-b.x,rival.y-b.y);
      if(Math.hypot(b.x-pending.x,b.y-pending.y)>=0.35&&dg<=1.25&&ag-dg>=0.20)pending.available=true;
      if(action?.action==='carry')finish(action.playerId===pending.id?'carry':'rival');
      else if(f.physicsTick-pending.tick>=90)finish('expired');
     }
     if(action&&['tackle','interception'].includes(action.action)){
      if(pending)finish('interrupted');
      defensiveTouches++;pending={id:action.playerId,tick:f.physicsTick,x:b.x,y:b.y,available:false};
     }
     const near=Math.hypot(a.x-d.x,a.y-d.y)<1.6&&Math.max(Math.hypot(a.x-b.x,a.y-b.y),Math.hypot(d.x-b.x,d.y-b.y))<1.8;
     const slow=Math.max(Math.hypot(a.vx,a.vy),Math.hypot(d.vx,d.vy))<0.30&&Math.hypot(v.x,v.y)<0.40;
     if(near&&slow)stagnant++;else stagnant=0;
     if(a.blockedBy===d.id&&d.blockedBy===a.id){blocked++;blockedRun++;}else blockedRun=0;
     maxBlockedRun=Math.max(maxBlockedRun,blockedRun);
     if(!near||Math.hypot(b.x-anchor.x,b.y-anchor.y)>0.30){anchor=b;anchorTick=k;}
     else maxCloseBallStall=Math.max(maxCloseBallStall,k-anchorTick);
     maxStagnant=Math.max(maxStagnant,stagnant);
     ballPath+=Math.hypot(b.x-prior.x,b.y-prior.y);prior=b;
     assert.ok(f.nativeDribbleAudit.minimumCanonicalSeparationM>=0.98-1e-5);
     if(f.refereeEvidence?.lastEvent)break;
    }
    finish('end');
    const f=scene.snapshot();
    results.push({side,variant:variantIndex+1,maxStagnant,blocked,maxBlockedRun,maxCloseBallStall,ballPath,slideStarts,slideContacts,recoveryTicks,peakSlideSpeed,defensiveTouches,available,recoveredCarry,rivalCarry,expired,censored,alignmentTicks,detourTicks,effectiveContacts,strikeSamples,releaseSamples,attackerTouches:f.nativeDribbleAudit.appliedCarryActions,
     defenderAttempts:f.nativeDribbleAudit.defensiveTackleAttempts+f.nativeDribbleAudit.defensiveInterceptionAttempts,
     recoveryTouches:f.nativeDribbleAudit.defensiveRecoveryTouches,actionsByPlayer:f.nativeDribbleAudit.actionsByPlayer,roleChanges:f.duelTransition.changes});
   }finally{scene.dispose();}
  }
  process.stdout.write('ME_628_D07_LIVENESS '+JSON.stringify(results)+'\n');
  const totals=Object.fromEntries(['defensiveTouches','available','recoveredCarry','rivalCarry','expired','censored'].map(key=>[key,results.reduce((sum,x)=>sum+x[key],0)]));
  process.stdout.write('ME_628_D09_RELEASE '+JSON.stringify(totals)+'\n');
  const strikes=results.flatMap(x=>x.strikeSamples),releases=results.flatMap(x=>x.releaseSamples);
  const report=['standing-tackle','sliding-tackle'].map(kind=>{
   const s=strikes.filter(x=>x.kind===kind),r=releases.filter(x=>x.kind===kind);
   return {kind,count:s.length,meanSpeedMps:s.length?s.reduce((sum,x)=>sum+x.speedMps,0)/s.length:null,
    meanImpulseNs:s.length?s.reduce((sum,x)=>sum+x.impulseNs,0)/s.length:null,
    observed12TickSamples:r.length,meanTravelM:r.length?r.reduce((sum,x)=>sum+x.travelM,0)/r.length:null};
  });
  process.stdout.write('ME_628_D09_REACTION '+JSON.stringify({effectiveContacts:results.reduce((s,x)=>s+x.effectiveContacts,0),report})+'\n');
  assert.ok(report[1].count>0,'must exercise actual sliding strike');
  assert.ok(totals.defensiveTouches>0&&totals.available>0,'must observe actual post-contact recovery opportunities');
  assert.ok(totals.recoveredCarry>0,'must observe real post-contact carry by the tackler');
  assert.ok(results.some(x=>x.alignmentTicks>0),'observe live post-contact alignment');
  for(const side of ['home','away']){
   const cases=results.filter(x=>x.side===side),original=side+'-10',other=(side==='home'?'away':'home')+'-2';
   assert.ok(cases.some(x=>x.slideStarts>0),'each side must attempt a real sliding movement');
   assert.ok(cases.some(x=>x.actionsByPlayer[other].carry>0),'original defender must execute native shared carry');
   assert.ok(cases.some(x=>x.actionsByPlayer[original].tackle+x.actionsByPlayer[original].interception>0),'original attacker must execute a real defensive action after reversal');
   assert.ok(cases.some(x=>x.roleChanges>=2),'role reversal must be repeatable in a duel');
  }
  assert.ok(results.every(x=>x.maxStagnant<150),'no continuous stationary close duel lasting 2.5 seconds');
  assert.ok(results.every(x=>x.maxBlockedRun<120),'no mutual movement rejection lasting two seconds');
  assert.ok(results.every(x=>x.maxCloseBallStall<180),'no close contest with net ball displacement under 0.30m lasting three seconds');
 });

 test('D-08 shared duel selection does not depend on shirt number or original tactical role',()=>{
  for(const side of ['home','away'])for(const swapped of [false,true]){
   const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
   const player={id:side+(swapped?'-2':'-10'),team:side,x:dir*29.6,y:0};
   const opponent={id:other+(swapped?'-10':'-2'),team:other,x:dir*30.6,y:0};
   const b={x:dir*30,y:0,z:0.11},v={x:dir,y:0,z:0};
   const source={player,opponent,ballPosition:b,ballVelocity:v,variantIndex:0,tick:1};
   const carry=chooseSharedDuelTouch({...source,transition:{carrierId:player.id}});
   assert.equal(carry.carry.version,'me-628-directed-dribble-v1');
   const defense=chooseSharedDuelTouch({...source,player:opponent,opponent:player,transition:{carrierId:player.id}});
   assert.equal(defense.defensive.kind,'tackle');
   const recover=chooseSharedDuelTouch({...source,player:opponent,opponent:player,transition:{carrierId:player.id,candidateId:opponent.id}});
   assert.equal(recover.carry.version,carry.carry.version);
   assert.equal(chooseSharedDuelTouch({...source,transition:{carrierId:player.id},slide:{phase:'recovery'}}),null);
   const original=side+'-10',otherId=other+'-2';
   const actors=[{...player,id:original},{...opponent,id:otherId}];
   assert.equal(resolveDuelActors(actors,side,{carrierId:otherId}).attacker.id,otherId);
  }
 });

 test('D-09 release chooses free side and recovery approach from either team',()=>{
  for(const side of ['home','away']){
   const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
   const attacker={id:side+'-10',team:side,x:dir*29.6,y:0};
   const defender={id:other+'-2',team:other,x:dir*30.5,y:0};
   const b={x:dir*30,y:0,z:0.11};
   const release=planDefensiveBallRelease(attacker,defender,b,side);
   assert.ok(Math.abs(release.target.y)>0.8);
   assert.ok(release.projectedTacklerGapM<release.projectedOpponentGapM);
   assert.ok(release.pathClearanceGainM>=-0.03);
   const edge=planDefensiveBallRelease({...attacker,y:33.1},{...defender,y:33.1},{...b,y:33.1},side);
   assert.ok(edge.target.y<33.1);
   const approach=planDuelRecoveryApproach(defender,b,{x:0,y:2.8});
   assert.ok(approach.y>0&&Number.isFinite(approach.x));
  }
 });

 test('D-09b post-contact targets avoid crossing the opponent and separate mirrored approaches',()=>{
  for(const side of ['home','away']){
   const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
   const player={id:side+'-10',team:side,x:dir*29,y:0};
   const rival={id:other+'-2',team:other,x:dir*30,y:0};
   const route=routeDuelAroundOpponent(player,rival,{x:dir*31,y:0});
   assert.equal(route.detour,true);assert.ok(route.clearanceM>=0.98);
   assert.ok(Math.abs(route.target.y)>0.5);
   const clear=routeDuelAroundOpponent(player,rival,{x:dir*28,y:0});
   assert.equal(clear.detour,false);
   const targets=planDuelPostContactAlignment({attacker:rival,defender:player,attackingSide:other,candidateId:rival.id,
    ballPosition:{x:dir*29.6,y:0.7},ballVelocity:{x:0,y:2}});
   for(const id of [player.id,rival.id])assert.ok(Number.isFinite(targets[id].target.x)&&Number.isFinite(targets[id].target.y));
   assert.ok(Math.hypot(targets[player.id].target.x-targets[rival.id].target.x,targets[player.id].target.y-targets[rival.id].target.y)>0.5);
  }
 });

 test('D-09c effective deflection and stronger slide are symmetric and geometry-based',()=>{
  for(const side of ['home','away']){
   const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
   const attacker={id:side+'-10',team:side,x:dir*29.6,y:0};
   const defender={id:other+'-2',team:other,x:dir*30.5,y:0};
   const b={x:dir*30,y:0,z:0.11},v={x:dir,y:0,z:0};
   const source={attackingSide:side,attacker,defender,ballPosition:b,ballVelocity:v};
   const standing=chooseDribbleDefensiveTouch(source),sliding=chooseDribbleDefensiveTouch({...source,sliding:true});
   assert.ok(standing&&sliding);
   assert.equal(Math.hypot(standing.desiredVelocity.x,standing.desiredVelocity.y).toFixed(3),STANDING_TACKLE_TARGET_SPEED_MPS.toFixed(3));
   assert.equal(Math.hypot(sliding.desiredVelocity.x,sliding.desiredVelocity.y).toFixed(3),SLIDING_TACKLE_TARGET_SPEED_MPS.toFixed(3));
   assert.ok(sliding.magnitudeNs>standing.magnitudeNs*1.5);
   assert.ok(sliding.magnitudeNs<=SLIDING_TACKLE_MAX_IMPULSE_NS);
   assert.ok(observeEffectiveDuelIntervention(defender,attacker,b,{x:dir*0.8,y:2.8}));
   assert.equal(observeEffectiveDuelIntervention(defender,attacker,b,{x:-dir*3,y:0}),false);
   const observer=createDribbleTransitionObserver(side);
   const action={tick:1,playerId:defender.id,action:'tackle',appliedByRapier:true,actualPhysicsImpulseApplied:true,defensiveTarget:{intervention:'sliding-tackle'}};
   const w=observer.observe({tick:1,starts:[defender.id],active:[defender.id],bodyStarts:[],bodyActive:[],action,
    ball:{position:b,velocity:{x:dir*0.8,y:2.8}},players:[attacker,defender]});
   assert.equal(w.lastIntervention.effective,true);assert.equal(w.candidateId,defender.id);assert.equal(w.carrierId,attacker.id);
   const next=observer.observe({tick:2,starts:[attacker.id],active:[attacker.id],bodyStarts:[],bodyActive:[],action:null,
    ball:{position:b,velocity:{x:dir*0.8,y:2.8}},players:[attacker,defender]});
   assert.equal(next.candidateId,defender.id,'incidental rival touch does not cancel effective recovery');
   assert.equal(next.officialPossession,false);
  }
 });

 test('D-10 isolated standing and sliding tackle profiles preserve actual contact and both-player get-up lock',{timeout:120000},async()=>{
  const R=await initializeRapier(rapier);
  for(const profile of ['standing','sliding'])for(const side of ['home','away']){
   let strikes=0,pairedRecovery=0,fullyRecovered=0;
   for(const variantIndex of [0,1,2,4,6,7,8,11]){
    const scene=createControlledActionLab(R,'dribble-1v1',{shotSide:side,variantIndex,bodyGuardEnabled:true,directedDribble:true,duelTackleProfile:profile});
    let pending=null;
    try{
     for(let i=0;i<600;i++){
      const f=scene.step(),action=f.action,w=f.duelTransition;
      assert.equal(w.profile,profile);
      if(profile==='standing'){assert.equal(f.defensiveSlide,null);assert.deepEqual(w.getUpUntil,{});}
      if(action?.action==='tackle'){
       strikes++;
       assert.equal(action.defensiveTarget.intervention,profile+'-tackle');
       assert.deepEqual(f.starts,[action.playerId]);
       assert.equal(action.actualPhysicsImpulseApplied,true);
       if(profile==='sliding'){
        const rival=scene.focus.find(id=>id!==action.playerId);
        assert.equal(w.getUpUntil[action.playerId],f.physicsTick+SLIDING_GET_UP_TACKLER_TICKS);
        assert.equal(w.getUpUntil[rival],f.physicsTick+SLIDING_GET_UP_RIVAL_TICKS);
        pending={tick:f.physicsTick,actor:action.playerId,rival};pairedRecovery++;
       }
      }
      if(pending&&f.physicsTick>pending.tick){
       for(const id of scene.focus){
        const down=isDuelGettingUp(w,id,f.physicsTick);
        const decision=f.smallSidedMovementDecisions.find(d=>d.id===id);
        if(down){assert.equal(decision.kind,'getting-up');assert.notEqual(action?.playerId,id);}
       }
       if(f.physicsTick>pending.tick+SLIDING_GET_UP_RIVAL_TICKS){fullyRecovered++;pending=null;}
      }
      assert.ok(f.nativeDribbleAudit.minimumCanonicalSeparationM>=0.98-1e-5);
      if(f.refereeEvidence?.lastEvent)break;
     }
    }finally{scene.dispose();}
   }
   process.stdout.write('ME_628_D10_TACKLE_LABS '+JSON.stringify({profile,side,strikes,pairedRecovery,fullyRecovered})+'\n');
   assert.ok(strikes>0,'isolated profile must actually execute its named tackle');
   if(profile==='sliding')assert.ok(pairedRecovery>0&&fullyRecovered>0,'both players must complete the real slide recovery');
  }
 });

 test('D-11 shoulder approach is side-on, mirrored, and requires an actual solver contact',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
  const attacker={id:side+'-10',team:side,x:30*dir,y:0,vx:2*dir,vy:0};
  const defender={id:other+'-2',team:other,x:30*dir,y:1.02,vx:2*dir,vy:0};
  const b={x:30.5*dir,y:0},v={x:2*dir,y:0};
  const plan=planDuelShoulderApproach({attacker,defender,attackingSide:side,ballPosition:b,ballVelocity:v});
  assert.ok(plan.sideOn);assert.ok(plan.target.y>0.9);
  const source={tick:1,plan,players:[attacker,defender],ball:b,torsoPairs:[]};
  assert.equal(observeNativeShoulderChallenge(source),null);
  const evidence=observeNativeShoulderChallenge({...source,torsoPairs:[[attacker.id,defender.id].sort().join('|')]});
  assert.equal(evidence.actorId,defender.id);assert.equal(evidence.ballImpulseCreated,false);
  assert.equal(evidence.officialPossession,false);
  assert.equal(observeNativeShoulderChallenge({...source,plan:{...plan,sideOn:false},torsoPairs:[[attacker.id,defender.id].sort().join('|')]}),null);
 }
 });
 test('D-11 dedicated shoulder LAB observes genuine opposing torso contacts in both mirrored directions',{timeout:180000},async()=>{
  const R=await initializeRapier(rapier);
  for(const side of ['home','away']){
   let attempts=0,sideOn=0,contacts=0,realPairs=0;
   for(let variantIndex=0;variantIndex<30;variantIndex++){
    const scene=createControlledActionLab(R,'dribble-1v1',{shotSide:side,variantIndex,bodyGuardEnabled:true,directedDribble:true,duelTackleProfile:'shoulder'});
    try{
     for(let i=0;i<600;i++){
      const f=scene.step(),w=f.duelTransition;
      assert.equal(w.profile,'shoulder');assert.equal(f.defensiveSlide,null);
      assert.equal(f.action?.action==='tackle'||f.action?.action==='interception',false);
      assert.deepEqual(w.getUpUntil,{});
      if(f.shoulderApproach){attempts++;if(f.shoulderApproach.sideOn)sideOn++;}
      if(f.smallSidedNativeBodyGuard.nativeOpposingTorsoPairs.length)realPairs++;
      if(w.lastShoulder?.tick===f.physicsTick){
       contacts++;const e=w.lastShoulder;
       assert.ok(f.smallSidedNativeBodyGuard.nativeOpposingTorsoPairs.includes([e.actorId,e.opponentId].sort().join('|')));
       assert.equal(e.ballImpulseCreated,false);assert.equal(e.officialPossession,false);
      }
      assert.ok(f.nativeDribbleAudit.minimumCanonicalSeparationM>=0.98-1e-5);
      if(f.refereeEvidence?.lastEvent)break;
     }
    }finally{scene.dispose();}
   }
   process.stdout.write('ME_628_D11_SHOULDER '+JSON.stringify({side,attempts,sideOn,realPairs,contacts})+'\n');
   assert.ok(attempts>0&&sideOn>0&&contacts>0,'shoulder LAB must demonstrate actual native side-on contact on both sides');
  }
 });
