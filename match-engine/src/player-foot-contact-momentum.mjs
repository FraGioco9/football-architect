// ME-PB-07 — a per-step, strictly read-only 3D momentum provenance audit.
// Source A: measured canonical ball mass × actual ball delta velocity.
// Source B: independently reported Rapier ball/foot pair forces × fixed dt.
// DO NOT equate, subtract, or attribute A to B: gravity, grass, drag, spin,
// possible CCD substeps, multiple colliders and force direction all matter.
// Absolute normal alignment describes geometry, never possession or a kick.
import {INITIAL_PLAYERS,PLAYER_DT} from './player-movement.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from './player-foot-contact-solver.mjs';

export const FOOT_MOMENTUM_AUDIT_VERSION='me-pb-07-momentum-provenance-v1';
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const v3=(value,label)=>{
 if(!value||!['x','y','z'].every(k=>finite(value[k])))
  throw new TypeError('Finite 3D '+label+' required');
 return Object.freeze({x:value.x,y:value.y,z:value.z});
};
const mag=v=>Math.hypot(v.x,v.y,v.z);
const tolerance=(a,b)=>Math.abs(a-b)<=
  1e-4*Math.max(1,Math.abs(a),Math.abs(b));
function canonical(ball,label){
 if(!ball||typeof ball.version!=='string'||!ball.version||
   !Number.isInteger(ball.tick)||ball.tick<0||!finite(ball.time)||
   Math.abs(ball.time-ball.tick*PLAYER_DT)>1e-9)
  throw new TypeError('Canonical synchronized '+label+' 60Hz sample required');
 return v3(ball.ball?.velocity,label+' ball velocity');
}
export function summarizeFootMomentumAudit(before,after,solver,ballMassKg){
 const initial=canonical(before,'pre-step'),final=canonical(after,'post-step');
 if(before.version!==after.version||after.tick!==before.tick+1||
   !solver||solver.version!==FOOT_SOLVER_EVIDENCE_VERSION||
   solver.tick!==after.tick||
   !Array.isArray(solver.pairs)||!Number.isInteger(solver.reportedForcePairs)||
   solver.reportedForcePairs<0||
   typeof solver.simultaneousSolverPairs!=='boolean'||
   !finite(ballMassKg)||ballMassKg<=0)
  throw new RangeError('Consistent measured Rapier tick, solver evidence and ball mass required');
 const linearDelta=Object.freeze({
  x:(final.x-initial.x)*ballMassKg,
  y:(final.y-initial.y)*ballMassKg,
  z:(final.z-initial.z)*ballMassKg
 });
 let lastIndex=-1,reported=0,totalFootReportedImpulseMagnitude=0;
 const comparisons=[];
 for(const pair of solver.pairs){
  const idx=pair&&ids.indexOf(pair.id);
  if(!Number.isInteger(idx)||idx<=lastIndex||
     typeof pair.rapierForceReported!=='boolean'||
     !Array.isArray(pair.manifolds))
   throw new TypeError('Canonical unique Rapier pair evidence required');
  lastIndex=idx;
  if(!pair.rapierForceReported){
   if(pair.totalForceWorldN!==null||pair.derivedNetImpulseWorldNs!==null||
     pair.derivedNetImpulseMagnitudeNs!==null)
    throw new TypeError('Absent Rapier force must preserve null measurements');
   comparisons.push(Object.freeze({
    id:pair.id,rapierForceReported:false,
    pairImpulseMagnitudeNs:null,
    maxAbsForceNormalAlignment:null,
    availableSolverManifolds:0
   }));
   continue;
  }
  reported++;
  const force=v3(pair.totalForceWorldN,'pair total force');
  const impulse=v3(pair.derivedNetImpulseWorldNs,'pair derived impulse');
  const forceMagnitude=mag(force),impulseMagnitude=mag(impulse);
  if(!finite(pair.derivedNetImpulseMagnitudeNs)||
     pair.derivedNetImpulseMagnitudeNs<0||
     !finite(pair.totalForceMagnitudeN)||pair.totalForceMagnitudeN<0||
     !tolerance(impulse.x,force.x*PLAYER_DT)||
     !tolerance(impulse.y,force.y*PLAYER_DT)||
     !tolerance(impulse.z,force.z*PLAYER_DT)||
     !tolerance(impulseMagnitude,pair.derivedNetImpulseMagnitudeNs))
   throw new TypeError('Rapier force-to-tick impulse conversion is inconsistent');
  totalFootReportedImpulseMagnitude+=impulseMagnitude;
  let alignment=null,available=0;
  for(const m of pair.manifolds){
   if(!m||!Number.isInteger(m.solverContacts)||m.solverContacts<0)
    throw new TypeError('Canonical Rapier solver manifold required');
   if(m.solverContacts===0)continue;
   const normal=v3(m.normalWorld,'world manifold normal'),nmag=mag(normal);
   if(Math.abs(nmag-1)>0.005)
    throw new RangeError('Unit Rapier world manifold normal required');
   available++;
   if(forceMagnitude>0){
    const cosine=Math.min(1,Math.abs(
     (force.x*normal.x+force.y*normal.y+force.z*normal.z)/forceMagnitude
    ));
    alignment=alignment===null?cosine:Math.max(alignment,cosine);
   }
  }
  comparisons.push(Object.freeze({
   id:pair.id,rapierForceReported:true,
   pairImpulseMagnitudeNs:impulseMagnitude,
   maxAbsForceNormalAlignment:alignment,
   availableSolverManifolds:available
  }));
 }
 if(reported!==solver.reportedForcePairs||
   solver.simultaneousSolverPairs!==(reported>=2))
  throw new RangeError('Rapier reported-force pair count inconsistent');
 return Object.freeze({
  version:FOOT_MOMENTUM_AUDIT_VERSION,tick:after.tick,
  ballDeltaLinearMomentumWorldNs:linearDelta,
  ballDeltaLinearMomentumMagnitudeNs:mag(linearDelta),
  // An unsigned sum of independently recorded pair magnitudes. NOT net ball
  // impulse, and never a momentum conservation or owner attribution check.
  reportedFootPairImpulseMagnitudesSumNs:totalFootReportedImpulseMagnitude,
  reportedFootPairCount:reported,
  pairs:Object.freeze(comparisons),
  attribution:'unresolved',
  // A real ball's delta momentum also includes ground/gravity/aero/other
  // forces and potential discrete solver details, even for one foot event.
  exclusiveFootMomentumTransferProven:false
 });
}
