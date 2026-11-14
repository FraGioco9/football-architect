// ME-PB-21 — deterministic *proposed* session/player/controller mapping.
// Research-only audit: a constructor-supplied binding plan is UNTRUSTED.
// Even an exact match cannot authenticate a controller or authorize a kick.
// Never imported by Rapier, the browser, the backend or official fixtures.
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {BALL_ACTION_DECLARED_ORIGINS,BALL_ACTION_PROPOSAL_TYPES}
 from './player-ball-action-proposal.mjs';
import {BALL_ACTION_SOURCE_BOUNDARY_VERSION,BALL_ACTION_TRUST_REQUIREMENTS}
 from './player-ball-action-source-boundary.mjs';

export const BALL_CONTROLLER_PLAN_VERSION='me-pb-21-untrusted-controller-plan-v1';
export const BALL_CONTROLLER_AUDIT_VERSION='me-pb-21-controller-binding-audit-v1';
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const empty=Object.freeze([]);
const label=/^[a-z0-9][a-z0-9._:-]*$/;
const planKeys=Object.freeze(['version','declaredMatchEpoch','bindings']);
const bindingKeys=Object.freeze([
 'playerId','declaredOrigin','claimedSourceRef','proposedControllerRef',
 'validFromTick','validThroughTick'
]);
const boundaryKeys=Object.freeze([
 'version','tick','claimsMatchedStructurally',
 'unmatchedQuarantinedCandidates','quarantinedCandidates',
 'expiredWithoutExecution','expiredPlayerIds','trustRequirements',
 'sourceAuthentication','controllerBinding','matchEpochAuthority',
 'scheduler','sourceVerifiedCount','authorizedCommands',
 'executableCommands','dispatchedCommands','playerIntentEstablished',
 'confirmedTouch','possessionInferred'
]);
const rowKeys=Object.freeze([
 'playerId','declaredOrigin','sequence','targetTick','actionLabel',
 'bindingClaimPresent','claimedSourceRef','claimedMatchEpoch',
 'claimConsistency','sourceAuthenticated','controllerPermissionProven',
 'matchEpochAuthoritative','commandAuthorized','eligibleForPhysics',
 'dispatched'
]);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||
  Object.getPrototypeOf(v)===null);
