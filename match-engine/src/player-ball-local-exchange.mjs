// ME-PB-24: exploratory autonomous return pass + observable opponent block.
// No official possession, receiver guarantee, or synthetic football contact.
// The caller may apply a physical impulse only after a true Rapier START.
import {LOCAL_TARGET_CANDIDATE_IDS,LOCAL_DYNAMIC_TARGET_VERSION} from './player-ball-local-targeting.mjs';
export const LOCAL_EXCHANGE_VERSION='me-pb-24-local-exchange-v1';
export const LOCAL_EXCHANGE_MAX_EVENTS=4;
export const LOCAL_RETURN_TARGET_SPEED_MPS=6.5;
// Return pass reverses a still-moving physical ball: cap the TOTAL
// measured velocity change (including braking), not only the new speed.
export const LOCAL_RETURN_MAX_IMPULSE_NS=10;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=0.85;
function canObserve(tick,started,ball,radius){
 if(!Number.isSafeInteger(tick)||tick<1||
    !Array.isArray(started)||started.some(id=>typeof id!=='string')||
    !ball||!['x','y','z'].every(k=>finite(ball[k]))||
    !finite(radius)||radius<=0)
  throw new TypeError('Valid Rapier tick, START events and ball state required');
}
function event(data){
 return Object.freeze({
  version:LOCAL_EXCHANGE_VERSION,
  physicalTrigger:'real-rapier-foot-contact-start',
  experimentalOnly:true,officialMatchAction:false,
  inferredPossession:false,passCompletionInferred:false,
  ...data
 });
}
export function decideLocalAiReturnPass({
 tick,contactStarted,firstPass,player,teammate,ballPosition,
 ballVelocity,ballRadiusM,ballMassKg
}){
 canObserve(tick,contactStarted,ballPosition,ballRadiusM);
 if(firstPass?.stage!=='pass'||firstPass.playerId!=='home-7'||
    !Number.isSafeInteger(firstPass.tick)||tick<=firstPass.tick+2||
    !LOCAL_TARGET_CANDIDATE_IDS.includes(firstPass.targetPlayerId)||
    !contactStarted.includes(firstPass.targetPlayerId)||
    player?.id!==firstPass.targetPlayerId||player?.team!=='home'||
    teammate?.id!=='home-7'||teammate?.team!=='home'||
    !['x','y'].every(k=>finite(player[k])&&finite(teammate[k]))||
    !near(player,ballPosition)||
    ballPosition.z<ballRadiusM-0.015||
    ballPosition.z>ballRadiusM+0.12||
    !ballVelocity||!['x','y','z'].every(k=>finite(ballVelocity[k]))||
    !finite(ballMassKg)||ballMassKg<=0)return null;
 const dx=teammate.x-player.x,dy=teammate.y-player.y;
 const targetDistance=Math.hypot(dx,dy);
 // A real short return is legitimate: use the measured teammate location,
 // not an invented minimum 8m back-pass lane or a fixed facing direction.
 // The player's physical shoe START and separated time remain mandatory.
 if(targetDistance<1.2||targetDistance>28)return null;
 const desired={x:LOCAL_RETURN_TARGET_SPEED_MPS*dx/targetDistance,
  y:LOCAL_RETURN_TARGET_SPEED_MPS*dy/targetDistance};
 const ix=(desired.x-ballVelocity.x)*ballMassKg;
 const iy=(desired.y-ballVelocity.y)*ballMassKg;
 if(Math.hypot(ix,iy)>LOCAL_RETURN_MAX_IMPULSE_NS)return null;
 return event({
  stage:'return-pass',tick,playerId:player.id,
  targetPlayerId:'home-7',previousPassTick:firstPass.tick,
  impulseNs:Object.freeze({x:ix,y:iy,z:0}),
  targetPositionAtPass:Object.freeze({x:teammate.x,y:teammate.y}),
  intendedGroundSpeedMps:LOCAL_RETURN_TARGET_SPEED_MPS,
  observedPreKickGroundSpeedMps:Math.hypot(ballVelocity.x,ballVelocity.y),
  intent:'local-ai-backward-return-pass-demo'
 });
}
export function observeLocalOppositionContact({
 tick,contactStarted,players,ballPosition,ballRadiusM,phase
}){
 canObserve(tick,contactStarted,ballPosition,ballRadiusM);
 if(!Array.isArray(players)||!['outbound','return','third'].includes(phase))
  throw new TypeError('Measured opposition frame and active exchange phase required');
 const ids=new Set(contactStarted);
 const opponent=players.find(p=>p.team==='away'&&ids.has(p.id)&&
   finite(p.x)&&finite(p.y)&&near(p,ballPosition));
 if(!opponent)return null;
 return event({
  stage:'opponent-contact',tick,playerId:opponent.id,
  activePhase:phase,
  // A solver collision is a real *physical disruption*, not an
  // authenticated steal or an adjudicated change of possession.
  intent:'none-observed',
  actualShoeStart:true,
  interceptionInferred:false,
  consequence:'physical-opposition-contact-stop'
 });
}
export function decideLocalAiReturnControl({
 tick,contactStarted,returnPass,player,ballPosition,ballVelocity,
 ballRadiusM,ballMassKg
}){
 canObserve(tick,contactStarted,ballPosition,ballRadiusM);
 if(returnPass?.stage!=='return-pass'||
    !Number.isSafeInteger(returnPass.tick)||tick<=returnPass.tick+2||
    !contactStarted.includes('home-7')||
    player?.id!=='home-7'||player.team!=='home'||
    !['x','y'].every(k=>finite(player[k]))||!near(player,ballPosition)||
    ballPosition.z<ballRadiusM-0.015||
    ballPosition.z>ballRadiusM+0.12||
    !ballVelocity||!['x','y','z'].every(k=>finite(ballVelocity[k]))||
    !finite(ballMassKg)||ballMassKg<=0)return null;
 const speed=Math.hypot(ballVelocity.x,ballVelocity.y);
 if(speed<0.2||speed>22)return null;
 const ix=ballMassKg*(-0.35-ballVelocity.x);
 const iy=-ballMassKg*ballVelocity.y;
 if(Math.hypot(ix,iy)>3.5)return null;
 return event({
  stage:'return-control',tick,playerId:'home-7',
  previousPassTick:returnPass.tick,
  impulseNs:Object.freeze({x:ix,y:iy,z:0}),
  observedPreControlGroundSpeedMps:speed,
  intendedPostControlGroundSpeedMps:0.35,
  intent:'local-ai-return-reception-demo'
 });
}

