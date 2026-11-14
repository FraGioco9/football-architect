// ME-PB-53 / Match Physics V1 B5.2 — closed, read-only ambiguity guard.
// Only a private B4/B3/B2 60Hz Rapier world can supply physical evidence.
// This module never creates a kick, owner, physical impulse or match action.
import {createLocalBallContestSession}
 from './player-ball-contest.mjs';
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {BALL_OWNERSHIP_CONTROL_TICKS,BALL_OWNERSHIP_MAX_BALL_HEIGHT_M}
 from './player-ball-ownership.mjs';

export const BALL_AMBIGUITY_GUARD_VERSION=
 'me-pb-53-trusted-real-rapier-ambiguity-guard-v1';
const TEAMS=new Map(INITIAL_PLAYERS.map(p=>[p.id,p.team]));
const fail=()=>{throw new Error('Untrusted or ambiguous Rapier ownership provenance');};
const reject=()=>{throw new TypeError(
 'Ambiguity guard cannot accept injected owner, contacts or physics'
);};
const same=(a,b)=>a.length===b.length&&a.every((id,i)=>id===b[i]);

export function createLocalBallAmbiguityGuardSession(RAPIER,scenario,options){
 const source=options===undefined?
  createLocalBallContestSession(RAPIER,scenario):
  createLocalBallContestSession(RAPIER,scenario,options);
 return guardTrustedContest(source);
}

