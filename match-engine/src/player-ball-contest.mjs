// ME-PB-52 / Match Physics V1 B4 — conservative local physical contest
// and subsequent owner arbitration. CLOSED source = ME-PB-51 actual Rapier.
// A later opponent owner after a free-ball interval is NOT an interception.
import {createLocalBallCarryReleaseSession}
 from './player-ball-carry-release.mjs';
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {BALL_OWNERSHIP_CONTROL_TICKS,BALL_OWNERSHIP_MAX_BALL_HEIGHT_M}
 from './player-ball-ownership.mjs';

export const LOCAL_BALL_CONTEST_VERSION=
 'me-pb-52-conservative-real-rapier-contest-v1';
const TEAMS=new Map(INITIAL_PLAYERS.map(p=>[p.id,p.team]));
const frozenEvent=(e)=>Object.freeze({...e});
const reject=()=>{throw new TypeError(
 'A local contest cannot accept injected physical evidence or ownership'
);};

export function createLocalBallContestSession(RAPIER,scenario,options){
 const source=options===undefined?
  createLocalBallCarryReleaseSession(RAPIER,scenario):
  createLocalBallCarryReleaseSession(RAPIER,scenario,options);
 return fromTrustedCarrySession(source);
}
function fromTrustedCarrySession(source){
 let closed=false;
 let previous=source.snapshot();
 let starts=Object.freeze([]);
 let losses=Object.freeze([]);
 let acquisitions=Object.freeze([]);
 let subsequentOwners=Object.freeze([]);
 let contactOnlyTicks=0,multiContactTicks=0,airborneTicks=0;
 let lastOwnerId=null,lastOwnerLossTick=null;
 function result(f){
  return Object.freeze({
   version:LOCAL_BALL_CONTEST_VERSION,
   physicsTick:f.physicsTick,ballSnapshot:f.ballSnapshot,ball:f.ball,
   footContact:f.footContact,ownerPlayerId:f.ownerPlayerId,
   phase:f.phase,ownerState:f.ownerState,
   physicalStarts:starts,losses,acquisitions,subsequentOwners,
   lastConfirmedOwnerId:lastOwnerId,
   lastConfirmedOwnerLossTick:lastOwnerLossTick,
   contactOnlyTicks,multiContactTicks,airborneTicks,
   contactWithoutControl:f.phase==='contested'&&
    f.ownerPlayerId===null,
   ballOutsideGroundControlHeight:
    f.ball.position.z>BALL_OWNERSHIP_MAX_BALL_HEIGHT_M,
   experimentalLocalOnly:true,globalResponse:f.globalResponse,
   sameForAllShoes:true,sameForAllPlayers:true,
   sameForAllPitches:true,
   officialMatchPossession:false,
   interceptionProven:false,tackleProven:false,
   directPlayerToPlayerHandoffProven:false,
   passCreated:false,ballForceApplied:false,
   ballTeleportApplied:false,ballAttachmentApplied:false
  });
 }
 let latest=result(previous);
 const ensureOpen=()=>{if(closed)throw new Error('Contest session disposed');};
 const dispose=()=>{if(!closed){closed=true;source.dispose();}};
 function step(...args){
  ensureOpen();if(args.length)reject();
  try{
   const f=source.step(),t=f.physicsTick,foot=f.footContact;
   if(t!==previous.physicsTick+1||foot?.tick!==t||
      f.ownerState?.physicsTick!==t||
      f.officialMatchPossession!==false||
      f.ballForceApplied!==false||f.ballTeleportApplied!==false||
      f.ballAttachmentApplied!==false)throw new Error(
       'Invalid trusted physical contest tick');
   if(foot.active.length>1&&
      (f.phase!=='contested'||f.ownerPlayerId!==null))
     throw new Error('Multiple real shoes cannot yield an owner');
   if(f.ball.position.z>BALL_OWNERSHIP_MAX_BALL_HEIGHT_M&&
      f.ownerPlayerId!==null)
     throw new Error('Airborne ball cannot remain controlled');
   const newStarts=[...starts];
   for(const id of foot.started){
    if(!TEAMS.has(id))throw new Error('Unknown Rapier shoe START');
    newStarts.push(frozenEvent({tick:t,id,team:TEAMS.get(id)}));
   }
   const newLosses=[...losses],newAcquisitions=[...acquisitions],
    newLater=[...subsequentOwners];
   const prevOwner=previous.ownerPlayerId,owner=f.ownerPlayerId;
   if(prevOwner!==null&&prevOwner!==owner){
    if(!TEAMS.has(prevOwner)||lastOwnerId!==prevOwner)
     throw new Error('Loss of an unverified prior owner');
    const episode=f.episodes.findLast(e=>
     e.playerId===prevOwner&&e.controlLossPhysicsTick===t);
    if(!episode)throw new Error('Loss absent from trusted carry evidence');
    newLosses.push(frozenEvent({
     tick:t,id:prevOwner,team:TEAMS.get(prevOwner),
     reason:episode.controlLossReason,
     shoeEndedThisTick:foot.ended.includes(prevOwner)
    }));
    lastOwnerLossTick=t;
   }
   if(owner!==null&&owner!==prevOwner){
    if(prevOwner!==null)throw new Error(
     'Owner cannot jump between two players in one physics tick');
    const sourceTick=f.ownerState.contactProvenanceStartTick;
    const provenance=newStarts.findLast(e=>
     e.id===owner&&e.tick===sourceTick);
    if(!provenance||!TEAMS.has(owner)||
       f.phase!=='controlled'||foot.active.length!==1||
       foot.active[0]!==owner||
       f.ownerState.candidateStreakTicks<BALL_OWNERSHIP_CONTROL_TICKS||
       !Number.isSafeInteger(sourceTick)||
       t<sourceTick+BALL_OWNERSHIP_CONTROL_TICKS-1)
     throw new Error('No sustained genuine shoe START for new owner');
    const prior=lastOwnerId,priorLoss=lastOwnerLossTick;
    if(prior!==null&&
       (!Number.isSafeInteger(priorLoss)||priorLoss>=sourceTick))
     throw new Error('Owner change must follow measured prior loss');
    const newEntry=frozenEvent({
     tick:t,id:owner,team:TEAMS.get(owner),
     physicalStartTick:sourceTick,
     stableTicks:f.ownerState.candidateStreakTicks
    });
    newAcquisitions.push(newEntry);
    if(prior!==null&&prior!==owner){
     newLater.push(frozenEvent({
      acquiredTick:t,newOwnerId:owner,newOwnerTeam:TEAMS.get(owner),
      previousOwnerId:prior,previousOwnerTeam:TEAMS.get(prior),
      previousLostTick:priorLoss,
      newPhysicalStartTick:sourceTick,
      freeOrContestedTicks:t-priorLoss-1,
      crossTeam:TEAMS.get(prior)!==TEAMS.get(owner),
      classification:'later-owner-after-prior-control-loss',
      directInterceptionProven:false,
      tackleProven:false
     }));
    }
    lastOwnerId=owner;
   }
   if(f.phase==='contested'){
    if(owner!==null)throw new Error('Contested shoe may not own ball');
    contactOnlyTicks++;
   }
   if(foot.active.length>1)multiContactTicks++;
   if(f.ball.position.z>BALL_OWNERSHIP_MAX_BALL_HEIGHT_M)
    airborneTicks++;
   starts=Object.freeze(newStarts);
   losses=Object.freeze(newLosses);
   acquisitions=Object.freeze(newAcquisitions);
   subsequentOwners=Object.freeze(newLater);
   previous=f;
   latest=result(f);
   return latest;
  }catch(error){dispose();throw error;}
 }
 function snapshot(...args){ensureOpen();if(args.length)reject();return latest;}
 function reset(...args){
  ensureOpen();if(args.length)reject();
  const fresh=source.reset();
  closed=true;
  return fromTrustedCarrySession(fresh);
 }
 return Object.freeze({step,snapshot,reset,dispose});
}
