// P2 DEV-only target hint from an internally completed REAL Rapier frame.
// A structural match is not shoe-contact authentication; only the private
// universal world calls this after observing its own exclusive shoe START.
import {projectObservedFootballContext} from './player-football-observation.mjs';
import {inspectUniformPolicyGeometry} from './player-ball-uniform-autonomous-action.mjs';
import {INITIAL_PLAYERS,PLAYER_VERSION} from './player-movement.mjs';
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
  ballZ:frame.ball.position.z,
  targetKind:'existing-canonical-ball-approach',
  readOnly:true,physicalActionAuthorized:false,
  impulseAuthorized:false,officialMatchAction:false
 });
}

export const REQUALIFIED_SHOT_MOVEMENT_CUE_VERSION=
 'me-p2-current-physical-geometry-checked-target-v1';
// Pure advisory check, called ONLY with the private current pre-step
// Rapier ball and current 22-player mover snapshot. The source real
// shoe START is still only the PRIOR tick; never authorize a new kick.
export function requalifyNextTickPhysicalShotMovementCue(cue,{
 physicsTick,ballPosition,movementFrame
}={}){
 if(cue===null)return null;
 if(!cue||cue.version!==SHOT_MOVEMENT_CUE_VERSION||
   cue.readOnly!==true||cue.physicalActionAuthorized!==false||
   cue.impulseAuthorized!==false||cue.officialMatchAction!==false||
   !INITIAL_PLAYERS.some(p=>p.id===cue.playerId&&p.team===cue.team&&
      p.role!=='goalkeeper'))
  throw new TypeError('Untrusted prior SHOT movement hint');
 if(!Number.isSafeInteger(physicsTick)||physicsTick<0||
    !ballPosition||!['x','y','z'].every(k=>
      typeof ballPosition[k]==='number'&&Number.isFinite(ballPosition[k]))||
    !movementFrame||movementFrame.version!==PLAYER_VERSION||
    !Number.isSafeInteger(movementFrame.tick)||movementFrame.tick<0||
    !Array.isArray(movementFrame.players)||
    movementFrame.players.length!==INITIAL_PLAYERS.length)
  throw new TypeError('Missing current physical ball or canonical mover');
 const positions=Object.freeze(movementFrame.players.map((p,i)=>{
  const expected=INITIAL_PLAYERS[i];
  if(!p||p.id!==expected.id||p.team!==expected.team||
     p.role!==expected.role||!Number.isFinite(p.x)||
     !Number.isFinite(p.y))
   throw new TypeError('Mismatched canonical 22-player identity');
  return Object.freeze({
   engineId:p.id,team:p.team,role:p.role,x:p.x,y:p.y
  });
 }));
 // Stale/hypothetical future evidence: decline, use normal mover.
 if(physicsTick!==cue.sourceTick||movementFrame.tick!==physicsTick||
    cue.decisionTick!==physicsTick+1||
    cue.ballX!==ballPosition.x||cue.ballY!==ballPosition.y||
    cue.ballZ!==ballPosition.z)return null;
 const geometry=inspectUniformPolicyGeometry({
  tick:physicsTick,playerId:cue.playerId,
  ballPosition,physicalPlayerPositions:positions
 });
 if(!geometry.shotRange||!geometry.shotLaneFound)return null;
 return Object.freeze({
  ...cue,version:REQUALIFIED_SHOT_MOVEMENT_CUE_VERSION,
  requalifiedAtPhysicsTick:physicsTick,
  nextMovementTick:physicsTick+1,
  currentOriginalShotLaneFound:true,
  source:'private-current-pre-step-rapier-ball-and-canonical-mover',
  verifiedNextShoeStart:false,verifiedPhysicalKickEligibility:false,
  physicalActionAuthorized:false,impulseAuthorized:false,
  officialMatchAction:false
 });
}
