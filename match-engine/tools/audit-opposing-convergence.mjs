// #628 M12: original, unstaged HOME/AWAY convergence audit.
// Run from match-engine/: npm run audit:opposing-convergence
// Research only: a near miss is never a native body contact.
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {auditUnstagedBodyContacts} from '../src/unstaged-body-contact-audit.mjs';
const R=await initializeRapier(wasm);
const starts=['centre','middle-halfspace','attacking-third',
 'attacking-halfspace','defending-third','defending-halfspace'];
const results=[];
for(const side of ['home','away'])for(const stateId of starts)
 results.push(auditUnstagedBodyContacts(R,{
  side,stateId,movementPolicy:'contested-press',ticks:225
 }));
const summary={
 version:'m12-original-presser-convergence-audit',
 auditedOriginal22States:results.length,
 ticksPerState:225,
 originalPlayerFormation:true,
 sourceDrivenConvergenceStates:results.filter(
  x=>x.actualOpposingContestTicks>0).length,
 genuineNativeBodyStartStates:results.filter(
  x=>x.bodyCollisionStarts>0).length,
 genuineNativeBodyStarts:results.reduce(
  (sum,x)=>sum+x.bodyCollisionStarts,0),
 actualNativeShoes:results.reduce((sum,x)=>sum+x.footCollisionStarts,0),
 closestOpposingBodyGapM:Math.min(...results.map(
  x=>x.nearestOpposingPhysicalPair.gapM)),
 firstGenuineNativeContact:results.find(x=>x.firstNativeBodyStart)?
  {stateId:results.find(x=>x.firstNativeBodyStart).stateId,
   side:results.find(x=>x.firstNativeBodyStart).side,
   event:results.find(x=>x.firstNativeBodyStart).firstNativeBodyStart}:null,
 noStaging:true,noTackle:true,
 noOfficialPassOrPossession:true,bodyFeedbackApplied:false
};
process.stdout.write('ME_628_M12_AUDIT '+JSON.stringify({
 summary,results
})+'\n');
