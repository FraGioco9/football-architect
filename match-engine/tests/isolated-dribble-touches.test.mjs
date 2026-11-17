import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {smallSidedSetup} from '../src/small-sided-lab-scenarios.mjs';
import {chooseIsolatedDribbleTouch} from '../src/isolated-dribble-touches.mjs';
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
    meanTouchIntervalTicks:f.nativeDribbleAudit.meanAppliedTouchIntervalTicks};
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
 assert.ok(summary.meanTouchesPerTrial>=2.4,'bounded full-matrix touch frequency');
 const baseline=samples.filter(s=>s.variantIndex===0);
 assert.equal(baseline.length,4);
 assert.ok(baseline.every(s=>s.actionCount>=5&&s.recontacts>=4&&
    s.forwardM>4&&s.peakClearanceM===0&&s.peakBallSpeedMps<3.5),
   'V01 HOME/AWAY Bodies ON/OFF must dribble forward on the grass with true recontacts');
});
