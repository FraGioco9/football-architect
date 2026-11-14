// ME-PB-18 — strictly observational candidate ball-action input contract.
// This module is NOT imported by Rapier, movement, browser, server or match rules.
// Format validity and a claimed source are NEVER authentication or authorization.
import {INITIAL_PLAYERS,PLAYER_DT,PLAYER_VERSION}
 from './player-movement.mjs';

export const BALL_ACTION_PROPOSAL_VERSION='me-pb-18-untrusted-action-proposal-v1';
export const BALL_ACTION_PROPOSAL_TYPES=Object.freeze([
 'pass','shot','clearance'
]);
export const BALL_ACTION_DECLARED_ORIGINS=Object.freeze([
 'human-candidate','ai-candidate'
]);
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const empty=Object.freeze([]);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const forbiddenFrameFields=Object.freeze([
 'ballAction','ballActionCommand','kickCommand','shotCommand','passCommand',
 'tackleCommand','confirmedTouch','possessor','ballOwner'
]);
const requiredFields=Object.freeze([
 'version','declaredOrigin','playerId','sequence','issuedAtTick',
 'targetTick','action','aim','effort01'
]);
const plain=obj=>obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&
 (Object.getPrototypeOf(obj)===Object.prototype||
  Object.getPrototypeOf(obj)===null);
function exactKeys(obj,required,what){
 if(!plain(obj)||Object.keys(obj).length!==required.length||
    required.some(k=>!Object.hasOwn(obj,k)))
  throw new TypeError('Exact '+what+' fields required (no action or authority injection)');
}
function canonicalMovementFrame(frame,nextTick){
 if(!frame||frame.version!==PLAYER_VERSION||
    !Number.isSafeInteger(frame.tick)||frame.tick!==nextTick||
    !finite(frame.timeS)||
    Math.abs(frame.timeS-frame.tick*PLAYER_DT)>1e-8||
    !Array.isArray(frame.players)||frame.players.length!==ids.length)
  throw new RangeError('Consecutive canonical 60Hz player frame required');
 for(const k of forbiddenFrameFields)
  if(Object.hasOwn(frame,k))
   throw new TypeError('Positional movement cannot carry a ball action: '+k);
 for(let i=0;i<ids.length;i++){
  const p=frame.players[i],original=INITIAL_PLAYERS[i];
  if(!p||p.id!==original.id||p.team!==original.team||
     p.number!==original.number||p.role!==original.role||
     !finite(p.x)||!finite(p.y)||!finite(p.vx)||!finite(p.vy)||
     !finite(p.facingRad))
   throw new TypeError('Canonical ordered finite 22-player motion required');
  for(const k of forbiddenFrameFields)
   if(Object.hasOwn(p,k))
    throw new TypeError('Player motion cannot carry a ball action: '+k);
 }
}
function normalize(raw,frameTick){
 exactKeys(raw,requiredFields,'candidate action proposal');
 if(raw.version!==BALL_ACTION_PROPOSAL_VERSION||
    !BALL_ACTION_DECLARED_ORIGINS.includes(raw.declaredOrigin)||
    !ids.includes(raw.playerId)||
    !BALL_ACTION_PROPOSAL_TYPES.includes(raw.action))
  throw new TypeError('Known candidate action version, origin, player and type required');
 if(!Number.isSafeInteger(raw.sequence)||raw.sequence<1)
  throw new RangeError('Positive safe sequence required');
 if(raw.issuedAtTick!==frameTick||
    raw.targetTick!==frameTick+1||
    !Number.isSafeInteger(raw.targetTick))
  throw new RangeError('Candidate must be issued on the current tick for exactly next tick');
 exactKeys(raw.aim,['x','y'],'unit XY aim');
 const length=Math.hypot(raw.aim.x,raw.aim.y);
 if(!finite(raw.aim.x)||!finite(raw.aim.y)||
    !finite(length)||Math.abs(length-1)>1e-6)
  throw new RangeError('Finite unit XY aim required (not a velocity or impulse)');
 if(!finite(raw.effort01)||raw.effort01<0||raw.effort01>1)
  throw new RangeError('Bounded normalized proposal effort [0,1] required');
 return Object.freeze({
  version:BALL_ACTION_PROPOSAL_VERSION,
  declaredOrigin:raw.declaredOrigin,
  playerId:raw.playerId,sequence:raw.sequence,
  issuedAtTick:frameTick,targetTick:frameTick+1,
  action:raw.action,
  aim:Object.freeze({x:raw.aim.x,y:raw.aim.y}),
  effort01:raw.effort01,
  declaredOriginVerified:false,
  commandAuthorized:false,
  eligibleForPhysics:false
 });
}
const makeSnapshot=(tick,proposals)=>Object.freeze({
 version:BALL_ACTION_PROPOSAL_VERSION,
 tick,
 candidates:proposals,
 candidateCount:proposals.length,
 status:proposals.length?'format-valid-only':'no-candidate',
 originProvenance:proposals.length?'unverified':'absent',
 authorization:'not-established',
 requiresExternalAuthority:'authenticated-ball-action-command-source',
 eligibleForPhysics:false,
 intentEstablished:false,
 confirmedTouch:false,
 possessionInferred:false
});

// One bounded, consecutive 60Hz research record (0..22 candidates per tick).
// Per declared-origin/player counters prevent local duplicate sequence reuse.
// They do not authenticate claimed origins or prevent spoofing by a caller.
export function createBallActionProposalObserver(){
 let tick=0,lastSequences=new Map(),current=makeSnapshot(0,empty);
 function observe(frame,candidates=[]){
  canonicalMovementFrame(frame,tick+1);
  if(!Array.isArray(candidates)||candidates.length>ids.length)
   throw new TypeError('Bounded canonical candidate action array required');
  const nextSequences=new Map(lastSequences),normalized=[];
  let priorIndex=-1;
  for(const raw of candidates){
   const p=normalize(raw,frame.tick);
   const index=ids.indexOf(p.playerId);
   if(index<=priorIndex)
    throw new TypeError('Unique canonical player order required for candidate proposals');
   priorIndex=index;
   const key=p.declaredOrigin+'|'+p.playerId;
   if(p.sequence<=(nextSequences.get(key)??0))
    throw new RangeError('Duplicate or stale declared proposal sequence');
   nextSequences.set(key,p.sequence);
   normalized.push(p);
  }
  // Atomic: failed validation changes neither chronology nor sequence state.
  const next=makeSnapshot(frame.tick,
   normalized.length?Object.freeze(normalized):empty);
  tick=frame.tick;lastSequences=nextSequences;current=next;
  return current;
 }
 return Object.freeze({observe,snapshot:()=>current});
}