function exact(v,keys,labelText){
 if(!plain(v)||Reflect.ownKeys(v).length!==keys.length||
    keys.some(k=>!Object.hasOwn(v,k))||
    Object.values(Object.getOwnPropertyDescriptors(v))
     .some(d=>!Object.hasOwn(d,'value')))
  throw new TypeError('Exact data-only '+labelText+' required');
}
function sourceLabel(value){
 return typeof value==='string'&&value.length>0&&value.length<=48&&
  label.test(value);
}
function overlaps(a,b){
 return a.validFromTick<=b.validThroughTick&&
  b.validFromTick<=a.validThroughTick;
}
function normalizePlan(raw){
 exact(raw,planKeys,'proposed controller plan');
 if(raw.version!==BALL_CONTROLLER_PLAN_VERSION||
    !sourceLabel(raw.declaredMatchEpoch)||
    !Array.isArray(raw.bindings)||raw.bindings.length>44)
  throw new TypeError('Bounded untrusted match epoch and binding plan required');
 const bindings=[];let priorPlayerIndex=-1,priorStart=0;
 for(const row of raw.bindings){
  exact(row,bindingKeys,'proposed controller binding');
  const index=ids.indexOf(row.playerId);
  if(index<0||!BALL_ACTION_DECLARED_ORIGINS.includes(row.declaredOrigin)||
    !sourceLabel(row.claimedSourceRef)||
    !sourceLabel(row.proposedControllerRef)||
    !Number.isSafeInteger(row.validFromTick)||
    !Number.isSafeInteger(row.validThroughTick)||
    row.validFromTick<1||row.validThroughTick<row.validFromTick||
    row.validThroughTick>3600||
    row.validThroughTick-row.validFromTick>600||
    index<priorPlayerIndex||
    (index===priorPlayerIndex&&row.validFromTick<=priorStart))
   throw new TypeError('Canonical bounded sorted session/controller plan required');
  priorPlayerIndex=index;priorStart=row.validFromTick;
  const copied=Object.freeze({...row});
  for(const other of bindings){
   if(!overlaps(copied,other))continue;
   if(other.playerId===copied.playerId||
      other.proposedControllerRef===copied.proposedControllerRef||
      (copied.declaredOrigin==='human-candidate'&&
       other.declaredOrigin==='human-candidate'&&
       other.claimedSourceRef===copied.claimedSourceRef))
    throw new RangeError('Overlapping player/controller/human-source plan rejected');
  }
  bindings.push(copied);
 }
 return Object.freeze({version:BALL_CONTROLLER_PLAN_VERSION,
  declaredMatchEpoch:raw.declaredMatchEpoch,
  bindings:Object.freeze(bindings)});
}
function inspectBoundary(boundary,tick,priorIds){
 exact(boundary,boundaryKeys,'ME-PB-20 boundary evidence');
 if(boundary.version!==BALL_ACTION_SOURCE_BOUNDARY_VERSION||
    boundary.tick!==tick||
    boundary.sourceAuthentication!=='unavailable'||
    boundary.controllerBinding!=='unavailable'||
    boundary.matchEpochAuthority!=='unavailable'||
    boundary.scheduler!=='not-connected'||
    boundary.sourceVerifiedCount!==0||boundary.authorizedCommands!==0||
    boundary.dispatchedCommands!==0||
    boundary.playerIntentEstablished!==false||
    boundary.confirmedTouch!==false||
    boundary.possessionInferred!==false||
    !Array.isArray(boundary.executableCommands)||
    boundary.executableCommands.length!==0||
    !Array.isArray(boundary.trustRequirements)||
    boundary.trustRequirements.length!==BALL_ACTION_TRUST_REQUIREMENTS.length||
    boundary.trustRequirements.some((x,i)=>x!==BALL_ACTION_TRUST_REQUIREMENTS[i])||
    !Array.isArray(boundary.quarantinedCandidates)||
    boundary.quarantinedCandidates.length>ids.length||
    !Array.isArray(boundary.expiredPlayerIds)||
    boundary.expiredPlayerIds.length>ids.length)
  throw new RangeError('Aligned, non-authoritative ME-PB-20 evidence required');
 let last=-1,matched=0;
 for(const row of boundary.quarantinedCandidates){
  exact(row,rowKeys,'ME-PB-20 candidate evidence');
  const index=ids.indexOf(row.playerId);
  if(index<=last||
     !BALL_ACTION_DECLARED_ORIGINS.includes(row.declaredOrigin)||
     !BALL_ACTION_PROPOSAL_TYPES.includes(row.actionLabel)||
     !Number.isSafeInteger(row.sequence)||row.sequence<1||
     row.targetTick!==tick+1||
     typeof row.bindingClaimPresent!=='boolean'||
     row.sourceAuthenticated!==false||
     row.controllerPermissionProven!==false||
     row.matchEpochAuthoritative!==false||
     row.commandAuthorized!==false||row.eligibleForPhysics!==false||
     row.dispatched!==false)
   throw new TypeError('Ordered untrusted candidate evidence required');
  if(row.bindingClaimPresent){
   if(row.claimConsistency!=='matched-untrusted-declaration'||
      !sourceLabel(row.claimedSourceRef)||
      !sourceLabel(row.claimedMatchEpoch))
    throw new TypeError('Untrusted source/epoch claim shape required');
   matched++;
  }else if(row.claimConsistency!=='missing-declaration'||
    row.claimedSourceRef!==null||row.claimedMatchEpoch!==null)
   throw new TypeError('Missing source declaration cannot imply binding');
  last=index;
 }
 if(boundary.claimsMatchedStructurally!==matched||
    boundary.unmatchedQuarantinedCandidates!==
     boundary.quarantinedCandidates.length-matched||
    boundary.expiredWithoutExecution!==priorIds.length||
    boundary.expiredPlayerIds.length!==priorIds.length||
    boundary.expiredPlayerIds.some((id,i)=>id!==priorIds[i]))
  throw new RangeError('Untrusted source chronology or expiry inconsistent');
 return boundary.quarantinedCandidates;
}
function makeSnapshot(tick,plan,rows,expired){
 const observations=Object.freeze(rows.map(row=>{
  const planned=plan.bindings.find(b=>b.playerId===row.playerId&&
   b.validFromTick<=row.targetTick&&b.validThroughTick>=row.targetTick);
  const status=!row.bindingClaimPresent?'no-source-claim':
   !planned?'no-active-proposed-binding':
   row.claimedMatchEpoch!==plan.declaredMatchEpoch?'claimed-epoch-mismatch':
   row.claimedSourceRef!==planned.claimedSourceRef?'claimed-source-mismatch':
   row.declaredOrigin!==planned.declaredOrigin?'declared-origin-mismatch':
   'matches-untrusted-binding-plan';
  return Object.freeze({
   playerId:row.playerId,targetTick:row.targetTick,
   declaredOrigin:row.declaredOrigin,actionLabel:row.actionLabel,
   claimedMatchEpoch:row.claimedMatchEpoch,
   claimedSourceRef:row.claimedSourceRef,
   proposedControllerRef:planned?.proposedControllerRef??null,
   bindingStatus:status,
   planMatchOnly:status==='matches-untrusted-binding-plan',
   actorAuthenticated:false,controllerAuthenticated:false,
   sessionAuthoritative:false,commandAuthorized:false,
   eligibleForPhysics:false,dispatched:false
  });
 }));
 return Object.freeze({
  version:BALL_CONTROLLER_AUDIT_VERSION,tick,
  declaredMatchEpoch:plan.declaredMatchEpoch,
  proposedBindingsCount:plan.bindings.length,
  reviewedCandidates:observations,
  planMatches:observations.filter(x=>x.planMatchOnly).length,
  unmatchedCandidates:observations.filter(x=>!x.planMatchOnly).length,
  expiredUnconsumed:expired,
  authenticatedControllers:0,authorizedCommands:0,
  scheduler:'not-connected',schedulerQueue:empty,
  appliedBallActions:0,confirmedTouches:0,
  possessionInferred:false,
  authority:'unavailable'
 });
}
// The plan is an immutable *hypothesis*. Calling this factory does not mint
// authority. A future authenticated, server-owned adapter is separately needed.
export function createBallControllerBindingAudit(rawPlan){
 const plan=normalizePlan(rawPlan);
 let tick=0,priorIds=empty;
 let current=makeSnapshot(0,plan,empty,0);
 function observe(boundary){
  const rows=inspectBoundary(boundary,tick+1,priorIds);
  const next=makeSnapshot(tick+1,plan,rows,priorIds.length);
  // Atomic: neither tick nor prior expiry changes on invalid input.
  tick++;priorIds=Object.freeze(rows.map(r=>r.playerId));current=next;
  return current;
 }
 return Object.freeze({observe,snapshot:()=>current,
  reset:()=>createBallControllerBindingAudit(plan)});
}
