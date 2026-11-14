// ME-PB-10 — read-only 60Hz ball direction vs Rapier shoe-force evidence.
// A ball velocity change has MANY possible causes (grass, gravity, other
// contacts and solver details). Absolute cosines deliberately discard manifold
// orientation/sign and never establish a kick, causal impulse or possession.
import {INITIAL_PLAYERS,PLAYER_DT} from './player-movement.mjs';
import {FOOT_CONTACT_VERSION} from './player-foot-contact.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from './player-foot-contact-solver.mjs';
import {FOOT_MOMENTUM_AUDIT_VERSION} from './player-foot-contact-momentum.mjs';
import {FOOT_CONTACT_QUALIFICATION_VERSION} from './player-foot-contact-qualification.mjs';

export const FOOT_DIRECTIONAL_RESPONSE_VERSION='me-pb-10-directional-response-v1';
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const vector=(v,label)=>{
 if(!v||!['x','y','z'].every(k=>finite(v[k])))
  throw new TypeError('Finite 3D '+label+' required');
 return Object.freeze({x:v.x,y:v.y,z:v.z});
};
const norm=v=>Math.hypot(v.x,v.y,v.z);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const absCos=(a,b)=>{
 const sizes=norm(a)*norm(b);
 return sizes>1e-12?Math.min(1,Math.abs(dot(a,b)/sizes)):null;
};
const cosine2=(a,b)=>{
 const va=Math.hypot(a.x,a.y),vb=Math.hypot(b.x,b.y);
 if(va*vb<=1e-12)return null;
 return Math.max(-1,Math.min(1,(a.x*b.x+a.y*b.y)/(va*vb)));
};
const close=(a,b)=>Math.abs(a-b)<=1e-4*Math.max(1,Math.abs(a),Math.abs(b));
const ordered=(rows,label)=>{
 if(!Array.isArray(rows))throw new TypeError('Canonical '+label+' array required');
 let last=-1;
 for(const item of rows){
  const index=ids.indexOf(item?.id);
  if(index<=last)throw new TypeError('Canonical ordered unique '+label+' IDs required');
  last=index;
 }
 return rows;
};
const orderedIds=(values,label)=>{
 if(!Array.isArray(values))throw new TypeError('Canonical '+label+' IDs required');
 let prev=-1;
 for(const id of values){
  const index=ids.indexOf(id);
  if(index<=prev)throw new TypeError('Canonical ordered unique '+label+' IDs required');
  prev=index;
 }
 return values;
};
export function measureFootDirectionalResponse(before,after,events,solver,
 audit,qualification,massKg){
 if(!before||!after||typeof before.version!=='string'||!before.version||
    before.version!==after.version||!Number.isInteger(before.tick)||before.tick<0||
    after.tick!==before.tick+1||!finite(before.time)||!finite(after.time)||
    Math.abs(before.time-before.tick*PLAYER_DT)>1e-9||
    Math.abs(after.time-after.tick*PLAYER_DT)>1e-9||
    !finite(massKg)||massKg<=0)
  throw new RangeError('Consecutive mass-measured 60Hz canonical ball samples required');
 if(!events||events.version!==FOOT_CONTACT_VERSION||
    !solver||solver.version!==FOOT_SOLVER_EVIDENCE_VERSION||
    !audit||audit.version!==FOOT_MOMENTUM_AUDIT_VERSION||
    !qualification||qualification.version!==FOOT_CONTACT_QUALIFICATION_VERSION||
    [events,solver,audit,qualification].some(x=>x.tick!==after.tick)||
    audit.attribution!=='unresolved'||audit.exclusiveFootMomentumTransferProven!==false||
    qualification.attribution!=='unresolved'||qualification.possessionInferred!==false)
  throw new TypeError('Aligned real Rapier event/solver/momentum/qualification required');
 const incoming=vector(before.ball?.velocity,'incoming ball velocity');
 const outgoing=vector(after.ball?.velocity,'outgoing ball velocity');
 const dv=Object.freeze({
  x:outgoing.x-incoming.x,
  y:outgoing.y-incoming.y,
  z:outgoing.z-incoming.z
 });
 const observedMomentum=vector(audit.ballDeltaLinearMomentumWorldNs,'measured ball momentum delta');
 for(const k of ['x','y','z']){
  if(!close(observedMomentum[k],dv[k]*massKg))
   throw new RangeError('Measured Rapier ball mass and momentum disagree');
 }
 const started=orderedIds(events.started,'started'),ended=orderedIds(events.ended,'ended');
 const active=orderedIds(events.active,'active');
 const onsets=ordered(qualification.onsets,'qualifier onsets');
 const completions=ordered(qualification.completions,'qualifier completions');
 const reportedIds=orderedIds(qualification.forceReportedIds,'reported force');
 const activeIds=orderedIds(qualification.activeIds,'active pairs');
 const pairs=ordered(solver.pairs,'solver pairs');
 const comparisons=ordered(audit.pairs,'momentum pairs');
 const eq=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
 if(!eq(started,onsets.map(x=>x.id))||!eq(ended,completions.map(x=>x.id))||
    !eq(active,activeIds)||pairs.length!==comparisons.length||
    !eq(pairs.map(x=>x.id),comparisons.map(x=>x.id))||
    !eq(pairs.filter(x=>x.rapierForceReported).map(x=>x.id),reportedIds)||
    solver.reportedForcePairs!==reportedIds.length||
    audit.reportedFootPairCount!==reportedIds.length||
    solver.simultaneousSolverPairs!==(reportedIds.length>=2))
  throw new RangeError('Physical event and observer pair identity mismatch');
 const perPair=pairs.map((pair,i)=>{
  const mirror=comparisons[i],force=pair.rapierForceReported;
  if(typeof force!=='boolean'||mirror.rapierForceReported!==force||
      pair.beganThisTick!==started.includes(pair.id)||
      pair.endedThisTick!==ended.includes(pair.id)||
      pair.collisionActive!==active.includes(pair.id)||
      !Array.isArray(pair.manifolds))
   throw new TypeError('Pair flags mismatch true Rapier collider event');
  const present=force?vector(pair.totalForceWorldN,'reported pair force'):null;
  const actualImpulse=force?vector(pair.derivedNetImpulseWorldNs,'reported pair impulse'):null;
  if(force){
   if(!finite(pair.derivedNetImpulseMagnitudeNs)||
      pair.derivedNetImpulseMagnitudeNs<0||
      !finite(mirror.pairImpulseMagnitudeNs)||
      mirror.pairImpulseMagnitudeNs<0||
      !close(norm(actualImpulse),mirror.pairImpulseMagnitudeNs)||
      !close(norm(actualImpulse),pair.derivedNetImpulseMagnitudeNs)||
      ['x','y','z'].some(k=>!close(actualImpulse[k],present[k]*PLAYER_DT)))
    throw new TypeError('Rapier reported force/impulse integrals inconsistent');
  }else if(pair.totalForceWorldN!==null||
           pair.derivedNetImpulseWorldNs!==null||
           pair.derivedNetImpulseMagnitudeNs!==null||
           mirror.pairImpulseMagnitudeNs!==null){
   throw new TypeError('No Rapier pair force event must be explicitly null');
  }
  const normalDirs=[];
  for(const m of pair.manifolds){
   if(!m||!Number.isInteger(m.solverContacts)||m.solverContacts<0)
    throw new TypeError('Solver contact count required');
   if(!m.solverContacts)continue;
   const n=vector(m.normalWorld,'Rapier manifold normal');
   if(Math.abs(norm(n)-1)>0.005)
    throw new RangeError('Rapier world manifold normal must be unit length');
   normalDirs.push(n);
  }
  const maxProjection=normalDirs.length?
    Math.max(...normalDirs.map(n=>Math.abs(dot(dv,n)))):null;
  const alignment=normalDirs.length?
    normalDirs.map(n=>absCos(dv,n)).filter(x=>x!==null):[];
  return Object.freeze({
   id:pair.id,beganThisTick:pair.beganThisTick,
   endedThisTick:pair.endedThisTick,collisionActive:pair.collisionActive,
   onsetOccurrence:onsets.find(x=>x.id===pair.id)?.occurrence??null,
   rapierForceReported:force,
   reportedPairNetImpulseMagnitudeNs:force?mirror.pairImpulseMagnitudeNs:null,
   absForceVsBallDeltaVelocityCosine:force?absCos(present,dv):null,
   absForceVsNormalCosine:force?mirror.maxAbsForceNormalAlignment:null,
   maxAbsBallDeltaVelocityVsNormalCosine:alignment.length?Math.max(...alignment):null,
   maxAbsBallDeltaVelocityNormalProjectionMps:maxProjection,
   solverManifoldCount:normalDirs.length
  });
 });
 const planarCos=cosine2(incoming,outgoing);
 return Object.freeze({
  version:FOOT_DIRECTIONAL_RESPONSE_VERSION,tick:after.tick,
  incomingBallVelocityWorldMps:incoming,outgoingBallVelocityWorldMps:outgoing,
  ballDeltaVelocityWorldMps:dv,ballDeltaVelocityMagnitudeMps:norm(dv),
  ballSpeedChangeMps:norm(outgoing)-norm(incoming),
  planarDirectionCosine:planarCos,
  planarTurningAngleDeg:planarCos===null?null:Math.acos(planarCos)*180/Math.PI,
  planarReversalObserved:planarCos===null?null:planarCos<0,
  measuredBallMomentumMagnitudeNs:norm(observedMomentum),
  perPair:Object.freeze(perPair),
  reportedForcePairCount:reportedIds.length,
  collisionOnsetCount:started.length,
  attribution:'unresolved',possessionInferred:false,
  causalFootImpulseProven:false
 });
}