function guardTrustedContest(source){
 let closed=false;
 let prior=source.snapshot();
 let activeStarts=new Map();
 function report(f){
  const active=f.footContact?.active??[];
  const transient=Boolean(f.footContact?.started.some(id=>
   f.footContact.ended.includes(id)));
  const classification=f.ownerPlayerId!==null?
   'qualified-local-control':
   active.length>0?'unqualified-physical-contact':
   transient?'same-tick-transient-no-owner':'no-active-shoe';
  const deniedReason=f.ownerPlayerId!==null?null:
   active.length>1?'multiple-active-shoes':
   f.ball.position.z>BALL_OWNERSHIP_MAX_BALL_HEIGHT_M?
    'outside-ball-control-height':
   active.length>0?'not-six-tick-qualified-control':
   transient?'same-tick-transient':'no-active-contact';
  return Object.freeze({
   version:BALL_AMBIGUITY_GUARD_VERSION,
   physicsTick:f.physicsTick,ball:f.ball,ballSnapshot:f.ballSnapshot,
   footContact:f.footContact,phase:f.phase,
   ownerPlayerId:f.ownerPlayerId,ownerState:f.ownerState,
   physicalStarts:f.physicalStarts,losses:f.losses,
   acquisitions:f.acquisitions,subsequentOwners:f.subsequentOwners,
   contactClassification:classification,
   noOwnerReason:deniedReason,
   unqualifiedContactTicks:f.contactOnlyTicks,
   simultaneousContactTicks:f.multiContactTicks,
   airborneTicks:f.airborneTicks,
   experimentalLocalOnly:true,officialMatchPossession:false,
   interceptionProven:false,tackleProven:false,
   directPlayerToPlayerHandoffProven:false,
   passCreated:false,ballForceApplied:false,
   ballTeleportApplied:false,ballAttachmentApplied:false,
   globalResponse:f.globalResponse,sameForAllPlayers:true,
   sameForAllShoes:true,sameForAllPitches:true
  });
 }
 let latest=report(prior);
 const open=()=>{if(closed)throw new Error('Ambiguity guard disposed');};
 function dispose(){if(!closed){closed=true;source.dispose();}}
 function additions(before,after){
  if(!Array.isArray(before)||!Array.isArray(after)||
     after.length<before.length)fail();
  for(let i=0;i<before.length;i++)
   if(after[i]!==before[i])fail();
  return after.slice(before.length);
 }
 function validate(f){
  const tick=prior.physicsTick+1,foot=f.footContact;
  if(f.physicsTick!==tick||foot?.tick!==tick||
     f.ownerState?.physicsTick!==tick||
     f.ownerState.phase!==f.phase||
     f.ownerState.ownerPlayerId!==f.ownerPlayerId||
     f.officialMatchPossession!==false||
     f.interceptionProven!==false||f.tackleProven!==false||
     f.directPlayerToPlayerHandoffProven!==false||
     f.passCreated!==false||f.ballForceApplied!==false||
     f.ballTeleportApplied!==false||f.ballAttachmentApplied!==false||
     !Array.isArray(foot.started)||!Array.isArray(foot.ended)||
     !Array.isArray(foot.active))fail();
  const nextStarts=new Map(activeStarts);
  const started=new Set(foot.started),ended=new Set(foot.ended);
  if(started.size!==foot.started.length||ended.size!==foot.ended.length||
     new Set(foot.active).size!==foot.active.length)fail();
  for(const id of foot.started){
   if(!TEAMS.has(id)||(nextStarts.has(id)&&!ended.has(id)))fail();
   nextStarts.set(id,tick);
  }
  for(const id of foot.ended){
   if(!TEAMS.has(id)||(!nextStarts.has(id)&&!started.has(id)))fail();
   nextStarts.delete(id);
  }
  if(!same([...nextStarts.keys()].sort(),[...foot.active].sort()))fail();
  const physicalStarts=additions(prior.physicalStarts,f.physicalStarts);
  if(physicalStarts.length!==foot.started.length)fail();
  for(let i=0;i<physicalStarts.length;i++){
   const e=physicalStarts[i],id=foot.started[i];
   if(e.id!==id||e.tick!==tick||e.team!==TEAMS.get(id)||
      !Object.isFrozen(e))fail();
  }
  const owner=f.ownerPlayerId,old=prior.ownerPlayerId;
  if(owner!==null){
   if(f.phase!=='controlled'||foot.active.length!==1||
      foot.active[0]!==owner||!TEAMS.has(owner)||
      f.ownerState.candidatePlayerId!==owner||
      f.ownerState.candidateStreakTicks<BALL_OWNERSHIP_CONTROL_TICKS||
      f.ownerState.contactProvenanceStartTick!==nextStarts.get(owner)||
      tick<nextStarts.get(owner)+BALL_OWNERSHIP_CONTROL_TICKS-1||
      f.ball.position.z>BALL_OWNERSHIP_MAX_BALL_HEIGHT_M)fail();
  }else if(f.phase!==(foot.active.length?'contested':'free'))fail();
  if(owner!==null&&old!==null&&owner!==old)fail();
  const losses=additions(prior.losses,f.losses);
  const shouldLose=old!==null&&owner!==old;
  if(losses.length!==Number(shouldLose))fail();
  if(shouldLose){
   const loss=losses[0];
   if(loss.id!==old||loss.team!==TEAMS.get(old)||
      loss.tick!==tick||
      loss.reason!==f.ownerState.lastTransition||
      loss.shoeEndedThisTick!==foot.ended.includes(old))fail();
  }
  const acquired=owner!==null&&owner!==old;
  const acquisitions=additions(prior.acquisitions,f.acquisitions);
  if(acquisitions.length!==Number(acquired))fail();
  if(acquired){
   const a=acquisitions[0];
   if(a.tick!==tick||a.id!==owner||a.team!==TEAMS.get(owner)||
      a.physicalStartTick!==nextStarts.get(owner)||
      a.stableTicks!==f.ownerState.candidateStreakTicks)fail();
  }
  const later=additions(prior.subsequentOwners,f.subsequentOwners);
  if(later.length>1||(!acquired&&later.length))fail();
  if(later.length){
   const a=later[0];
   if(!acquired||!TEAMS.has(a.previousOwnerId)||
      a.newOwnerId!==owner||a.acquiredTick!==tick||
      a.newPhysicalStartTick!==nextStarts.get(owner)||
      a.previousLostTick>=a.newPhysicalStartTick||
      a.freeOrContestedTicks!==tick-a.previousLostTick-1||
      a.crossTeam!==(TEAMS.get(a.previousOwnerId)!==TEAMS.get(owner))||
      a.classification!=='later-owner-after-prior-control-loss'||
      a.directInterceptionProven!==false||a.tackleProven!==false)
    fail();
  }
  if(f.contactOnlyTicks!==prior.contactOnlyTicks+
       Number(f.phase==='contested')||
     f.multiContactTicks!==prior.multiContactTicks+
       Number(foot.active.length>1)||
     f.airborneTicks!==prior.airborneTicks+
       Number(f.ball.position.z>BALL_OWNERSHIP_MAX_BALL_HEIGHT_M))
   fail();
  return nextStarts;
 }
 function step(...args){
  open();if(args.length)reject();
  try{
   const frame=source.step();
   const nextStarts=validate(frame);
   activeStarts=nextStarts;
   prior=frame;latest=report(frame);
   return latest;
  }catch(error){dispose();throw error;}
 }
 function snapshot(...args){
  open();if(args.length)reject();
  return latest;
 }
 function reset(...args){
  open();if(args.length)reject();
  const fresh=source.reset();
  closed=true;
  return guardTrustedContest(fresh);
 }
 return Object.freeze({step,snapshot,reset,dispose});
}
