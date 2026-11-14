// ME-PB-19 — unverified next-tick ball-action inbox, NOT an action scheduler.
// Research-only quarantine; zero authorization, dispatch, impulse or possession.
// An asserted human/AI origin is untrusted, even if the ME-PB-18 shape is valid.
import {INITIAL_PLAYERS,PLAYER_VERSION,PLAYER_DT}
 from './player-movement.mjs';
import {BALL_ACTION_PROPOSAL_VERSION,BALL_ACTION_PROPOSAL_TYPES,
 BALL_ACTION_DECLARED_ORIGINS} from './player-ball-action-proposal.mjs';

export const BALL_ACTION_QUARANTINE_VERSION='me-pb-19-untrusted-quarantine-v1';
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const empty=Object.freeze([]);
const forbidden=Object.freeze([
 'ballAction','ballActionCommand','kickCommand','shotCommand','passCommand',
 'tackleCommand','confirmedTouch','possessor','ballOwner'
]);
const snapshotKeys=Object.freeze([
 'version','tick','candidates','candidateCount','status','originProvenance',
 'authorization','requiresExternalAuthority','eligibleForPhysics',
 'intentEstablished','confirmedTouch','possessionInferred'
]);
const candidateKeys=Object.freeze([
 'version','declaredOrigin','playerId','sequence','issuedAtTick','targetTick',
 'action','aim','effort01','declaredOriginVerified','commandAuthorized',
 'eligibleForPhysics'
]);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
function exactPlain(v,fields,label){
 if(!plain(v)||Reflect.ownKeys(v).length!==fields.length||
    fields.some(k=>!Object.hasOwn(v,k))||
    Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>!Object.hasOwn(d,'value')))
  throw new TypeError('Exact data-only '+label+' fields required');
}
function validateMovement(frame,tick){
 if(!frame||frame.version!==PLAYER_VERSION||frame.tick!==tick||
    !finite(frame.timeS)||Math.abs(frame.timeS-tick*PLAYER_DT)>1e-8||
    !Array.isArray(frame.players)||frame.players.length!==ids.length)
  throw new RangeError('Consecutive canonical real 60Hz movement required');
 for(const key of forbidden)
  if(Object.hasOwn(frame,key))
   throw new TypeError('Positional frame cannot authorize actions');
 for(let i=0;i<ids.length;i++){
  const p=frame.players[i],canonical=INITIAL_PLAYERS[i];
  if(!p||p.id!==canonical.id||p.team!==canonical.team||
     p.role!==canonical.role||p.number!==canonical.number||
     !finite(p.x)||!finite(p.y)||!finite(p.vx)||!finite(p.vy)||
     !finite(p.facingRad))
   throw new TypeError('Canonical ordered finite 22-player frame required');
  for(const key of forbidden)
   if(Object.hasOwn(p,key))
    throw new TypeError('Player motion cannot authorize ball actions');
 }
}
function validateSnapshot(snapshot,tick,lastSequences){
 exactPlain(snapshot,snapshotKeys,'proposal snapshot');
 if(snapshot.version!==BALL_ACTION_PROPOSAL_VERSION||
    snapshot.tick!==tick||snapshot.authorization!=='not-established'||
    snapshot.requiresExternalAuthority!=='authenticated-ball-action-command-source'||
    snapshot.eligibleForPhysics!==false||
    snapshot.intentEstablished!==false||
    snapshot.confirmedTouch!==false||
    snapshot.possessionInferred!==false||
    !Array.isArray(snapshot.candidates)||
    snapshot.candidates.length>ids.length||
    snapshot.candidateCount!==snapshot.candidates.length||
    snapshot.status!==(snapshot.candidates.length?'format-valid-only':'no-candidate')||
    snapshot.originProvenance!==(snapshot.candidates.length?'unverified':'absent'))
  throw new RangeError('Aligned and untrusted candidate snapshot required');
 const nextSequences=new Map(lastSequences);
 const records=[];
 let previous=-1;
 for(const p of snapshot.candidates){
  exactPlain(p,candidateKeys,'candidate');
  const index=ids.indexOf(p.playerId);
  if(p.version!==BALL_ACTION_PROPOSAL_VERSION||index<=previous||
     !BALL_ACTION_DECLARED_ORIGINS.includes(p.declaredOrigin)||
     !BALL_ACTION_PROPOSAL_TYPES.includes(p.action)||
     !Number.isSafeInteger(p.sequence)||p.sequence<1||
     p.issuedAtTick!==tick||p.targetTick!==tick+1||
     !Number.isSafeInteger(p.targetTick)||
     !finite(p.effort01)||p.effort01<0||p.effort01>1||
     p.declaredOriginVerified!==false||p.commandAuthorized!==false||
     p.eligibleForPhysics!==false)
   throw new TypeError('Canonical unverified next-tick candidate required');
  exactPlain(p.aim,['x','y'],'candidate unit aim');
  const norm=Math.hypot(p.aim.x,p.aim.y);
  if(!finite(p.aim.x)||!finite(p.aim.y)||!finite(norm)||
     Math.abs(norm-1)>1e-6)
   throw new RangeError('Finite unit XY aim required');
  const key=p.declaredOrigin+'|'+p.playerId;
  if(p.sequence<=(nextSequences.get(key)??0))
   throw new RangeError('Duplicate or stale proposal sequence at quarantine boundary');
  nextSequences.set(key,p.sequence);
  previous=index;
  // Keep only descriptive provenance/timing. Nothing executable survives.
  records.push(Object.freeze({
   playerId:p.playerId,declaredOrigin:p.declaredOrigin,
   sequence:p.sequence,issuedAtTick:tick,targetTick:tick+1,
   actionLabel:p.action,
   sourceVerified:false,commandAuthorized:false,eligibleForPhysics:false,
   physicalActionDispatched:false,
   decision:'quarantined-unverified-source'
  }));
 }
 return Object.freeze({
  records:records.length?Object.freeze(records):empty,
  nextSequences
 });
}
function report(tick,quarantined,expired){
 return Object.freeze({
  version:BALL_ACTION_QUARANTINE_VERSION,tick,
  quarantinedThisTick:quarantined,
  expiredUnverifiedThisTick:expired,
  outstandingQuarantine:quarantined,
  quarantinedCount:quarantined.length,
  expiredCount:expired.length,
  outstandingCount:quarantined.length,
  sourceVerification:'not-established',
  commandAuthorization:'not-established',
  eligibleCommandCount:0,dispatchedCommandCount:0,
  actorIntentEstablished:false,confirmedTouch:false,
  possessionInferred:false,
  nextDependency:'separate-authenticated-command-source-and-authoritative-scheduler'
 });
}

// The only exposed operation is observe(). No approve/release/dispatch method.
// Every tentative candidate is quarantined for exactly one 60Hz tick and then
// expires *unconsumed*. A future trusted authoritative adapter must be designed
// separately; this module cannot be promoted by supplying an "authorized" field.
export function createBallActionQuarantine(){
 let tick=0,previousQuarantine=empty,lastSequences=new Map();
 let current=report(0,empty,empty);
 function observe(movement,proposalSnapshot){
  validateMovement(movement,tick+1);
  const next=validateSnapshot(proposalSnapshot,tick+1,lastSequences);
  if(previousQuarantine.some(p=>p.targetTick!==tick+1))
   throw new RangeError('Unresolved stale quarantine chronology');
  const nextReport=report(tick+1,next.records,previousQuarantine);
  // Commit all state only after *all* candidate and chronology checks pass.
  tick++;previousQuarantine=next.records;
  lastSequences=next.nextSequences;current=nextReport;
  return current;
 }
 return Object.freeze({observe,snapshot:()=>current,
  reset:createBallActionQuarantine});
}
