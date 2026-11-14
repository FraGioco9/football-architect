// ME-PB-11 — bounded read-only physical collision episode audit.
// An episode starts ONLY at a real Rapier START and completes ONLY at END.
// Two distinct observables: ball momentum change across the whole episode
// and the sum of actually REPORTED pair-force samples (not all net forces).
// Neither their difference nor their ratio is attributed to a single foot.
// ME-PB-05 durationTicks excludes the end tick; sampled ticks include it.
import {INITIAL_PLAYERS,PLAYER_DT} from './player-movement.mjs';
import {FOOT_CONTACT_TIMELINE_VERSION} from './player-foot-contact-timeline.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from './player-foot-contact-solver.mjs';
import {FOOT_DIRECTIONAL_RESPONSE_VERSION} from './player-foot-contact-direction.mjs';

export const FOOT_EPISODE_AUDIT_VERSION='me-pb-11-physical-episode-audit-v1';
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const empty=Object.freeze([]);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const vec=(v,label)=>{
 if(!v||!['x','y','z'].every(k=>finite(v[k])))
  throw new TypeError('Finite 3D '+label+' required');
 return Object.freeze({x:v.x,y:v.y,z:v.z});
};
const norm=v=>Math.hypot(v.x,v.y,v.z);
const close=(a,b)=>Math.abs(a-b)<=1e-4*Math.max(1,Math.abs(a),Math.abs(b));
const ordered=(a,label)=>{
 if(!Array.isArray(a))throw new TypeError('Canonical '+label+' required');
 let last=-1;
 for(const row of a){
  const index=ids.indexOf(row?.id);
  if(index<=last)throw new TypeError('Unique ordered '+label+' required');
  last=index;
 }
 return a;
};
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const turn=(a,b)=>{
 const mag=Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y);
 if(mag<=1e-12)return null;
 const value=Math.max(-1,Math.min(1,(a.x*b.x+a.y*b.y)/mag));
 return Math.acos(value)*180/Math.PI;
};
const copy=entry=>({
 ...entry,impulse:{...entry.impulse}
});
export function createFootContactEpisodeAudit(){
 let tick=0,open=new Map();
 let current=Object.freeze({
  version:FOOT_EPISODE_AUDIT_VERSION,tick:0,
  completed:empty,openIds:empty,
  attribution:'unresolved',possessionInferred:false,
  exclusiveFootImpulseProven:false
 });
 function observe(before,after,timeline,solver,direction,massKg){
  if(!before||!after||!timeline||!solver||!direction||
     typeof before.version!=='string'||!before.version||
     before.version!==after.version||
     !Number.isInteger(before.tick)||before.tick!==tick||
     after.tick!==tick+1||!finite(before.time)||!finite(after.time)||
     !close(before.time,tick*PLAYER_DT)||
     !close(after.time,(tick+1)*PLAYER_DT)||
     timeline.version!==FOOT_CONTACT_TIMELINE_VERSION||
     solver.version!==FOOT_SOLVER_EVIDENCE_VERSION||
     direction.version!==FOOT_DIRECTIONAL_RESPONSE_VERSION||
     timeline.tick!==after.tick||solver.tick!==after.tick||
     direction.tick!==after.tick||
     direction.attribution!=='unresolved'||
     direction.possessionInferred!==false||
     direction.causalFootImpulseProven!==false||
     !finite(massKg)||massKg<=0)
   throw new RangeError('Consecutive aligned real 60Hz physical episode sources required');
  const startVelocity=vec(before.ball?.velocity,'pre-step ball velocity');
  const endVelocity=vec(after.ball?.velocity,'post-step ball velocity');
  const calculatedDelta=vec({
   x:endVelocity.x-startVelocity.x,
   y:endVelocity.y-startVelocity.y,
   z:endVelocity.z-startVelocity.z
  },'observed ball velocity difference');
  if(!['x','y','z'].every(k=>
    close(direction.incomingBallVelocityWorldMps?.[k],startVelocity[k])&&
    close(direction.outgoingBallVelocityWorldMps?.[k],endVelocity[k])&&
    close(direction.ballDeltaVelocityWorldMps?.[k],calculatedDelta[k])))
   throw new RangeError('Directional response does not match measured 3D ball motion');
  const onsets=ordered(timeline.onsets,'Rapier starts');
  const completed=ordered(timeline.completed,'Rapier completed');
  const ongoing=ordered(timeline.ongoing,'Rapier active');
  const forces=ordered(solver.pairs,'Rapier pair forces');
  const pairDirection=ordered(direction.perPair,'Rapier directional pair evidence');
  if(!same(forces.map(p=>p.id),pairDirection.map(p=>p.id))||
     direction.collisionOnsetCount!==onsets.length||
     direction.reportedForcePairCount!==forces.filter(p=>p.rapierForceReported).length||
     solver.reportedForcePairs!==direction.reportedForcePairCount||
     !Array.isArray(direction.perPair)||
     solver.simultaneousSolverPairs!==(solver.reportedForcePairs>=2))
   throw new TypeError('Canonical solver, direction and episode evidence disagree');
  const starts=new Set(onsets.map(p=>p.id));
  const ends=new Set(completed.map(p=>p.id));
  const active=new Set(ongoing.map(p=>p.id));
  const next=new Map([...open].map(([id,entry])=>[id,copy(entry)]));
  for(const start of onsets){
   if(start.tick!==after.tick||next.has(start.id))
    throw new RangeError('Real Rapier start must open one previously closed pair');
   const directionPair=pairDirection.find(p=>p.id===start.id);
   if(!directionPair||!directionPair.beganThisTick||
      !['isolated','repeat-within-window'].includes(directionPair.onsetOccurrence))
    throw new TypeError('Rapier onset qualification required');
   next.set(start.id,{
    id:start.id,startTick:after.tick,
    startVelocity,ballMassKg:massKg,
    onsetOccurrence:directionPair.onsetOccurrence,
    sampledTickCount:0,reportedForceTickCount:0,
    unreportedForceTickCount:0,
    geometrySolverManifoldSamples:0,impulse:{x:0,y:0,z:0},
    reportedImpulseMagnitudesSumNs:0,
    observedOverlappingPair:false
   });
  }
  const touched=new Set([...active,...ends]);
  for(const id of starts)touched.add(id);
  for(const id of touched)if(!next.has(id))
   throw new RangeError('Rapier active/end pair lacks physical start');
  for(const [id,e] of next){
   if(!close(e.ballMassKg,massKg))
    throw new TypeError('Physical ball mass cannot change mid-episode');
   const p=forces.find(x=>x.id===id);
   const d=pairDirection.find(x=>x.id===id);
   if(!p||!d||p.collisionActive!==active.has(id)||
      p.beganThisTick!==starts.has(id)||
      p.endedThisTick!==ends.has(id)||
      d.collisionActive!==p.collisionActive||
      d.beganThisTick!==p.beganThisTick||
      d.endedThisTick!==p.endedThisTick||
      typeof p.rapierForceReported!=='boolean'||
      d.rapierForceReported!==p.rapierForceReported)
    throw new TypeError('Rapier pair status differs from observed episode state');
   if(!touched.has(id))throw new RangeError('Open Rapier collision vanished without END');
   e.sampledTickCount++;
   e.observedOverlappingPair||=
    active.size>=2||solver.reportedForcePairs>=2||starts.size>=2||ends.size>=2;
   if(!Number.isInteger(d.solverManifoldCount)||d.solverManifoldCount<0)
    throw new TypeError('Measured solver manifold count required');
   e.geometrySolverManifoldSamples+=d.solverManifoldCount;
   if(p.rapierForceReported){
    const forceImpulse=vec(p.derivedNetImpulseWorldNs,'Rapier derived pair impulse');
    const magnitude=norm(forceImpulse);
    if(!finite(d.reportedPairNetImpulseMagnitudeNs)||
       !close(magnitude,d.reportedPairNetImpulseMagnitudeNs))
     throw new RangeError('Actual reported force integral inconsistent');
    e.reportedForceTickCount++;
    for(const key of ['x','y','z'])e.impulse[key]+=forceImpulse[key];
    e.reportedImpulseMagnitudesSumNs+=magnitude;
   }else{
    if(p.derivedNetImpulseWorldNs!==null||
       d.reportedPairNetImpulseMagnitudeNs!==null)
     throw new TypeError('Missing Rapier force event must remain null');
    e.unreportedForceTickCount++;
   }
  }
  const finished=[];
  for(const row of completed){
   const e=next.get(row.id);
   if(!e||!Number.isInteger(row.startTick)||row.startTick!==e.startTick||
      row.endTick!==after.tick||!Number.isInteger(row.durationTicks)||
      row.durationTicks!==after.tick-e.startTick||
      row.durationTicks<0||
      row.kind!==(row.durationTicks===0?'zero-sample':
       row.durationTicks===1?'single-tick':'multi-tick')||
      e.sampledTickCount!==row.durationTicks+1)
    throw new TypeError('Measured whole-episode lifetime mismatch');
   const start=e.startVelocity,finish=endVelocity;
   const ballDelta=Object.freeze({
    x:(finish.x-start.x)*massKg,
    y:(finish.y-start.y)*massKg,
    z:(finish.z-start.z)*massKg
   });
   const hasReported=e.reportedForceTickCount>0;
   const netImpulse=hasReported?Object.freeze({...e.impulse}):null;
   finished.push(Object.freeze({
    id:row.id,startTick:e.startTick,endTick:after.tick,
    durationTicks:row.durationTicks,kind:row.kind,
    sampledTickCount:e.sampledTickCount,
    onsetOccurrence:e.onsetOccurrence,
    reportedForceTickCount:e.reportedForceTickCount,
    unreportedForceTickCount:e.unreportedForceTickCount,
    completeReportedForceCoverage:e.unreportedForceTickCount===0,
    solverManifoldSamples:e.geometrySolverManifoldSamples,
    observedOverlappingPair:e.observedOverlappingPair,
    incomingBallVelocityWorldMps:start,
    outgoingBallVelocityWorldMps:finish,
    observedBallMomentumDeltaWorldNs:ballDelta,
    observedBallMomentumDeltaMagnitudeNs:norm(ballDelta),
    observedBallPlanarTurnAngleDeg:turn(start,finish),
    reportedPairNetImpulseWorldNs:netImpulse,
    reportedPairNetImpulseMagnitudeNs:netImpulse?norm(netImpulse):null,
    reportedPairImpulseMagnitudesSumNs:
     hasReported?e.reportedImpulseMagnitudesSumNs:null,
    // Never a per-player residual. Other forces and possible other
    // contacts contribute to the observed global ball momentum change.
    attribution:'unresolved',possessionInferred:false,
    exclusiveFootImpulseProven:false
   }));
   next.delete(row.id);
  }
  if(!same(ids.filter(id=>next.has(id)),ongoing.map(p=>p.id))||
     [...ongoing].some(row=>!Number.isInteger(row.startTick)||
       row.startTick!==next.get(row.id)?.startTick||
       row.observedTicks!==after.tick-row.startTick+1))
   throw new RangeError('Rapier active episode count/lifetime mismatch');
  const report=Object.freeze({
   version:FOOT_EPISODE_AUDIT_VERSION,tick:after.tick,
   completed:Object.freeze(finished),
   openIds:Object.freeze(ids.filter(id=>next.has(id))),
   attribution:'unresolved',possessionInferred:false,
   exclusiveFootImpulseProven:false
  });
  // Commit only after every source and frame has validated.
  open=next;tick=after.tick;current=report;
  return report;
 }
 return Object.freeze({observe,snapshot:()=>current});
}
