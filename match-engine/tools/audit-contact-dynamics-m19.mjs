// #628 M19: deliberately SMALL movement/collision diagnostic survey.
// No new ball profiles, no player manipulation, and no 600-run expansion.
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {writeFileSync} from 'node:fs';
import {initializeRapier} from '../src/core.mjs';
import {auditNaturalNativeFeedback}
 from '../src/natural-native-feedback-audit-m14.mjs';
import {M18_ORIGINAL_BALL_POSITIONS,M18_ORIGINAL_BALL_VELOCITIES}
 from '../src/expanded-native-pair-survey-m18.mjs';

const positionIds=['centre-x-6-y0','centre-x0-y0','centre-x6-y0',
 'centre-x0-y9','centre-x0-y-9'];
const velocityIds=['forward-68','reverse-68','diagonal-south'];
const R=await initializeRapier(wasm);
const cases=[];
for(const positionId of positionIds)for(const velocityId of velocityIds){
 const pos=M18_ORIGINAL_BALL_POSITIONS.find(x=>x.id===positionId);
 const vel=M18_ORIGINAL_BALL_VELOCITIES.find(x=>x.id===velocityId);
 for(const side of ['home','away'])for(const mode of ['feedback','observe']){
  const result=auditNaturalNativeFeedback(R,{
   stateId:'centre',side,mode,ticks:240,shoeBodyHandoff:'bounded',
   researchBallStart:{x:pos.x,y:pos.y},
   initialBallVelocity:{vx:vel.vx,vy:vel.vy},
   researchEncounterTelemetry:true
  });
  if(result.fullShapeTicks!==240||!result.original22Unstaged||
     !result.singleNativeEventQueue||
     result.observedContactDynamics?.ticks!==240||
     result.observedContactDynamics.realNativeStarts!==result.nativeBodyStarts||
     result.observedContactDynamics.realNativeEnds!==result.nativeBodyEnds||
     result.observedContactDynamics.realNativeActivePeak!==
      result.maxSimultaneousBodyPairs||
     result.nativeColliderRadiusM!==0.49||
     result.minimumCanonicalGapM<0.98-1e-8||
     result.peakCanonicalSpeedMps>7+1e-7||
     result.matchAuthority!==false||
     (mode==='observe'&&result.acceptedNativeResponses!==0))
   throw new Error('M19 real original native event source/invariants violated');
  cases.push({positionId,velocityId,side,mode,
   initialBall:result.initialBall,
   realBodyStarts:result.nativeBodyStarts,
   realBodyEnds:result.nativeBodyEnds,
   appliedNativeCorrections:result.acceptedNativeResponses,
   peakTrueNativePairs:result.maxSimultaneousBodyPairs,
   firstTrueConcurrentPairs:result.firstSimultaneousBodyPairs,
   telemetry:result.observedContactDynamics});
 }
}
const positive=cases.filter(x=>x.mode==='feedback');
const controls=cases.filter(x=>x.mode==='observe');
if(cases.length!==60||positive.length!==30||controls.length!==30||
   !positive.every(p=>controls.some(n=>n.positionId===p.positionId&&
    n.velocityId===p.velocityId&&n.side===p.side&&
    JSON.stringify(n.initialBall)===JSON.stringify(p.initialBall)))||
   !controls.every(x=>x.appliedNativeCorrections===0))
 throw new Error('M19 full matched original physical/control source incomplete');
const sum=f=>positive.reduce((v,p)=>v+f(p.telemetry),0);
const thresholds=['1.5','3','5','8'];
const proximity=Object.fromEntries(thresholds.map(k=>[
 k,{ticksWithAnyOpposingProximity:sum(t=>t.proximity[k].anyOpponentTicks),
   ticksWithTwoDisjointOpposingProximities:
    sum(t=>t.proximity[k].twoDisjointOpponentTicks),
   ticksWithTwoDisjointAnyBodies:
    sum(t=>t.proximity[k].twoDisjointAllBodiesTicks),
   ticksWithTeammateProximity:sum(t=>t.proximity[k].anyTeammateTicks)}
]));
const sampleTicks=30*240;
const report={
 version:'m19-measured-original-encounter-causes-v1',
 exactHead:process.env.GITHUB_SHA??null,
 expectedHead:process.env.M19_EXPECTED_HEAD??null,
 source:'one-original-Rapier-World-shared-native-event-queue-per-run',
 noMovementOrPhysicsMutation:true,noFootballAuthority:true,
 runCount:cases.length,verifiedPairs:30,ticksEach:240,
 positiveObservedTicks:sampleTicks,
 measured:{
  authenticBodyStarts:positive.reduce((n,x)=>n+x.realBodyStarts,0),
  canonicalNativeCorrections:positive.reduce((n,x)=>
   n+x.appliedNativeCorrections,0),
  actualNativePeak:Math.max(...positive.map(x=>x.peakTrueNativePairs)),
  realSameTickMultipleContactRuns:positive.filter(x=>
   x.firstTrueConcurrentPairs!==null).length,
  realStartsOpposing:sum(t=>t.opposingNativeStarts),
  realStartsTeammates:sum(t=>t.teammateNativeStarts),
  bothPressersAssignedTicks:sum(t=>t.bothPressersAssignedTicks),
  trueOpponentContestTicks:sum(t=>t.opposingConvergenceTicks),
  opposingBlockedPlayerTicks:sum(t=>t.movement.opposingBlockedPlayerTicks),
  teammateBlockedPlayerTicks:sum(t=>t.movement.teammateBlockedPlayerTicks),
  ticksWithBothTeamsWithin5mBall:
   sum(t=>t.nearBall.ticksWithBothTeamsWithin5M),
  ticksWithBothTeamsWithin10mBall:
   sum(t=>t.nearBall.ticksWithBothTeamsWithin10M),
  proximity,
  lowestSecondDisjointOpponentGapM:Math.min(
   ...positive.map(x=>x.telemetry.minimumSecondDisjointOpponentGapM)
    .filter(Number.isFinite)),
  nativePairActiveDurationTicks:positive.flatMap(x=>
   x.telemetry.completedNativeContactDurationsTicks),
  perCase:cases
 }
};
const path=process.env.M19_EVIDENCE_PATH??
 'match-engine-m19-contact-dynamics.json';
writeFileSync(path,JSON.stringify(report,null,2)+'\n');
process.stdout.write('ME_628_M19_SOURCE_DIAGNOSIS '+
 JSON.stringify({
  exactHead:report.exactHead,
  runs:report.runCount,paired:report.verifiedPairs,
  sourceTicks:report.positiveObservedTicks,
  actualNativeStarts:report.measured.authenticBodyStarts,
  nativePeak:report.measured.actualNativePeak,
  realMultipleContacts:report.measured.realSameTickMultipleContactRuns,
  opposingStarts:report.measured.realStartsOpposing,
  teammateStarts:report.measured.realStartsTeammates,
  bothPressersAssigned:report.measured.bothPressersAssignedTicks,
  trueContestTicks:report.measured.trueOpponentContestTicks,
  opponentsBlocked:report.measured.opposingBlockedPlayerTicks,
  teammatesBlocked:report.measured.teammateBlockedPlayerTicks,
  teamsNearBall5:report.measured.ticksWithBothTeamsWithin5mBall,
  teamsNearBall10:report.measured.ticksWithBothTeamsWithin10mBall,
  proximity,
  closestSecondDisjointOpponentGapM:
   report.measured.lowestSecondDisjointOpponentGapM
 })+'\n');
