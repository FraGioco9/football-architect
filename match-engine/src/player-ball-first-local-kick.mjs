// ME-PB-22 — first REAL autonomous ball kick, opt-in local DEV experiment.
// This pure decision does not accept ME-PB-18/21 untrusted candidate commands.
// The impulse is executed by the isolated Rapier body ONLY after the solver
// reports a genuine shoe-ball collision START for the local Home #10 player.
// No possession, pass success, official match result or real-player input.
export const FIRST_LOCAL_KICK_VERSION='me-pb-22-first-local-ai-kick-v1';
export const FIRST_LOCAL_KICK_PLAYER_ID='home-10';
export const FIRST_LOCAL_KICK_IMPULSE_NS=2.4;
export const FIRST_LOCAL_KICK_MAX_DISTANCE_M=0.85;
export function decideFirstLocalAiKick({
 tick,contactStarted,player,ballPosition,ballRadiusM,alreadyApplied=false
}){
 if(!Number.isSafeInteger(tick)||tick<1||
    !Array.isArray(contactStarted)||typeof alreadyApplied!=='boolean'||
    typeof ballRadiusM!=='number'||!Number.isFinite(ballRadiusM)||ballRadiusM<=0)
  throw new TypeError('Canonical collision decision tick and flags required');
 if(alreadyApplied||!contactStarted.includes(FIRST_LOCAL_KICK_PLAYER_ID))
  return null;
 if(!player||player.id!==FIRST_LOCAL_KICK_PLAYER_ID||
    player.team!=='home'||player.role!=='forward'||
    !['x','y','facingRad'].every(k=>
      typeof player[k]==='number'&&Number.isFinite(player[k]))||
    !ballPosition||!['x','y','z'].every(k=>
      typeof ballPosition[k]==='number'&&Number.isFinite(ballPosition[k])))
  return null;
 const gap=Math.hypot(ballPosition.x-player.x,ballPosition.y-player.y);
 const forward=Math.cos(player.facingRad),lateral=Math.sin(player.facingRad);
 if(gap>FIRST_LOCAL_KICK_MAX_DISTANCE_M||
    ballPosition.z>ballRadiusM+0.12||
    ballPosition.z<ballRadiusM-0.015||
    forward<0.65)return null;
 // Illustrative one-time 2.4 N*s local AI forward drive (~5.6 m/s if
 // unconstrained for a 430g ball), NOT a measured human-foot force curve.
 const impulseNs=Object.freeze({
  x:FIRST_LOCAL_KICK_IMPULSE_NS*forward,
  y:FIRST_LOCAL_KICK_IMPULSE_NS*lateral,z:0
 });
 return Object.freeze({
  version:FIRST_LOCAL_KICK_VERSION,tick,playerId:player.id,
  intent:'local-ai-forward-kick-demo',
  physicalTrigger:'real-rapier-foot-contact-start',
  measuredPlayerToBallDistanceM:gap,
  impulseNs,
  experimentalOnly:true,
  inferredPossession:false,
  officialMatchAction:false
 });
}
