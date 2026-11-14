// ME-PB-50 / Match Physics V1 B2: trusted LOCAL real-Rapier reception loop.
// One response scalar, one real football, all 22 identical physical shoes.
// No externally supplied contact event, ball snapshot, player frame or owner.
// This is diagnostic gameplay research, NOT official match possession.
import {createGlobalResponseResearchEngine,
 DEFAULT_GLOBAL_BALL_RESPONSE,resolveGlobalBallResponse}
 from './player-ball-global-response.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_DT}
 from './player-movement.mjs';
import {initialBallOwnershipState,advanceBallOwnership}
 from './player-ball-ownership.mjs';
import {FIXED_DT} from './core.mjs';

export const LOCAL_BALL_RECEPTION_VERSION=
 'me-pb-50-closed-trusted-rapier-reception-v1';

const reject=()=>{throw new TypeError(
 'Only a single common ball response and local trusted Rapier simulation are allowed'
);};

export function createLocalBallReceptionSession(
 RAPIER,scenario,{globalResponse=DEFAULT_GLOBAL_BALL_RESPONSE}={}
){
 // A single global gameplay-research scalar; refuse all independent foot,
 // turf, club, player, force, ownership or injected data overrides.
 const options=arguments[2]??{};
 if(!options||typeof options!=='object'||Array.isArray(options)||
    Reflect.ownKeys(options).some(key=>key!=='globalResponse'))
  reject();
 const profile=resolveGlobalBallResponse(globalResponse);
 // Freeze our own scenario copy so callers cannot retarget reset().
 if(!scenario||typeof scenario!=='object'||Array.isArray(scenario)||
    Reflect.ownKeys(scenario).some(k=>typeof k!=='string'))reject();
 const initial=Object.freeze({...scenario});
 const mover=createPlayerMovement({experimentalAiKickApproach:true});
 const engine=createGlobalResponseResearchEngine(RAPIER,initial,profile.value);
 let state=initialBallOwnershipState();
 let closed=false;
 const originalBall=engine.snapshot();
 if(originalBall.tick!==0) {
  engine.dispose();
  throw new Error('A new Rapier reception session must begin at tick zero');
 }
 function record(physics,contact=null){
  // These are frozen copies/snapshots, never live mutable Rapier objects.
  return Object.freeze({
   version:LOCAL_BALL_RECEPTION_VERSION,
   physicsTick:physics.tick,timeS:physics.time,
   ball:physics.ball,ballSnapshot:physics,
   footContact:contact,
   phase:state.phase,ownerPlayerId:state.ownerPlayerId,
   ownerState:state,
   candidatePlayerId:state.candidatePlayerId,
   controlAcquisitions:state.controlAcquisitions,
   contactSource:'internal-real-rapier-60hz',
   playerCount:INITIAL_PLAYERS.length,
   globalResponse:profile.value,
   sameForAllShoes:true,sameForAllPitches:true,
   experimentalLocalOnly:true,
   officialMatchPossession:false,
   passCreated:false,ballForceApplied:false
  });
 }
 let current=record(originalBall);
 function checkOpen(){if(closed)throw new Error('Reception session disposed');}
 function dispose(){
  if(!closed){closed=true;engine.dispose();}
 }
 function step(...supplied){
  checkOpen();
  if(supplied.length>0)reject(); // no fake or externally-supplied events
  try{
   const before=engine.snapshot();
   if(before.tick!==state.physicsTick)throw new Error(
    'Local Rapier/ownership clocks diverged'
   );
   const playerFrame=mover.step(before.ball.position);
   if(playerFrame.tick!==before.tick+1||
      playerFrame.players.length!==INITIAL_PLAYERS.length)
    throw new Error('Canonical local 22-player movement tick missing');
   const after=engine.step(playerFrame);
   const contact=engine.footContactSnapshot();
   if(after.tick!==before.tick+1||
      Math.abs(after.time-after.tick*FIXED_DT)>1e-8||
      !contact||contact.tick!==after.tick||
      Math.abs(playerFrame.timeS-after.tick*PLAYER_DT)>1e-8)
    throw new Error('Non-consecutive genuine local Rapier shoe frame');
   const updated=advanceBallOwnership({
    previous:state,contactFrame:contact,
    playerFrame,ballSnapshot:after
   });
   state=updated;
   current=record(after,contact);
   return current;
  }catch(error){
   // A broken trusted input must never leave a live session able
   // to resume with a stale owner or skip missing physics frames.
   dispose();
   throw error;
  }
 }
 function snapshot(...supplied){
  checkOpen();
  if(supplied.length>0)reject();
  return current;
 }
 function reset(...supplied){
  checkOpen();
  if(supplied.length>0)reject();
  dispose();
  return createLocalBallReceptionSession(RAPIER,initial,{
   globalResponse:profile.value
  });
 }
 return Object.freeze({step,snapshot,reset,dispose});
}
