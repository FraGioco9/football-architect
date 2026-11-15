// P2 DEV-only target hint from an internally completed REAL Rapier frame.
// A structural match is not shoe-contact authentication; only the private
// universal world calls this after observing its own exclusive shoe START.
import {projectObservedFootballContext} from './player-football-observation.mjs';
import {inspectUniformPolicyGeometry} from './player-ball-uniform-autonomous-action.mjs';
import {planNextTickPolicyGeometryIntent} from './player-football-policy-geometry-plan.mjs';
export const SHOT_MOVEMENT_CUE_VERSION='me-p2-source-bound-shot-approach-v1';
export function chooseNextTickPhysicalShotMovementCue(frame){
 const tick=frame?.physicsTick;
 if(!Number.isSafeInteger(tick)||tick<0||
  frame.contactSource!=='internal-real-rapier-60hz'||
  frame.experimentalLocalOnly!==true||
  frame.matchRuntimeIntegrated!==false||
  frame.officialMatchAction!==false)
  throw new TypeError('Completed private physical frame required');
 if(tick===0)return null;
 const starts=frame.footContact?.started,active=frame.footContact?.active;
 if(!Array.isArray(starts)||!Array.isArray(active)||
  frame.footContact.tick!==tick||
  frame.autonomousMovement?.physicsTick!==tick)
  throw new TypeError('Prior real shoe and movement tick required');
 if(starts.length!==1||active.length!==1||starts[0]!==active[0])
  return null;
 const playerId=starts[0];
 const context=projectObservedFootballContext(frame,{
  playerId,phase:'ball-opportunity'
 });
 const geo=inspectUniformPolicyGeometry({
  tick,playerId,ballPosition:frame.ball.position,
  physicalPlayerPositions:frame.physicalPlayerPositions
 });
 const intent=planNextTickPolicyGeometryIntent(context,geo);
 if(intent.proposedIntent?.intent!=='shoot')return null;
 return Object.freeze({
  version:SHOT_MOVEMENT_CUE_VERSION,sourceTick:tick,decisionTick:tick+1,
  playerId,team:context.team,
  ballX:frame.ball.position.x,ballY:frame.ball.position.y,
  targetKind:'existing-canonical-ball-approach',
  readOnly:true,physicalActionAuthorized:false,
  impulseAuthorized:false,officialMatchAction:false
 });
}
