// #628 M17: one exact source 12 × 4 × 2 × feedback/control 240-tick
// Rapier audit. This runs separately from the fast ME-01 CI workload.
// A measured negative is a VALID evidence report, NOT a passed multi-pair gate.
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {writeFileSync} from 'node:fs';
import {initializeRapier} from '../src/core.mjs';
import {auditMovingBallMultiPairMatrix}
 from '../src/moving-ball-multipair-audit-m15.mjs';
import {summarizeOriginalConcurrentPairSurvey}
 from '../src/natural-concurrent-pair-survey-m17.mjs';
import {auditNaturalNativeFeedback}
 from '../src/natural-native-feedback-audit-m14.mjs';
import {M11_BALL_STARTS} from '../src/unstaged-body-contact-audit.mjs';
import {M15_ORIGINAL_BALL_MOTIONS}
 from '../src/moving-ball-multipair-audit-m15.mjs';

const R=await initializeRapier(wasm);
const matrix=auditMovingBallMultiPairMatrix(R,{
 ticks:240,handoffPolicy:'bounded'
});
const data=summarizeOriginalConcurrentPairSurvey(matrix);
const full=data.originalTerritories===M11_BALL_STARTS.length&&
 data.originalRollingProfiles===M15_ORIGINAL_BALL_MOTIONS.length&&
 data.fullOriginalTerritoryCoverage&&data.fullOriginalVelocityCoverage&&
 data.requestedRuns===192&&data.completedRuns===192&&
 data.blockedRuns===0&&data.completeFeedbackControlPairs===96&&
 data.sourceTicksPerRun===240&&
 data.cases.every(x=>x.ticks===240)&&
 data.negativeControlCorrections===0;
let repeatedWitness=null;
if(full&&data.firstSimultaneousNativeWitness){
 const w=data.firstSimultaneousNativeWitness;
 const motion=M15_ORIGINAL_BALL_MOTIONS.find(v=>v.id===w.velocityId);
 const args={stateId:w.stateId,side:w.side,mode:'feedback',
  ticks:240,shoeBodyHandoff:'bounded',
  initialBallVelocity:{vx:motion.vx,vy:motion.vy}};
 const a=auditNaturalNativeFeedback(R,args);
 const b=auditNaturalNativeFeedback(R,args);
 if(JSON.stringify(a)!==JSON.stringify(b)||
    JSON.stringify(a.firstSimultaneousBodyPairs)!==
     JSON.stringify({tick:w.tick,pairs:w.nativePairs}))
  throw new Error('M17 positive Rapier body START/END did not replay exactly');
 repeatedWitness={...w,deterministicReplays:2};
}
const report={
 ...data,runContext:{
  gitHead:process.env.GITHUB_SHA??null,
  expectedPullRequestHead:process.env.M17_EXPECTED_HEAD??null,
  nodeVersion:process.version,
  originalRapierCompat:'@dimforge/rapier3d-deterministic-compat@0.21.0',
  scenarioFamily:'unchanged-original-M11-M15-ball-only-initial-conditions',
  realReplay:repeatedWitness,
  fullSourceIntegrityGate:full,
  noSyntheticPlayerContact:true
 }
};
const path=process.env.M17_EVIDENCE_PATH??'match-engine-m17-evidence.json';
writeFileSync(path,JSON.stringify(report,null,2)+'\n');
process.stdout.write('ME_628_M17_FULL_192_NATIVE_SURVEY '+
 JSON.stringify({
  fullSourceIntegrityGate:full,runs:data.requestedRuns,
  complete:data.completedRuns,blocked:data.blockedRuns,
  sourceTicks:data.sourceTicksPerRun,paired:data.completeFeedbackControlPairs,
  nativeBodyStarts:data.realFeedbackNativeStarts,
  nativeShoeStarts:data.realFeedbackShoeStarts,
  physicalCorrections:data.acceptedCanonicalCorrections,
  negativeWrites:data.negativeControlCorrections,
  largestSameTickNativePairCount:data.largestSameTickNativePairCount,
  positiveWitnesses:data.simultaneousNativeWitnesses.length,
  multiPairGatePassed:data.genuineMultiPairGatePassed,
  firstWitness:data.firstSimultaneousNativeWitness,
  repeatedWitness:repeatedWitness!==null,
  reportFile:path
 })+'\n');
if(!full)throw new Error('M17 original source integrity is incomplete; DO NOT certify');
