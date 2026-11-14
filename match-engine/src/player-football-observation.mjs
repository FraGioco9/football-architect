// P2 preflight: bounded read-only projection of the existing 60Hz physical
// fixture frame. This is STRUCTURAL validation, never source authentication,
// an affordance oracle, a shoe-contact witness or an action executor.
import {INITIAL_PLAYERS} from './player-movement.mjs';

export const FOOTBALL_OBSERVATION_PROJECTION_VERSION=
 'me-p2-read-only-observed-frame-draft-v1';
const phases=new Set(['ball-opportunity','attack-off-ball','defend-off-ball']);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const validTick=n=>Number.isSafeInteger(n)&&n>0;
const fail=()=>{throw new TypeError(
 'A same-tick canonical-shaped physical fixture snapshot is required'
);};

// Must only be called from the canonical runtime's internally obtained frame.
// Shape checking alone cannot establish that a caller did not forge a frame.
export function projectObservedFootballContext(physicalFrame,{playerId,phase}={}){
 const tick=physicalFrame?.physicsTick;
 const position=physicalFrame?.ball?.position;
 const positions=physicalFrame?.physicalPlayerPositions;
 if(!validTick(tick)||
    physicalFrame.experimentalLocalOnly!==true||
    physicalFrame.matchRuntimeIntegrated!==false||
    physicalFrame.officialMatchAction!==false||
    physicalFrame.contactSource!=='internal-real-rapier-60hz'||
    physicalFrame.footContact?.tick!==tick||
    physicalFrame.autonomousMovement?.physicsTick!==tick||
    !position||!finite(position.x)||!finite(position.y)||
    !finite(position.z)||
    !Array.isArray(positions)||!Object.isFrozen(positions)||
    positions.length!==INITIAL_PLAYERS.length||
    !phases.has(phase))
  fail();
 const actor=INITIAL_PLAYERS.find(p=>p.id===playerId);
 if(!actor)fail();
 const players=Object.freeze(positions.map((p,i)=>{
  const expected=INITIAL_PLAYERS[i];
  if(!p||!Object.isFrozen(p)||p.engineId!==expected.id||
     p.team!==expected.team||p.role!==expected.role||
     !finite(p.x)||!finite(p.y))fail();
  return Object.freeze({id:p.engineId,team:p.team,x:p.x,y:p.y});
 }));
 return Object.freeze({
  physicsTick:tick,playerId,team:actor.team,phase,
  frame:Object.freeze({
   tick,ball:Object.freeze({x:position.x,y:position.y,z:position.z}),
   players
  }),
  // Deliberately zero eligible candidates: only a separately reviewed,
  // source-bound perception policy can propose an action to P1.
  affordances:Object.freeze([])
 });
}
