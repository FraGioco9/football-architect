// ME-PB-51 / Match Physics V1 B3 — real physical escort and release.
// Owned ME-PB-50 Rapier session only. No impulse, teleport, attachment,
// synthetic contact, player instruction or independent physics tuning.
import {createLocalBallReceptionSession}
 from './player-ball-local-reception.mjs';
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {BALL_OWNERSHIP_CONTROL_TICKS}
 from './player-ball-ownership.mjs';

export const LOCAL_BALL_CARRY_RELEASE_VERSION=
 'me-pb-51-physical-carry-natural-release-v1';
const IDS=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const deltaXY=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const freeze3=v=>Object.freeze({x:v.x,y:v.y,z:v.z});
const reject=()=>{throw new TypeError(
 'Carry/release session does not accept injected physics or owner'
);};

export function createLocalBallCarryReleaseSession(RAPIER,scenario,options){
 const source=options===undefined?
  createLocalBallReceptionSession(RAPIER,scenario):
  createLocalBallReceptionSession(RAPIER,scenario,options);
 return buildFromTrustedSession(source);
}
function buildFromTrustedSession(source){
 let closed=false;
 let episodes=Object.freeze([]);
 let last=source.snapshot();
 function output(f){
  return Object.freeze({
   version:LOCAL_BALL_CARRY_RELEASE_VERSION,physicsTick:f.physicsTick,
   ball:f.ball,ballSnapshot:f.ballSnapshot,footContact:f.footContact,
   ownerState:f.ownerState,ownerPlayerId:f.ownerPlayerId,phase:f.phase,
   episodeCount:episodes.length,episodes,latestEpisode:episodes.at(-1)??null,
   physicalAccompanimentObserved:episodes.some(e=>
    e.controlFrames>=2&&e.controlledBallTravelM>0&&
    e.controlledPlayerTravelM>0),
   globalResponse:f.globalResponse,sameForAllPlayers:true,
   sameForAllShoes:true,sameForAllPitches:true,
   source:'private-in-process-60hz-Rapier',
   experimentalLocalOnly:true,officialMatchPossession:false,
   passCreated:false,ballForceApplied:false,
   ballTeleportApplied:false,ballAttachmentApplied:false
  });
 }
 let latest=output(last);
 const open=()=>{if(closed)throw new Error('Carry/release session disposed');};
 function dispose(){if(!closed){closed=true;source.dispose();}}
 function step(...args){
  open();if(args.length)reject();
  try{
   const f=source.step(),t=f.physicsTick;
   if(t!==last.physicsTick+1||f.ownerState.physicsTick!==t||
      f.footContact?.tick!==t||f.officialMatchPossession!==false||
      f.passCreated!==false||f.ballForceApplied!==false)
    throw new Error('Invalid trusted physical escort frame');
   const beforeOwner=last.ownerPlayerId,owner=f.ownerPlayerId;
   const next=episodes.map(e=>({...e}));
   if(beforeOwner!==null&&beforeOwner!==owner){
    const old=next.findLast(e=>e.playerId===beforeOwner&&
      e.controlLossPhysicsTick===null);
    if(!old)throw new Error('Missing prior authentic physical escort');
    old.controlLossPhysicsTick=t;
    old.controlLossReason=f.ownerState.lastTransition;
   }
   if(owner!==null){
    const idx=IDS.indexOf(owner);
    if(idx<0||!f.footContact.active.includes(owner)||
       f.ownerState.candidateStreakTicks<BALL_OWNERSHIP_CONTROL_TICKS)
     throw new Error('Unqualified physical ball escort');
    if(owner!==beforeOwner){
     const sourceStart=f.ownerState.contactProvenanceStartTick;
     if(!Number.isSafeInteger(sourceStart)||
        sourceStart<1||sourceStart>t)
      throw new Error('No real shoe START provenance');
     next.push({
      playerId:owner,physicalStartPhysicsTick:sourceStart,
      acquiredPhysicsTick:t,controlFrames:1,
      controlledBallTravelM:0,controlledPlayerTravelM:0,
      lastControlledBallPosition:freeze3(f.ball.position),
      controlLossPhysicsTick:null,controlLossReason:null,
      shoeEndPhysicsTick:null,shoeEndBallPosition:null,
      cleanPostEndTicks:0,freeBallTravelM:0,
      freeBallLastPosition:null,
      censoredByNewContactPhysicsTick:null,
      physicalAccompanimentObserved:false
     });
    }else{
     const e=next.at(-1);
     if(!e||e.playerId!==owner||e.controlLossPhysicsTick!==null)
      throw new Error('Nonconsecutive real physical escort');
     const travelledBall=deltaXY(last.ball.position,f.ball.position),
      travelledPlayer=deltaXY(
       last.ownerState.lastPlayerPositions[idx],
       f.ownerState.lastPlayerPositions[idx]);
     if(!Number.isFinite(travelledBall)||!Number.isFinite(travelledPlayer))
      throw new Error('Invalid physical ball/player displacement');
     e.controlFrames++;
     e.controlledBallTravelM+=travelledBall;
     e.controlledPlayerTravelM+=travelledPlayer;
     e.lastControlledBallPosition=freeze3(f.ball.position);
     e.physicalAccompanimentObserved=
      e.controlFrames>=2&&e.controlledBallTravelM>0&&
      e.controlledPlayerTravelM>0;
    }
   }
   // Control loss and shoe END are distinct, physical facts.
   // The first complete no-shoe tail starts on the tick AFTER the END.
   for(const e of next){
    if(e.shoeEndPhysicsTick===null&&
       f.footContact.ended.includes(e.playerId)&&
       t>=e.acquiredPhysicsTick){
      if(e.controlLossPhysicsTick===null)
       throw new Error('Real shoe END cannot preserve physical owner');
      e.shoeEndPhysicsTick=t;
      e.shoeEndBallPosition=freeze3(f.ball.position);
      e.freeBallLastPosition=freeze3(f.ball.position);
    }else if(e.shoeEndPhysicsTick!==null&&
     e.censoredByNewContactPhysicsTick===null&&
     t>e.shoeEndPhysicsTick){
      const touched=f.footContact.started.length>0||
       f.footContact.ended.length>0||f.footContact.active.length>0;
      if(touched)e.censoredByNewContactPhysicsTick=t;
      else{
       e.cleanPostEndTicks++;
       e.freeBallTravelM+=deltaXY(
        e.freeBallLastPosition,f.ball.position);
       e.freeBallLastPosition=freeze3(f.ball.position);
      }
    }
   }
   episodes=Object.freeze(next.map(e=>Object.freeze({
    ...e,lastControlledBallPosition:freeze3(e.lastControlledBallPosition),
    shoeEndBallPosition:e.shoeEndBallPosition?
     freeze3(e.shoeEndBallPosition):null,
    freeBallLastPosition:e.freeBallLastPosition?
     freeze3(e.freeBallLastPosition):null
   })));
   last=f;latest=output(f);
   return latest;
  }catch(error){dispose();throw error;}
 }
 function snapshot(...args){open();if(args.length)reject();return latest;}
 function reset(...args){
  open();if(args.length)reject();
  const fresh=source.reset();
  closed=true;
  return buildFromTrustedSession(fresh);
 }
 return Object.freeze({step,snapshot,reset,dispose});
}
