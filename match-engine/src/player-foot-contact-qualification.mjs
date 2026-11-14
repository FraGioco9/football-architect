// ME-PB-08: classify observed Rapier pair-events, NEVER gameplay touches.
// Evidence categories describe event streams, not possession, kicking or intent.
// Retain only the most recent end tick per canonical player (at most 22).
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {FOOT_CONTACT_TIMELINE_VERSION} from './player-foot-contact-timeline.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from './player-foot-contact-solver.mjs';
import {FOOT_MOMENTUM_AUDIT_VERSION} from './player-foot-contact-momentum.mjs';

export const FOOT_CONTACT_QUALIFICATION_VERSION='me-pb-08-event-qualification-v1';
export const FOOT_REPEAT_WINDOW_TICKS=12; // Provisional observation window, NOT ball control.
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const known=new Set(ids),empty=Object.freeze([]);
const ordered=(arr,name)=>{
 if(!Array.isArray(arr))throw new TypeError('Canonical '+name+' array required');
 let previous=-1;
 for(const row of arr){
  const id=row?.id,idx=ids.indexOf(id);
  if(!known.has(id)||idx<=previous)throw new TypeError('Canonical unique ordered '+name+' required');
  previous=idx;
 }
 return new Map(arr.map(row=>[row.id,row]));
};
const frozen=a=>Object.freeze(a);
export function createFootContactQualification(){
 let tick=0,latestEnd=new Map();
 let state=Object.freeze({
  version:FOOT_CONTACT_QUALIFICATION_VERSION,tick:0,category:'none',
  onsets:empty,completions:empty,activeIds:empty,
  forceReportedIds:empty,unreportedOnsetForceIds:empty,
  ambiguityReasons:empty,attribution:'unresolved',possessionInferred:false
 });
 function observe(timeline,solver,momentum){
  if(!timeline||timeline.version!==FOOT_CONTACT_TIMELINE_VERSION||
    !solver||solver.version!==FOOT_SOLVER_EVIDENCE_VERSION||
    !momentum||momentum.version!==FOOT_MOMENTUM_AUDIT_VERSION||
    !Number.isInteger(timeline.tick)||timeline.tick!==tick+1||
    solver.tick!==timeline.tick||momentum.tick!==timeline.tick||
    momentum.attribution!=='unresolved'||
    momentum.exclusiveFootMomentumTransferProven!==false)
   throw new RangeError('Consecutive aligned real 60Hz contact evidence required');
  const starts=ordered(timeline.onsets,'onsets');
  const ends=ordered(timeline.completed,'completions');
  const active=ordered(timeline.ongoing,'ongoing contacts');
  const pairs=ordered(solver.pairs,'solver pair evidence');
  const compared=ordered(momentum.pairs,'momentum pair evidence');
  if(timeline.simultaneous!==(active.size>=2)||
     !Number.isInteger(solver.reportedForcePairs)||solver.reportedForcePairs<0||
     typeof solver.simultaneousSolverPairs!=='boolean'||
     !Number.isInteger(momentum.reportedFootPairCount)||
     momentum.reportedFootPairCount!==solver.reportedForcePairs||
     pairs.size!==compared.size||[...pairs.keys()].some(id=>!compared.has(id))||
     [...starts.keys(),...ends.keys(),...active.keys()].some(id=>!pairs.has(id)))
   throw new RangeError('Inconsistent Rapier collision/solver/momentum evidence');
  let forceCount=0;
  for(const [id,p] of pairs){
   const corresponding=compared.get(id);
   if(typeof p.rapierForceReported!=='boolean'||
      p.beganThisTick!==starts.has(id)||
      p.endedThisTick!==ends.has(id)||
      p.collisionActive!==active.has(id)||
      corresponding.rapierForceReported!==p.rapierForceReported)
    throw new RangeError('Rapier pair flags differ from collision timeline');
   if(p.rapierForceReported){
    forceCount++;
    if(typeof corresponding.pairImpulseMagnitudeNs!=='number'||
       !Number.isFinite(corresponding.pairImpulseMagnitudeNs)||
       corresponding.pairImpulseMagnitudeNs<0)
     throw new TypeError('Measured Rapier pair impulse required');
   }else if(corresponding.pairImpulseMagnitudeNs!==null){
    throw new TypeError('Absent Rapier force must be null, not inferred');
   }
  }
  if(forceCount!==solver.reportedForcePairs||
     solver.simultaneousSolverPairs!==(forceCount>=2))
   throw new RangeError('Inconsistent Rapier force-pair counts');
  const recent=new Map(latestEnd);
  // Bounded retention; an expired prior collision must not create "repeat".
  for(const [id,end] of recent)if(timeline.tick-end>FOOT_REPEAT_WINDOW_TICKS)
   recent.delete(id);
  const onsetRows=[];
  for(const [id,onset] of starts){
   if(onset.tick!==timeline.tick||typeof onset.relativeSpeedMps!=='number'||
      !Number.isFinite(onset.relativeSpeedMps)||onset.relativeSpeedMps<0||
      (active.has(id)&&ends.has(id))||
      (latestEnd.has(id)&&latestEnd.get(id)>=timeline.tick))
    throw new TypeError('Invalid physical onset evidence');
   const last=recent.get(id);
   onsetRows.push(Object.freeze({
    id,tick:timeline.tick,
    occurrence:last===undefined?'isolated':'repeat-within-window',
    previousEndTick:last??null,
    rapierForceReported:pairs.get(id).rapierForceReported
   }));
  }
  const completionRows=[];
  for(const [id,c] of ends){
   if(!Number.isInteger(c.startTick)||c.startTick<1||
      c.endTick!==timeline.tick||
      !Number.isInteger(c.durationTicks)||c.durationTicks<0||
      c.durationTicks!==timeline.tick-c.startTick||
      !['zero-sample','single-tick','multi-tick'].includes(c.kind)||
      c.kind!==(c.durationTicks===0?'zero-sample':
        c.durationTicks===1?'single-tick':'multi-tick')||
      (starts.has(id)&&c.startTick!==timeline.tick)||
      (latestEnd.has(id)&&c.startTick<=latestEnd.get(id)))
    throw new TypeError('Invalid completed Rapier collision episode');
   completionRows.push(Object.freeze({
    id,startTick:c.startTick,endTick:c.endTick,
    durationTicks:c.durationTicks,kind:c.kind
   }));
   recent.set(id,c.endTick);
  }
  for(const [id,o] of active){
   if(!Number.isInteger(o.startTick)||o.startTick<1||
      !Number.isInteger(o.observedTicks)||
      o.observedTicks!==timeline.tick-o.startTick+1||
      o.observedTicks<1||ends.has(id)||
      (starts.has(id)&&o.startTick!==timeline.tick))
    throw new TypeError('Invalid active Rapier event episode');
  }
  const reasons=[];
  if(active.size>=2)reasons.push('multiple-active-pairs');
  if(forceCount>=2)reasons.push('multiple-solver-force-pairs');
  if(starts.size>=2)reasons.push('multiple-onsets-same-tick');
  if(ends.size>=2)reasons.push('multiple-completions-same-tick');
  const hasEvidence=starts.size>0||ends.size>0||active.size>0||forceCount>0;
  const zeroSample=completionRows.some(c=>c.kind==='zero-sample');
  const repeated=onsetRows.some(o=>o.occurrence==='repeat-within-window');
  const category=reasons.length?'multi-pair-ambiguous':
    zeroSample?'zero-sample-uncertain':
    repeated?'repeated-event':
    hasEvidence?'single-pair-event':'none';
  const unreported=[...starts.keys()].filter(id=>!pairs.get(id).rapierForceReported);
  const next=Object.freeze({
   version:FOOT_CONTACT_QUALIFICATION_VERSION,tick:timeline.tick,category,
   onsets:frozen(onsetRows),completions:frozen(completionRows),
   activeIds:frozen([...active.keys()]),
   forceReportedIds:frozen(ids.filter(id=>pairs.get(id)?.rapierForceReported)),
   unreportedOnsetForceIds:frozen(unreported),
   ambiguityReasons:frozen(reasons),
   attribution:'unresolved',possessionInferred:false
  });
  // No observer state commits until ALL three source snapshots validate.
  latestEnd=recent;tick=timeline.tick;state=next;
  return next;
 }
 return Object.freeze({observe,snapshot:()=>state});
}
