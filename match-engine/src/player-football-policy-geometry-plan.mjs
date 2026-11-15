// P2 advisory only: next-tick intention from the PREVIOUS completed
// Rapier fixture frame and the unchanged canonical shot/pass geometry.
// Never an executor, movement command, or guaranteed future shoe contact.
import {chooseObservedFootballIntent} from './player-football-intent.mjs';
import {UNIFORM_POLICY_GEOMETRY_VERSION}
 from './player-ball-uniform-autonomous-action.mjs';
export const POLICY_GEOMETRY_PLAN_VERSION=
 'me-p2-next-tick-policy-geometry-advisory-v1';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>p&&finite(p.x)&&finite(p.y);
const fail=()=>{throw new TypeError('Valid completed-tick policy geometry required');};
export function planNextTickPolicyGeometryIntent(observation,geometry){
 if(!observation||!Array.isArray(observation.affordances)||
    observation.affordances.length!==0||
    chooseObservedFootballIntent(observation)!==null||
    observation.phase!=='ball-opportunity'||
    observation.physicsTick!==observation.frame.tick||
    !Number.isSafeInteger(observation.physicsTick+1)||
    !geometry||geometry.version!==UNIFORM_POLICY_GEOMETRY_VERSION||
    geometry.physicsTick!==observation.physicsTick||
    geometry.playerId!==observation.playerId||
    geometry.team!==observation.team||geometry.readOnly!==true||
    geometry.actualShoeContactVerified!==null||
    geometry.physicalActionAuthorized!==false||
    geometry.physicalActionExecuted!==false||
    !Array.isArray(geometry.authorizedAffordances)||
    geometry.authorizedAffordances.length!==0||
    typeof geometry.shotRange!=='boolean'||
    typeof geometry.shotLaneFound!=='boolean'||
    (geometry.shotLaneFound&&(!geometry.shotRange||
      !point(geometry.shotLaneTarget)))||
    (!geometry.shotLaneFound&&geometry.shotLaneTarget!==null))
  fail();
 const playerId=geometry.passGeometryRecipientId;
 const mate=playerId===null?null:
  observation.frame.players.find(p=>p.id===playerId);
 if((playerId!==null&&!mate)||
    (mate&&(mate.team!==observation.team||
      mate.id===observation.playerId||
      !point(geometry.passGeometryRecipientTarget)||
      mate.x!==geometry.passGeometryRecipientTarget.x||
      mate.y!==geometry.passGeometryRecipientTarget.y))||
    (playerId===null&&geometry.passGeometryRecipientTarget!==null))
  fail();
 const proposed=[];
 if(geometry.shotLaneFound)
  proposed.push(Object.freeze({kind:'shoot',available:true,
   evidenceTick:observation.physicsTick,
   target:Object.freeze({...geometry.shotLaneTarget})}));
 if(mate)
  proposed.push(Object.freeze({kind:'pass',available:true,
   evidenceTick:observation.physicsTick,targetPlayerId:mate.id}));
 const candidateContext={
  ...observation,affordances:Object.freeze(proposed)
 };
 const selected=chooseObservedFootballIntent(candidateContext);
 return Object.freeze({
  version:POLICY_GEOMETRY_PLAN_VERSION,
  basedOnCompletedTick:observation.physicsTick,
  earliestPlanningTick:observation.physicsTick+1,
  actorId:observation.playerId,team:observation.team,
  proposedIntent:selected,
  candidateKinds:Object.freeze(proposed.map(x=>x.kind)),
  source:'unchanged-selector-geometry-of-completed-frame',
  verifiedFutureShoeStart:false,
  verifiedFuturePhysicalEligibility:false,
  authorizedAffordances:Object.freeze([]),
  readOnly:true,physicalActionExecuted:false,
  officialMatchAction:false,officialMatchPossession:false
 });
}
