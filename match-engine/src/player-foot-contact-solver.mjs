// ME-PB-06 — immutable, observational Rapier solver evidence for ball/shoe pairs.
// No proximity-derived events, no attribution of ball Δv, no kicking or possession.
// Paired contact-force events are authoritative; manifold normals are geometry.
// The derived N·s quantity is one fixed-step event force times dt, not a
// separately reported raw Rapier impulse or a calibrated football kick.
import {INITIAL_PLAYERS,PLAYER_DT} from './player-movement.mjs';
import {FOOT_CONTACT_VERSION} from './player-foot-contact.mjs';

export const FOOT_SOLVER_EVIDENCE_VERSION='me-pb-06-rapier-pair-force-v1';
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const known=new Set(ids),empty=Object.freeze([]);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const unit=(v,label,allowZero=false)=>{
 if(!v||!['x','y','z'].every(k=>finite(v[k])))
  throw new TypeError('Finite 3D '+label+' required');
 const length=Math.hypot(v.x,v.y,v.z);
 if(!allowZero && Math.abs(length-1)>0.005 ||
    allowZero&&length>0.005&&Math.abs(length-1)>0.005)
  throw new RangeError('Unit 3D '+label+' required');
 return Object.freeze({x:v.x,y:v.y,z:v.z});
};
const vector=(v,label)=>{
 if(!v||!['x','y','z'].every(k=>finite(v[k])))
  throw new TypeError('Finite 3D '+label+' required');
 return Object.freeze({x:v.x,y:v.y,z:v.z});
};
function ordered(values,label){
 if(!Array.isArray(values))throw new TypeError('Canonical '+label+' array required');
 let last=-1;
 for(const id of values){
  const i=ids.indexOf(id);
  if(i<=last||!known.has(id))
   throw new TypeError('Canonical unique ordered '+label+' IDs required');
  last=i;
 }
 return new Set(values);
}
export function summarizeFootSolverEvidence(collision,forceReports,manifoldReports){
 if(!collision||collision.version!==FOOT_CONTACT_VERSION||
   !Number.isInteger(collision.tick)||collision.tick<1)
  throw new RangeError('Canonical current 60Hz Rapier collision frame required');
 const active=ordered(collision.active,'active'),started=ordered(collision.started,'started');
 const ended=ordered(collision.ended,'ended');
 if(!Array.isArray(forceReports)||!Array.isArray(manifoldReports))
  throw new TypeError('Rapier force/manifold arrays required');
 const forces=new Map(),normals=new Map();
 for(const row of forceReports){
  if(!row||!known.has(row.id)||forces.has(row.id))
   throw new TypeError('Unique canonical ball/shoe pair force event required');
  const force=vector(row.totalForceWorldN,'Rapier total force');
  const forceMagnitude=Math.hypot(force.x,force.y,force.z);
  const total=row.totalForceMagnitudeN,max=row.maxContactForceMagnitudeN;
  // Rapier's event aggregates may be rounded at different stages (f32).
  // Keep physically meaningful inequalities, allowing at most 0.01% relative
  // roundoff rather than an absolute 1e-5 N cap on a hundreds-of-N impact.
  const tolerance=1e-4*Math.max(1,forceMagnitude,finite(total)?total:0,
    finite(max)?max:0);
  if(!finite(total)||!finite(max)||total<0||max<0||
    forceMagnitude>total+tolerance||max>total+tolerance)
   throw new RangeError('Consistent nonnegative Rapier pair force magnitudes required'+
     ' (net='+forceMagnitude+', sum='+total+', max='+max+', tolerance='+tolerance+')');
  const direction=unit(row.maxContactForceDirectionWorld,'max-force direction',max===0);
  const impulse=Object.freeze({
   x:force.x*PLAYER_DT,y:force.y*PLAYER_DT,z:force.z*PLAYER_DT
  });
  forces.set(row.id,Object.freeze({
   rapierForceReported:true,
   totalForceWorldN:force,totalForceMagnitudeN:total,
   maxContactForceMagnitudeN:max,
   maxContactForceDirectionWorld:direction,
   derivedNetImpulseWorldNs:impulse,
   derivedNetImpulseMagnitudeNs:forceMagnitude*PLAYER_DT,
   derivedSumOfForceMagnitudesNs:total*PLAYER_DT
  }));
 }
 for(const row of manifoldReports){
  if(!row||!known.has(row.id)||typeof row.flipped!=='boolean'||
     !Number.isInteger(row.geometricContacts)||row.geometricContacts<0||
     !Number.isInteger(row.solverContacts)||row.solverContacts<0)
   throw new TypeError('Canonical Rapier contact manifold sample required');
  const normal=unit(row.normalWorld,'Rapier world manifold normal');
  const arr=normals.get(row.id)??[];
  arr.push(Object.freeze({
   normalWorld:normal,flipped:row.flipped,
   geometricContacts:row.geometricContacts,solverContacts:row.solverContacts
  }));
  normals.set(row.id,arr);
 }
 const pairs=Object.freeze(ids.filter(id=>
  active.has(id)||started.has(id)||ended.has(id)||
  forces.has(id)||normals.has(id)).map(id=>Object.freeze({
   id,collisionActive:active.has(id),
   beganThisTick:started.has(id),endedThisTick:ended.has(id),
   manifolds:Object.freeze(normals.get(id)??[]),
   ...(forces.get(id)??{
    rapierForceReported:false,
    totalForceWorldN:null,totalForceMagnitudeN:null,
    maxContactForceMagnitudeN:null,
    maxContactForceDirectionWorld:null,
    derivedNetImpulseWorldNs:null,
    derivedNetImpulseMagnitudeNs:null,
    derivedSumOfForceMagnitudesNs:null
   })
  })));
 return Object.freeze({
  version:FOOT_SOLVER_EVIDENCE_VERSION,tick:collision.tick,
  pairs,reportedForcePairs:forces.size,
  simultaneousSolverPairs:pairs.filter(p=>p.rapierForceReported).length>=2
 });
}
