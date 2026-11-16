// #628 M11 reproducible research CLI (off-line, original 22 players only).
// Run from match-engine/: npm run audit:unstaged-body
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {M11_BALL_STARTS,auditUnstagedBodyContacts}
 from '../src/unstaged-body-contact-audit.mjs';

const R=await initializeRapier(wasm);
const results=[];
for(const side of ['home','away'])for(const ball of M11_BALL_STARTS)
 results.push(auditUnstagedBodyContacts(R,{
  side,stateId:ball.id,ticks:160
 }));
const closest=results.reduce((a,b)=>
 !a||b.nearestPhysicalPair.gapM<a.nearestPhysicalPair.gapM?b:a,null);
const summary={
 scope:'M11 original unstaged 22-player one-Rapier-world audit',
 ballStarts:results.length,
 ticksPerState:160,
 genuineBodyCollisionStarts:results.reduce((n,x)=>n+x.bodyCollisionStarts,0),
 genuineShoeCollisionStarts:results.reduce((n,x)=>n+x.footCollisionStarts,0),
 bodyContactPositiveStates:results.filter(x=>x.bodyCollisionStarts>0).length,
 readOnlyAdmissibleStates:results.filter(x=>x.firstReadOnlyAdmissibleResponse).length,
 closestPhysical:closest?{
  stateId:closest.stateId,side:closest.side,
  ...closest.nearestPhysicalPair
 }:null,
 noArtificialEncounter:true,
 noAuthoritativeBodyResponse:true,
 noOfficialFootballActions:true
};
process.stdout.write('ME_628_M11_AUDIT '+JSON.stringify({summary,results})+'\n');
