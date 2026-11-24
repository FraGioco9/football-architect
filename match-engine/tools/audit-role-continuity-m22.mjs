// #628 M22 — focused 12 matched preexisting M20 240-tick ball cases.
// Evaluate stability of genuinely selected second defenders and the
// duration of original Rapier events. No extra tuning/search grid.
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {writeFileSync} from 'node:fs';
import {initializeRapier} from '../src/core.mjs';
import {auditNaturalNativeFeedback}
 from '../src/natural-native-feedback-audit-m14.mjs';
import {M18_ORIGINAL_BALL_POSITIONS,M18_ORIGINAL_BALL_VELOCITIES}
 from '../src/expanded-native-pair-survey-m18.mjs';

const pairStarts=[
 ['centre-x0-y0','forward-68'],['centre-x0-y0','reverse-68'],
 ['centre-x-6-y0','diagonal-south'],['centre-x6-y0','forward-68'],
 ['centre-x0-y9','reverse-68'],['centre-x0-y-9','diagonal-south']
];
const R=await initializeRapier(wasm);
const cases=[];
for(const [positionId,velocityId] of pairStarts){
 const position=M18_ORIGINAL_BALL_POSITIONS.find(p=>p.id===positionId);
 const velocity=M18_ORIGINAL_BALL_VELOCITIES.find(v=>v.id===velocityId);
 if(!position||!velocity)
  throw new Error('M22 cannot invent a rolling-ball source');
 for(const side of ['home','away']){
  const settings={
   stateId:'centre',side,ticks:240,mode:'feedback',
   shoeBodyHandoff:'bounded',researchEncounterTelemetry:true,
   researchBallStart:{x:position.x,y:position.y},
   initialBallVelocity:{vx:velocity.vx,vy:velocity.vy}
  };
  const baseline=auditNaturalNativeFeedback(R,settings);
  const observed=auditNaturalNativeFeedback(R,{
   ...settings,researchSecondaryPressSupport:true
  });
  const base=baseline.observedContactDynamics;
  const tested=observed.observedContactDynamics;
  const roles=tested?.secondaryDutyContinuity;
  if(!roles||roles.ticks!==240||!roles.nativeOnly||
     !roles.readOnly||roles.matchAuthority!==false||
     Object.hasOwn(base,'secondaryDutyContinuity')||
     !baseline.original22Unstaged||!observed.original22Unstaged||
     !baseline.singleNativeEventQueue||!observed.singleNativeEventQueue||
     !baseline.sameRapierWorld||!observed.sameRapierWorld||
     baseline.nativeColliderRadiusM!==0.49||
     observed.nativeColliderRadiusM!==0.49||
     baseline.minimumCanonicalGapM<0.98-1e-8||
     observed.minimumCanonicalGapM<0.98-1e-8||
     baseline.peakCanonicalSpeedMps>7+1e-7||
     observed.peakCanonicalSpeedMps>7+1e-7||
     observed.matchAuthority!==false||
     observed.officialTackle!==false||
     observed.officialPossession!==false||
     JSON.stringify(baseline.initialBall)!==
      JSON.stringify(observed.initialBall)||
     base.realNativeStarts!==baseline.nativeBodyStarts||
     tested.realNativeStarts!==observed.nativeBodyStarts||
     base.realNativeActivePeak!==baseline.maxSimultaneousBodyPairs||
     tested.realNativeActivePeak!==observed.maxSimultaneousBodyPairs||
     roles.home.selectedTeamTicks!==observed.secondaryPressActiveTicks.home||
     roles.away.selectedTeamTicks!==observed.secondaryPressActiveTicks.away||
     roles.home.sourceRoleSwitches!==observed.secondaryPressSwitches.home||
     roles.away.sourceRoleSwitches!==observed.secondaryPressSwitches.away||
     roles.home.assignedWithoutRealContestTicks!==0||
     roles.away.assignedWithoutRealContestTicks!==0)
   throw new Error('M22 source role/collision/physical invariant failure');
  cases.push({positionId,velocityId,side,
   originalBall:observed.initialBall,
   baseline:{
    nativeStarts:baseline.nativeBodyStarts,
    nativeEnds:baseline.nativeBodyEnds,
    trueNativePeak:baseline.maxSimultaneousBodyPairs,
    closedNativeContactDurationsTicks:
     base.completedNativeContactDurationsTicks,
    censoredNativeContactDurations:
     base.stillActiveNativePairAgesTicks,
    genuineDisjointOpponentWithin5MTicks:
     base.proximity['5'].twoDisjointOpponentTicks
   },
   secondary:{
    nativeStarts:observed.nativeBodyStarts,
    nativeEnds:observed.nativeBodyEnds,
    trueNativePeak:observed.maxSimultaneousBodyPairs,
    closedNativeContactDurationsTicks:
     tested.completedNativeContactDurationsTicks,
    censoredNativeContactDurations:
     tested.stillActiveNativePairAgesTicks,
    genuineDisjointOpponentWithin5MTicks:
     tested.proximity['5'].twoDisjointOpponentTicks,
    home:roles.home,away:roles.away
   }
  });
 }
}
if(cases.length!==12)
 throw new Error('M22 requires all 12 original M20 matched comparisons');
const total=(side,fn)=>cases.reduce((v,c)=>v+fn(c[side]),0);
const roleTotal=fn=>cases.reduce((v,c)=>
 v+fn(c.secondary.home)+fn(c.secondary.away),0);
const durations=side=>cases.flatMap(c=>
 c[side].closedNativeContactDurationsTicks);
