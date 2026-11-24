// #628 M14: full independent original ball-territory matrix.
// From match-engine/: npm run audit:natural-body-feedback
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {auditNaturalNativeFeedbackMatrix}
 from '../src/natural-native-feedback-audit-m14.mjs';
const R=await initializeRapier(wasm);
const a=auditNaturalNativeFeedbackMatrix(R,{ticks:225});
const summary={
 originalTerritories:a.originalStates,
 genuineOriginalWorldRuns:a.totalRuns,
 ticksPerRun:a.eachTicks,
 originalBodySTARTs:a.nativeBodyStarts,
 genuineNativeShoeSTARTs:a.nativeShoeStarts,
 originalStatesWithAuthenticBodyContact:a.feedbackCasesWithNativeContact,
 safeCanonicalFeedbackStates:a.positiveFeedbackCases,
 acceptedNativeBodyCorrections:a.totalAcceptedNativeResponses,
 actualPeakSimultaneousBodyPairs:a.maximumSimultaneousNativeBodyPairs,
 trueMultiBodyPairsObserved:a.multipleSimultaneousNativeBodyPairsObserved,
 realSameTickBodyAndShoeStarts:a.sameTickNativeBodyAndShoeStarts,
 negativeControlAcceptedCorrections:a.controlsAcceptedResponses,
 claimedMatchAuthority:false
};
process.stdout.write('ME_628_M14_FULL_NATURAL_FEEDBACK '+
 JSON.stringify({summary,rows:a.rows})+'\n');