// ME-PB-34: a THIRD distinct physical pass, only on a genuine later
// Home #7 Rapier shoe START. This is not the previous return-control:
// the actual ball receives a new bounded impulse toward current Home #10 XY.
export const LOCAL_THIRD_PASS_VERSION=LOCAL_DYNAMIC_TARGET_VERSION;
export const LOCAL_THIRD_PASS_TARGET_SPEED_MPS=6.5;
export const LOCAL_THIRD_PASS_MAX_IMPULSE_NS=10;
export function decideLocalAiThirdPass({
 tick,contactStarted,firstPass,returnPass,player,teammate,
 ballPosition,ballVelocity,ballRadiusM,ballMassKg
}){
 canObserve(tick,contactStarted,ballPosition,ballRadiusM);
 if(firstPass?.stage!=='pass'||firstPass.playerId!=='home-7'||
    returnPass?.stage!=='return-pass'||returnPass.playerId!=='home-10'||
    returnPass.targetPlayerId!=='home-7'||
    returnPass.previousPassTick!==firstPass.tick||
    !Number.isSafeInteger(returnPass.tick)||tick<=returnPass.tick+2||
    !contactStarted.includes('home-7')||
    player?.id!=='home-7'||player.team!=='home'||
    teammate?.id!=='home-10'||teammate.team!=='home'||
    !['x','y'].every(k=>finite(player[k])&&finite(teammate[k]))||
    !near(player,ballPosition)||
    ballPosition.z<ballRadiusM-0.015||
    ballPosition.z>ballRadiusM+0.12||
    !ballVelocity||!['x','y','z'].every(k=>finite(ballVelocity[k]))||
    !finite(ballMassKg)||ballMassKg<=0)return null;
 const dx=teammate.x-player.x,dy=teammate.y-player.y;
 const distance=Math.hypot(dx,dy);
 if(distance<1.2||distance>28)return null;
 const desired={
  x:LOCAL_THIRD_PASS_TARGET_SPEED_MPS*dx/distance,
  y:LOCAL_THIRD_PASS_TARGET_SPEED_MPS*dy/distance
 };
 const ix=(desired.x-ballVelocity.x)*ballMassKg;
 const iy=(desired.y-ballVelocity.y)*ballMassKg;
 if(!finite(ix)||!finite(iy)||
    Math.hypot(ix,iy)<0.01||
    Math.hypot(ix,iy)>LOCAL_THIRD_PASS_MAX_IMPULSE_NS)return null;
 return Object.freeze({
  version:LOCAL_THIRD_PASS_VERSION,stage:'pass',tick,
  playerId:'home-7',targetPlayerId:'home-10',
  previousPassTick:returnPass.tick,
  impulseNs:Object.freeze({x:ix,y:iy,z:0}),
  targetPositionAtPass:Object.freeze({x:teammate.x,y:teammate.y}),
  intendedGroundSpeedMps:LOCAL_THIRD_PASS_TARGET_SPEED_MPS,
  observedPreKickGroundSpeedMps:Math.hypot(ballVelocity.x,ballVelocity.y),
  physicalTrigger:'real-rapier-foot-contact-start',
  experimentalOnly:true,officialMatchAction:false,
  inferredPossession:false,passCompletionInferred:false,
  intent:'local-ai-third-physical-ground-pass'
 });
}
