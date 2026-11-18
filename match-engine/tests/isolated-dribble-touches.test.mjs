import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {smallSidedSetup} from '../src/small-sided-lab-scenarios.mjs';
import {chooseIsolatedDribbleTouch} from '../src/isolated-dribble-touches.mjs';
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
 assert.equal(solo.magnitudeNs,duel.magnitudeNs*0.55);
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
