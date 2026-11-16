// #628 M15 full rolling-ball search, standalone and deliberately NOT
// claimed by the focused CI subset. Run from match-engine:
// npm run audit:moving-ball-multipair
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {auditMovingBallMultiPairMatrix}
 from '../src/moving-ball-multipair-audit-m15.mjs';
const R=await initializeRapier(wasm);
const result=auditMovingBallMultiPairMatrix(R,{ticks:225});
process.stdout.write('ME_628_M15_FULL_NATURAL_ROLLING_SEARCH '+
 JSON.stringify({
  originalTerritories:result.originalTerritories,
  authenticRollingProfiles:result.originalRollingProfiles,
  totalRapierRuns:result.runs,ticksPerRun:result.ticksPerRun,
  nativeBodyStarts:result.feedbackNativeBodyStarts,
  nativeShoeStarts:result.feedbackNativeShoeStarts,
  acceptedCanonicalCorrections:result.actualCanonicalResponses,
  negativeAcceptedCorrections:result.controlsCanonicalResponses,
  maxConcurrentRealBodyPairs:result.maximumSimultaneousNativeBodyPairs,
  actualMultiPairConfirmed:result.trueMultiPairContactObserved,
  firstMultiPair:result.firstRealMultiPairEvidence,
  cases:result.rows.map(row=>({
   state:row.stateId,velocity:row.velocityId,side:row.side,mode:row.mode,
   nativeStarts:row.nativeBodyStarts,
   maxRealActivePairs:row.maxSimultaneousBodyPairs,
   firstRealMultiPair:row.firstSimultaneousBodyPairs,
   appliedResponses:row.acceptedNativeResponses,
   sameTickShoeAndBody:row.sameTickNativeBodyAndShoeStarts
  }))
 })+'\\n');
