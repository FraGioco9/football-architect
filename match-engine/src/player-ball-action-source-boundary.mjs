// ME-PB-20 — declared command-source binding audit, NOT authentication.
// A claimant's actor/source/session strings cannot certify identity, consent,
// controller permissions, match authority, an executable kick, or possession.
// Node research only; NOT imported by Rapier, official matches or LAB UI.
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {BALL_ACTION_DECLARED_ORIGINS,BALL_ACTION_PROPOSAL_TYPES}
 from './player-ball-action-proposal.mjs';
import {BALL_ACTION_QUARANTINE_VERSION}
 from './player-ball-action-quarantine.mjs';

export const BALL_ACTION_SOURCE_BOUNDARY_VERSION='me-pb-20-source-boundary-v1';
export const BALL_ACTION_SOURCE_CLAIM_VERSION='me-pb-20-declared-binding-v1';
export const BALL_ACTION_TRUST_REQUIREMENTS=Object.freeze([
 'authenticated-actor-and-origin',
 'server-owned-match-epoch-and-controller-binding',
 'authoritative-next-tick-command-scheduler-and-replay-defense',
 'separately-calibrated-physical-eligibility-and-contact'
]);
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const empty=Object.freeze([]);
const fields=Object.freeze([
 'version','tick','quarantinedThisTick','expiredUnverifiedThisTick',
 'outstandingQuarantine','quarantinedCount','expiredCount','outstandingCount',
 'sourceVerification','commandAuthorization','eligibleCommandCount',
 'dispatchedCommandCount','actorIntentEstablished','confirmedTouch',
 'possessionInferred','nextDependency'
]);
const recordFields=Object.freeze([
 'playerId','declaredOrigin','sequence','issuedAtTick','targetTick',
 'actionLabel','sourceVerified','commandAuthorized','eligibleForPhysics',
 'physicalActionDispatched','decision'
]);
const claimFields=Object.freeze([
 'version','playerId','declaredOrigin','sequence',
 'issuedAtTick','targetTick','claimedSourceRef','claimedMatchEpoch'
]);
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 (Object.getPrototypeOf(o)===Object.prototype||
  Object.getPrototypeOf(o)===null);
