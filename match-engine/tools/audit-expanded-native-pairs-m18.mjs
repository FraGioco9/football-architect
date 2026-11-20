// #628 M18: 25 × 6 × HOME/AWAY × feedback/observe = 600
// real independent one-world, 240-tick ball-only Rapier sessions.
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {writeFileSync} from 'node:fs';
import {initializeRapier} from '../src/core.mjs';
import {auditNaturalNativeFeedback}
 from '../src/natural-native-feedback-audit-m14.mjs';
import {M18_ORIGINAL_BALL_POSITIONS,M18_ORIGINAL_BALL_VELOCITIES,
 auditExpandedNativePairSource}
 from '../src/expanded-native-pair-survey-m18.mjs';

const R=await initializeRapier(wasm);
const evidence=auditExpandedNativePairSource(R,{ticks:240});
let exactNativeReplay=null;
if(evidence.completeOriginalSource&&evidence.firstPositiveWitness){
 const w=evidence.firstPositiveWitness;
 const p=M18_ORIGINAL_BALL_POSITIONS.find(x=>x.id===w.positionId);
 const v=M18_ORIGINAL_BALL_VELOCITIES.find(x=>x.id===w.velocityId);
 const options={stateId:'centre',side:w.side,ticks:240,
  mode:'feedback',shoeBodyHandoff:'bounded',
  researchBallStart:{x:p.x,y:p.y},
  initialBallVelocity:{vx:v.vx,vy:v.vy}};
 const one=auditNaturalNativeFeedback(R,options);
 const two=auditNaturalNativeFeedback(R,options);
 if(JSON.stringify(one)!==JSON.stringify(two)||
    JSON.stringify(one.firstSimultaneousBodyPairs)!==
     JSON.stringify({tick:w.tick,pairs:w.nativePairs}))
  throw new Error('M18 real native concurrent-pair witness did not replay');
 exactNativeReplay={...w,replayedTwoIndependentWorlds:true};
}
const full=evidence.positions===M18_ORIGINAL_BALL_POSITIONS.length&&
 evidence.rollingProfiles===M18_ORIGINAL_BALL_VELOCITIES.length&&
 evidence.requestedRuns===600&&evidence.completedRuns===600&&
 evidence.blockedRuns===0&&evidence.fullPairedCases===300&&
 evidence.sourceTicksPerRun===240&&
 evidence.completeOriginalSource&&evidence.controlCorrections===0&&
 evidence.cases.every(r=>r.ticks===240);
const report={...evidence,runContext:{
 gitHead:process.env.GITHUB_SHA??null,
 expectedHead:process.env.M18_EXPECTED_HEAD??null,
 nodeVersion:process.version,
 rapier:'@dimforge/rapier3d-deterministic-compat@0.21.0',
 fullSourceIntegrityGate:full,
 trueNativeWitnessRepeated:exactNativeReplay,
 positionGrid:M18_ORIGINAL_BALL_POSITIONS,
 velocityProfiles:M18_ORIGINAL_BALL_VELOCITIES,
 playerInitialisation:'unaltered-original-22',
 physics:'one-original-Rapier-World-and-single-native-event-queue'
}};
const path=process.env.M18_EVIDENCE_PATH??'match-engine-m18-evidence.json';
writeFileSync(path,JSON.stringify(report,null,2)+'\n');
process.stdout.write('ME_628_M18_EXPANDED_600_REAL_BALL_CASES '+
 JSON.stringify({
  fullSourceIntegrityGate:full,
  runs:evidence.requestedRuns,complete:evidence.completedRuns,
  blocked:evidence.blockedRuns,pairs:evidence.fullPairedCases,
  ticks:evidence.sourceTicksPerRun,
  nativeBodyStarts:evidence.nativeBodyStarts,
  nativeBodyEnds:evidence.nativeBodyEnds,
  nativeShoeStarts:evidence.nativeShoeStarts,
  realPhysicalCorrections:evidence.physicalCorrections,
  negativeControlCorrections:evidence.controlCorrections,
  peakSameTickNativePairs:evidence.peakSameTickNativeBodyPairs,
  positiveNativeWitnesses:evidence.positiveSimultaneousNativeWitnesses.length,
  multiPairGatePassed:evidence.genuineMultiPairGatePassed,
  firstWitness:evidence.firstPositiveWitness,
  exactNativeReplay,
  report:path
 })+'\n');
if(!full)throw new Error('M18 full original source evidence INCOMPLETE');
