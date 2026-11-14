// ME-PB-17 — immutable, observational boundary between real Rapier contact
// and intentional ball intervention. Node-only research helper, not an engine
// input. Tactical pressing/facing, contact START and pair-force samples are
// never an authenticated user/AI command to pass, shoot, tackle or possess.
import {INITIAL_PLAYERS,PLAYER_DT,PLAYER_VERSION}
 from './player-movement.mjs';
import {FOOT_CONTACT_TIMELINE_VERSION}
 from './player-foot-contact-timeline.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION}
 from './player-foot-contact-solver.mjs';

export const FOOT_ACTION_OBSERVABILITY_VERSION='me-pb-17-action-source-boundary-v1';
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const known=new Set(ids);
const empty=Object.freeze([]);
const forbidden=Object.freeze([
 'ballAction','ballActionCommand','kickCommand','shotCommand','passCommand',
 'tackleCommand','confirmedTouch','possessor','ballOwner'
]);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function assertNoActionClaims(obj,label){
 for(const k of forbidden)
  if(Object.hasOwn(obj,k))
   throw new TypeError('Unsupported '+label+' action claim: '+k);
}
function canonicalRows(rows,label){
 if(!Array.isArray(rows))throw new TypeError('Canonical '+label+' array required');
 const seen=new Map();let prior=-1;
 for(const row of rows){
  const id=row?.id,index=ids.indexOf(id);
  if(!known.has(id)||index<=prior||seen.has(id))
   throw new TypeError('Canonical ordered unique '+label+' IDs required');
  seen.set(id,row);prior=index;
 }
 return seen;
}
export function inspectFootActionObservability(movement,timeline,solver){
 if(!movement||movement.version!==PLAYER_VERSION||
    !Number.isInteger(movement.tick)||movement.tick<1||
    !finite(movement.timeS)||
    Math.abs(movement.timeS-movement.tick*PLAYER_DT)>1e-8||
    !timeline||timeline.version!==FOOT_CONTACT_TIMELINE_VERSION||
    !solver||solver.version!==FOOT_SOLVER_EVIDENCE_VERSION||
    timeline.tick!==movement.tick||solver.tick!==movement.tick)
  throw new RangeError('Aligned real 60Hz movement, timeline and Rapier solver required');
 assertNoActionClaims(movement,'movement frame');
 if(!Array.isArray(movement.players)||
    movement.players.length!==INITIAL_PLAYERS.length||
    !movement.pressers||typeof movement.pressers!=='object')
  throw new TypeError('Canonical 22-player positional movement required');
 for(let i=0;i<INITIAL_PLAYERS.length;i++){
  const p=movement.players[i],original=INITIAL_PLAYERS[i];
  if(!p||p.id!==original.id||p.team!==original.team||
     p.role!==original.role||!finite(p.x)||!finite(p.y)||
     !finite(p.facingRad)||!finite(p.vx)||!finite(p.vy))
   throw new TypeError('Canonical finite 22-player motion required');
  assertNoActionClaims(p,'player motion');
 }
 for(const team of ['home','away']){
  const id=movement.pressers[team];
  if(id!==null&&id!==undefined&&
    !INITIAL_PLAYERS.some(p=>p.id===id&&p.team===team))
   throw new TypeError('Canonical positional presser required');
 }
 const onsets=canonicalRows(timeline.onsets,'Rapier onset');
 const ongoing=canonicalRows(timeline.ongoing,'active contact');
 const completed=canonicalRows(timeline.completed,'Rapier completion');
 const pairs=canonicalRows(solver.pairs,'Rapier pair-force');
 if(timeline.simultaneous!==(ongoing.size>=2)||
    !Number.isInteger(solver.reportedForcePairs)||
    solver.reportedForcePairs<0||
    solver.simultaneousSolverPairs!==(solver.reportedForcePairs>=2))
  throw new RangeError('Inconsistent real Rapier pair counts');
 let reported=0;
 for(const [id,p] of pairs){
  if(p.beganThisTick!==onsets.has(id)||
     p.collisionActive!==ongoing.has(id)||
     p.endedThisTick!==completed.has(id)||
     typeof p.rapierForceReported!=='boolean')
   throw new RangeError('Rapier pair flags do not reconcile with event chronology');
  if(p.rapierForceReported){
   reported++;
   if(!finite(p.derivedNetImpulseMagnitudeNs)||
      p.derivedNetImpulseMagnitudeNs<0)
    throw new TypeError('Actual finite reported pair-force integral required');
  }else if(p.derivedNetImpulseMagnitudeNs!==null){
   throw new TypeError('Absent Rapier force report must remain null');
  }
 }
 if(reported!==solver.reportedForcePairs||
    [...onsets.keys(),...ongoing.keys(),...completed.keys()]
     .some(id=>!pairs.has(id)))
  throw new RangeError('Missing or contradictory real Rapier pair evidence');
 const physicalIds=ids.filter(id=>pairs.has(id));
 const observations=Object.freeze(physicalIds.map(id=>{
  const player=movement.players[ids.indexOf(id)];
  const onset=onsets.get(id),pair=pairs.get(id);
  if(onset&&(!finite(onset.relativeSpeedMps)||
      onset.relativeSpeedMps<0||
      !['planar-centerline-projection','indeterminate']
       .includes(onset.geometry)))
   throw new TypeError('Finite observed planar relative-motion sample required');
  const sampled=onset?.geometry==='planar-centerline-projection';
  if(sampled&&
   ['closingSpeedMps','separatingSpeedMps','tangentialSpeedMps']
    .some(k=>!finite(onset[k])||onset[k]<0))
   throw new TypeError('Nonnegative measured projected approach required');
  const phase=onsets.has(id)&&completed.has(id)?'same-step-start-end':
    onsets.has(id)?'start':completed.has(id)?'end':
    ongoing.has(id)?'continuing':'solver-only-sample';
  return Object.freeze({
   id,phase,
   positionalPressingRole:movement.pressers[player.team]===id,
   relativeSpeedAtStartMps:onset?.relativeSpeedMps??null,
   closingSpeedAtStartMps:sampled?onset.closingSpeedMps:null,
   separatingSpeedAtStartMps:sampled?onset.separatingSpeedMps:null,
   tangentialSpeedAtStartMps:sampled?onset.tangentialSpeedMps:null,
   approachEvidenceGeometry:onset?.geometry??null,
   rapierForceReported:pair.rapierForceReported,
   reportedPairNetForceIntegralNs:pair.derivedNetImpulseMagnitudeNs,
   // No command/command-source is emitted by the autonomous movement frame.
   explicitBallActionCommand:null,
   actionCommandProvenance:'absent',
   playerIntentInferred:false,individualFootImpulseProven:false,
   confirmedTouch:false,possessionInferred:false
  });
 }));
 return Object.freeze({
  version:FOOT_ACTION_OBSERVABILITY_VERSION,tick:movement.tick,
  source:'canonical-22-player-positional-motion-and-real-rapier',
  observations,physicalPairCount:observations.length,
  realCollisionStarts:onsets.size,reportedPairForceSamples:reported,
  sourceHasExplicitBallActionCommand:false,
  actionCommandProvenance:'absent',actionEligibility:'not-established',
  requiredNextSource:'separate-validated-ball-intervention-command',
  playerIntentInferred:false,individualFootImpulseProven:false,
  confirmedTouch:false,possessionInferred:false,
  attribution:'unresolved'
 });
}