const summaryDuration=dur=>{
 const sorted=[...dur].sort((a,b)=>a-b);
 return {completedContactEpisodes:sorted.length,
  medianClosedDurationTicks:sorted.length?
   sorted[Math.floor(sorted.length/2)]:null,
  p90ClosedDurationTicks:sorted.length?
   sorted[Math.ceil(sorted.length*0.9)-1]:null,
  maxClosedDurationTicks:sorted.length?sorted[sorted.length-1]:null
 };
};
const roleDuration=cases.flatMap(c=>[
 ...c.secondary.home.closedEpisodeDurationsTicks,
 ...c.secondary.away.closedEpisodeDurationsTicks
]);
const report={
 version:'m22-source-native-contact-and-role-stability-v1',
 sourceHead:process.env.M22_EXPECTED_HEAD??null,
 pullRequestTrigger:process.env.GITHUB_SHA??null,
 original22BodySource:true,
 feedbackOnlyOriginalRapier24Runs:true,
 matchesExistingM20BallPairing:true,
 noPhysicsOrTacticsModification:true,
 matchAuthority:false,
 cases:12,actualRapierRuns:24,ticksPerCase:240,
 baseline:{
  nativeStarts:total('baseline',x=>x.nativeStarts),
  nativeEnds:total('baseline',x=>x.nativeEnds),
  peakTrueNativeConcurrentPairs:Math.max(...cases.map(x=>x.baseline.trueNativePeak)),
  twoDisjointOpponentWithin5MTicks:
   total('baseline',x=>x.genuineDisjointOpponentWithin5MTicks),
  nativeContactLifecycle:summaryDuration(durations('baseline')),
  rightCensoredNativeContactEpisodes:total('baseline',
   x=>x.censoredNativeContactDurations.length)
 },
 secondary:{
  nativeStarts:total('secondary',x=>x.nativeStarts),
  nativeEnds:total('secondary',x=>x.nativeEnds),
  peakTrueNativeConcurrentPairs:Math.max(...cases.map(x=>x.secondary.trueNativePeak)),
  twoDisjointOpponentWithin5MTicks:
   total('secondary',x=>x.genuineDisjointOpponentWithin5MTicks),
  nativeContactLifecycle:summaryDuration(durations('secondary')),
  rightCensoredNativeContactEpisodes:total('secondary',
   x=>x.censoredNativeContactDurations.length),
  actualAssignedTeamTicks:roleTotal(x=>x.selectedTeamTicks),
  roleAcquisitions:roleTotal(x=>x.acquisitionCount),
  roleReleases:roleTotal(x=>x.releases),
  playerHandoffs:roleTotal(x=>x.playerHandoffs),
  offBallThreatRetargets:roleTotal(x=>x.opponentRetargets),
  totalSourceSwitches:roleTotal(x=>x.sourceRoleSwitches),
  completedRoleEpisodes:roleDuration.length,
  roleDurations:summaryDuration(roleDuration),
  shortRoleEpisodesAtMost15Ticks:
   roleTotal(x=>x.completedEpisodesAtMost15Ticks),
  pendingRightCensoredRoleEpisodes:roleTotal(x=>Number(x.pendingEpisode!==null)),
  selectedMarkerWithin1_5MTeamTicks:
   roleTotal(x=>x.realPhysicalMarkerOpponentGapM.within1_5MTeamTicks),
  selectedMarkerWithin3MTeamTicks:
   roleTotal(x=>x.realPhysicalMarkerOpponentGapM.within3MTeamTicks),
  selectedMarkerWithin5MTeamTicks:
   roleTotal(x=>x.realPhysicalMarkerOpponentGapM.within5MTeamTicks),
  genuineNativeMarkerContactTicks:
   roleTotal(x=>x.activeNativeAnyMarkerPairTicks),
  genuineNativeMarkedOpponentContactTicks:
   roleTotal(x=>x.activeNativeMarkedPairTicks),
  ungroundedAssignmentTicks:
   roleTotal(x=>x.assignedWithoutRealContestTicks)
 },
 realMultiPairPositive:cases.some(c=>c.secondary.trueNativePeak>=2),
 casesDetail:cases
};
if(report.secondary.actualAssignedTeamTicks===0||
   report.secondary.ungroundedAssignmentTicks!==0||
   !Number.isSafeInteger(report.secondary.totalSourceSwitches))
 throw new Error('M22 original secondary assignment source absent or ungrounded');
const path=process.env.M22_EVIDENCE_PATH??
 'match-engine-m22-continuity.json';
writeFileSync(path,JSON.stringify(report,null,2)+'\n');
process.stdout.write('ME_628_M22_REAL_CONTINUITY '+JSON.stringify({
 sourceHead:report.sourceHead,runs:24,pairedCases:12,
 trueNativeContactStartsBefore:report.baseline.nativeStarts,
 trueNativeContactStartsAfter:report.secondary.nativeStarts,
 trueNativePeak:report.secondary.peakTrueNativeConcurrentPairs,
 sourceAssignedTeamTicks:report.secondary.actualAssignedTeamTicks,
 acquisitions:report.secondary.roleAcquisitions,
 releases:report.secondary.roleReleases,
 playerHandoffs:report.secondary.playerHandoffs,
 retargets:report.secondary.offBallThreatRetargets,
 roleEpisodes:report.secondary.completedRoleEpisodes,
 medianRoleDurationTicks:
  report.secondary.roleDurations.medianClosedDurationTicks,
 shortRoleEpisodes:report.secondary.shortRoleEpisodesAtMost15Ticks,
 trueBodyContactDurationBefore:report.baseline.nativeContactLifecycle,
 trueBodyContactDurationAfter:report.secondary.nativeContactLifecycle,
 genuineMarkerContactTicks:report.secondary.genuineNativeMarkerContactTicks,
 realMultiPairPositive:report.realMultiPairPositive
})+'\n');
