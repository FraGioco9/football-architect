// #628 M20: 48 genuinely distinct Rapier physical/control comparisons.
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {writeFileSync} from 'node:fs';
import {initializeRapier} from '../src/core.mjs';
import {auditNaturalNativeFeedback}
 from '../src/natural-native-feedback-audit-m14.mjs';
import {M18_ORIGINAL_BALL_POSITIONS,M18_ORIGINAL_BALL_VELOCITIES}
 from '../src/expanded-native-pair-survey-m18.mjs';

const sample=[
 ['centre-x0-y0','forward-68'],['centre-x0-y0','reverse-68'],
 ['centre-x-6-y0','diagonal-south'],['centre-x6-y0','forward-68'],
 ['centre-x0-y9','reverse-68'],['centre-x0-y-9','diagonal-south']
];
const R=await initializeRapier(wasm),cases=[];
for(const [positionId,velocityId] of sample){
 const pos=M18_ORIGINAL_BALL_POSITIONS.find(x=>x.id===positionId);
 const vel=M18_ORIGINAL_BALL_VELOCITIES.find(x=>x.id===velocityId);
 for(const side of ['home','away']){
  const rows=[];
  for(const secondary of [false,true])
   for(const mode of ['feedback','observe']){
    const x=auditNaturalNativeFeedback(R,{
     stateId:'centre',side,mode,ticks:240,shoeBodyHandoff:'bounded',
     researchBallStart:{x:pos.x,y:pos.y},
     initialBallVelocity:{vx:vel.vx,vy:vel.vy},
     researchEncounterTelemetry:true,
     researchSecondaryPressSupport:secondary
    });
    if(x.ticks!==240||x.fullShapeTicks!==240||
       !x.original22Unstaged||!x.singleNativeEventQueue||
       !x.sameRapierWorld||x.nativeColliderRadiusM!==0.49||
       x.minimumCanonicalGapM<0.98-1e-8||
       x.peakCanonicalSpeedMps>7+1e-7||x.matchAuthority||
       x.observedContactDynamics?.realNativeStarts!==x.nativeBodyStarts||
       x.observedContactDynamics?.realNativeActivePeak!==
        x.maxSimultaneousBodyPairs||
       (mode==='observe'&&x.acceptedNativeResponses!==0)||
       (secondary&&!x.secondaryPressActiveTicks)||
       (!secondary&&Object.hasOwn(x,'secondaryPressSupport')))
     throw new Error('M20 invalid original kinematics/native source');
    rows.push({secondary,mode,x});
   }
  const b=rows.find(r=>!r.secondary&&r.mode==='feedback').x;
  const s=rows.find(r=>r.secondary&&r.mode==='feedback').x;
  const controls=rows.filter(r=>r.mode==='observe');
  if(controls.length!==2||controls.some(r=>
    JSON.stringify(r.x.initialBall)!==JSON.stringify(b.initialBall)))
   throw new Error('M20 unmatched initial source/controls');
  cases.push({
   positionId,velocityId,side,initialBall:b.initialBall,
   baseline:{
    bodyStarts:b.nativeBodyStarts,
    peak:b.maxSimultaneousBodyPairs,
    physicalCorrections:b.acceptedNativeResponses,
    telemetry:b.observedContactDynamics
   },
   secondary:{
    bodyStarts:s.nativeBodyStarts,
    peak:s.maxSimultaneousBodyPairs,
    physicalCorrections:s.acceptedNativeResponses,
    selected:s.secondaryPressSupport,
    assigned:s.secondaryPressActiveTicks,
    switches:s.secondaryPressSwitches,
    telemetry:s.observedContactDynamics
   },
   controls:controls.map(r=>({secondary:r.secondary,
    responses:r.x.acceptedNativeResponses,
    nativeBodyStarts:r.x.nativeBodyStarts}))
  });
 }
}
const sum=(side,fn)=>cases.reduce((v,c)=>v+fn(c[side]),0);
const prox=side=>Object.fromEntries(['1.5','3','5','8'].map(k=>[k,{
 opponentProximityTicks:sum(side,c=>c.telemetry.proximity[k].anyOpponentTicks),
 twoDisjointOpponentProximityTicks:sum(side,c=>
  c.telemetry.proximity[k].twoDisjointOpponentTicks)
}]));
const report={
 version:'m20-real-secondary-defensive-pressure-ab-v1',
 exactHead:process.env.M20_EXPECTED_HEAD??null,
 workflowTrigger:process.env.GITHUB_SHA??null,
 pairedBallCases:cases.length,originalRapierRuns:cases.length*4,
 sourceTicksPerRun:240,
 original22Players:true,noSyntheticCollisions:true,
 negativeControlsAllZero:cases.every(c=>c.controls.every(x=>x.responses===0)),
 baseline:{
  starts:sum('baseline',x=>x.bodyStarts),
  nativePeak:Math.max(...cases.map(c=>c.baseline.peak)),
  corrections:sum('baseline',x=>x.physicalCorrections),
  proximity:prox('baseline')
 },
 secondary:{
  starts:sum('secondary',x=>x.bodyStarts),
  nativePeak:Math.max(...cases.map(c=>c.secondary.peak)),
  corrections:sum('secondary',x=>x.physicalCorrections),
  assignedTeamTicks:sum('secondary',x=>x.assigned.home+x.assigned.away),
  roleSwitches:sum('secondary',x=>x.switches.home+x.switches.away),
  proximity:prox('secondary')
 },
 trueNativeMultiPairObserved:cases.some(x=>x.secondary.peak>=2),
 detailedCases:cases
};
const path=process.env.M20_EVIDENCE_PATH??'match-engine-m20-support.json';
writeFileSync(path,JSON.stringify(report,null,2)+'\n');
process.stdout.write('ME_628_M20_SECOND_DEFENDER_AB '+JSON.stringify({
 head:report.exactHead,runs:report.originalRapierRuns,
 paired:report.pairedBallCases,assigned:report.secondary.assignedTeamTicks,
 baselineStarts:report.baseline.starts,secondaryStarts:report.secondary.starts,
 baselinePeak:report.baseline.nativePeak,secondaryPeak:report.secondary.nativePeak,
 baselineDisjoint5:report.baseline.proximity['5'].twoDisjointOpponentProximityTicks,
 secondaryDisjoint5:report.secondary.proximity['5'].twoDisjointOpponentProximityTicks,
 baselineDisjoint8:report.baseline.proximity['8'].twoDisjointOpponentProximityTicks,
 secondaryDisjoint8:report.secondary.proximity['8'].twoDisjointOpponentProximityTicks,
 trueNativeMultiPair:report.trueNativeMultiPairObserved
})+'\n');
if(!report.negativeControlsAllZero||report.secondary.assignedTeamTicks<1)
 throw new Error('M20 genuine source comparison/assignment INVALID');