function exact(o,keys,label){
 if(!plain(o)||Reflect.ownKeys(o).length!==keys.length||
   keys.some(k=>!Object.hasOwn(o,k))||
   Object.values(Object.getOwnPropertyDescriptors(o))
    .some(d=>!Object.hasOwn(d,'value')))
  throw new TypeError('Exact data-only '+label+' required');
}
function recordCheck(records,tick,expired,label){
 if(!Array.isArray(records)||records.length>ids.length)
  throw new TypeError('Bounded '+label+' rows required');
 const output=[];
 let previous=-1;
 for(const item of records){
  exact(item,recordFields,label);
  const index=ids.indexOf(item.playerId);
  if(index<=previous||!BALL_ACTION_DECLARED_ORIGINS.includes(item.declaredOrigin)||
     !BALL_ACTION_PROPOSAL_TYPES.includes(item.actionLabel)||
     !Number.isSafeInteger(item.sequence)||item.sequence<1||
     item.issuedAtTick!==(expired?tick-1:tick)||
     item.targetTick!==(expired?tick:tick+1)||
     item.sourceVerified!==false||item.commandAuthorized!==false||
     item.eligibleForPhysics!==false||
     item.physicalActionDispatched!==false||
     item.decision!=='quarantined-unverified-source')
   throw new TypeError('Ordered, real untrusted '+label+' evidence required');
  previous=index;
  output.push(item);
 }
 return output;
}
function equalRecords(a,b){
 return a.length===b.length&&a.every((row,i)=>
  recordFields.every(k=>row[k]===b[i][k]));
}
function validateQuarantine(q,nextTick,prior){
 exact(q,fields,'ME-PB-19 quarantine snapshot');
 if(q.version!==BALL_ACTION_QUARANTINE_VERSION||q.tick!==nextTick||
   q.sourceVerification!=='not-established'||
   q.commandAuthorization!=='not-established'||
   q.eligibleCommandCount!==0||q.dispatchedCommandCount!==0||
   q.actorIntentEstablished!==false||q.confirmedTouch!==false||
   q.possessionInferred!==false||
   q.nextDependency!==
    'separate-authenticated-command-source-and-authoritative-scheduler')
  throw new RangeError('Aligned, unverified and non-executable quarantine required');
 const pending=recordCheck(q.outstandingQuarantine,nextTick,false,'pending');
 const newly=recordCheck(q.quarantinedThisTick,nextTick,false,'new');
 const expired=recordCheck(q.expiredUnverifiedThisTick,nextTick,true,'expired');
 if(q.outstandingCount!==pending.length||
    q.quarantinedCount!==newly.length||
    q.expiredCount!==expired.length||
    !equalRecords(pending,newly)||
    !equalRecords(prior,expired))
  throw new RangeError('Quarantine chronology or counts inconsistent');
 return Object.freeze({pending,expired});
}
function normalizeClaims(claims,tick,pending,lastSequences){
 if(!Array.isArray(claims)||claims.length>ids.length)
  throw new TypeError('Bounded declared source claims required');
 const pendingById=new Map(pending.map(p=>[p.playerId,p]));
 const nextSequences=new Map(lastSequences),declared=new Map();
 let previous=-1;
 for(const claim of claims){
  exact(claim,claimFields,'source claim');
  const index=ids.indexOf(claim.playerId),p=pendingById.get(claim.playerId);
  if(index<=previous||!p||claim.version!==BALL_ACTION_SOURCE_CLAIM_VERSION||
    claim.declaredOrigin!==p.declaredOrigin||
    claim.sequence!==p.sequence||
    claim.issuedAtTick!==tick||claim.targetTick!==tick+1)
   throw new TypeError('Matching ordered unverified source claim required');
  for(const key of ['claimedSourceRef','claimedMatchEpoch']){
   if(typeof claim[key]!=='string'||claim[key].length>48||
      !/^[a-z0-9][a-z0-9._:-]*$/.test(claim[key]))
    throw new TypeError('Bounded untrusted source/epoch label required');
  }
  const k=claim.claimedMatchEpoch+'|'+claim.claimedSourceRef+'|'+claim.playerId;
  if(claim.sequence<=(nextSequences.get(k)??0))
   throw new RangeError('Locally replayed declared source sequence');
  nextSequences.set(k,claim.sequence);
  previous=index;
  declared.set(claim.playerId,claim);
 }
 return Object.freeze({declared,nextSequences});
}
function snapshot(tick,pending,expired,claims){
 const rows=Object.freeze(pending.map(p=>{
  const claim=claims.get(p.playerId);
  return Object.freeze({
   playerId:p.playerId,declaredOrigin:p.declaredOrigin,
   sequence:p.sequence,targetTick:p.targetTick,
   actionLabel:p.actionLabel,
   bindingClaimPresent:Boolean(claim),
   claimedSourceRef:claim?.claimedSourceRef??null,
   claimedMatchEpoch:claim?.claimedMatchEpoch??null,
   claimConsistency:claim?'matched-untrusted-declaration':'missing-declaration',
   sourceAuthenticated:false,controllerPermissionProven:false,
   matchEpochAuthoritative:false,commandAuthorized:false,
   eligibleForPhysics:false,dispatched:false
  });
 }));
 const matched=rows.filter(p=>p.bindingClaimPresent).length;
 return Object.freeze({
  version:BALL_ACTION_SOURCE_BOUNDARY_VERSION,tick,
  claimsMatchedStructurally:matched,
  unmatchedQuarantinedCandidates:rows.length-matched,
  quarantinedCandidates:rows,
  expiredWithoutExecution:expired.length,
  expiredPlayerIds:Object.freeze(expired.map(p=>p.playerId)),
  trustRequirements:BALL_ACTION_TRUST_REQUIREMENTS,
  sourceAuthentication:'unavailable',
  controllerBinding:'unavailable',
  matchEpochAuthority:'unavailable',
  scheduler:'not-connected',
  sourceVerifiedCount:0,authorizedCommands:0,
  executableCommands:empty,dispatchedCommands:0,
  playerIntentEstablished:false,confirmedTouch:false,
  possessionInferred:false
 });
}

// A consistent claim still proves only that two untrusted structures agree.
// Crucially there is no "verify", "mint capability", "authorize" or "dispatch"
// method. A trusted source and scheduler require a DIFFERENT future adapter.
export function createBallActionSourceBoundary(){
 let tick=0,prior=empty,lastSequences=new Map();
 let current=snapshot(0,empty,empty,new Map());
 function observe(quarantine,untrustedClaims=[]){
  const verified=validateQuarantine(quarantine,tick+1,prior);
  const normalized=normalizeClaims(untrustedClaims,tick+1,
   verified.pending,lastSequences);
  const next=snapshot(tick+1,verified.pending,
   verified.expired,normalized.declared);
  // All-or-nothing state transition after every guard has passed.
  tick++;prior=verified.pending;lastSequences=normalized.nextSequences;
  current=next;
  return current;
 }
 return Object.freeze({observe,snapshot:()=>current,
  reset:createBallActionSourceBoundary});
}
