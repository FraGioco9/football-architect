// Observe completed Rapier pass provenance only: never grant an action.
// Authenticity depends on the private internal fixture producer, not these
// structural checks on a caller-supplied object.
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {PHYSICAL_FIXTURE_CONTACT_FEED_VERSION}
 from './physical-fixture-step-runtime.mjs';
export const PASS_AUDIT_VERSION='me-p2-pass-provenance-readonly-v1';
const actors=new Map(INITIAL_PLAYERS.map(p=>[p.id,p]));
const fail=()=>{throw new TypeError('Inconsistent actual pass evidence');};
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function auditObservedPhysicalPassAttempt(f){
 const tick=f?.physicsTick,feed=f?.physicalContactFeed;
 const starts=feed?.started,active=feed?.active;
 const positions=f?.physicalPlayerPositions;
 if(!Number.isSafeInteger(tick)||tick<1||
    f.physicalRapierStep!==true||f.realFootEventsOnly!==true||
    f.officialMatchResult!==null||f.officialMatchPossession!==false||
    f.footContact?.tick!==tick||
    feed?.version!==PHYSICAL_FIXTURE_CONTACT_FEED_VERSION||
    feed.physicsTick!==tick||
    feed.contactSource!=='same-step-real-rapier-shoe-ball-collider'||
    !Array.isArray(starts)||!Array.isArray(active)||
    !Array.isArray(positions)||!Object.isFrozen(positions)||
    positions.length!==22||
    f.ballForceApplied!==(f.localAutonomousAction!==null))fail();
 for(let i=0;i<22;i++){
  const p=positions[i],expected=INITIAL_PLAYERS[i];
  if(!p||!Object.isFrozen(p)||p.engineId!==expected.id||
     p.team!==expected.team||p.role!==expected.role||
     !finite(p.x)||!finite(p.y))fail();
 }
 for(const list of [starts,active]){
  if(new Set(list.map(p=>p.engineId)).size!==list.length||
     list.some(p=>!p||!actors.has(p.engineId)||
      p.team!==actors.get(p.engineId).team))fail();
 }
 if(starts.some(p=>!active.some(a=>a.engineId===p.engineId)))fail();
 const exclusive=starts.length===1&&active.length===1&&
  starts[0].engineId===active[0].engineId;
 const a=f.localAutonomousAction;
 if(a!==null&&(!a||!exclusive||a.tick!==tick||
    a.playerId!==starts[0].engineId||a.team!==starts[0].team||
    a.physicalTrigger!=='same-tick-real-rapier-shoe-start'||
    a.appliedByRapier!==true||
    a.actualPhysicsImpulseApplied!==true||
    a.officialMatchAction!==false))fail();
 let pass=null;
 if(a?.action==='pass'){
  const target=a.passTarget,receiver=actors.get(a.recipientId);
  const pos=positions.find(p=>p.engineId===a.recipientId);
  if(!target||!receiver||!pos||receiver.team!==a.team||
     a.recipientId===a.playerId||
     target.source!=='same-tick-canonical-22-player-positions'||
     target.originPlayerId!==a.playerId||
     target.recipientId!==a.recipientId||target.team!==a.team||
     target.physicsTick!==tick||target.physicalPassAttemptOnly!==true||
     target.passCompleted!==false||!finite(target.recipientX)||
     !finite(target.recipientY)||target.recipientX!==pos.x||
     target.recipientY!==pos.y)fail();
  pass=Object.freeze({actorId:a.playerId,team:a.team,
   recipientId:a.recipientId,tick,completedPass:null});
 }
 return Object.freeze({
  version:PASS_AUDIT_VERSION,physicsTick:tick,
  exclusiveShoeStartObserved:exclusive,
  passAttemptObserved:pass!==null,pass,passEligibility:null,
  readOnly:true,officialMatchAction:false,
  authorizedAffordances:Object.freeze([])
 });
}
