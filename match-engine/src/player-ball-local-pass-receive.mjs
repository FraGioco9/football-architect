// ME-PB-23 — deterministic local Home #7 -> Home #10 pass and controlled
// reception. Real Rapier shoe START is a necessary physical event at BOTH
// endpoints. No proxy pass completion, possession or official gameplay.
export const LOCAL_PASS_RECEIVE_VERSION='me-pb-23-local-pass-receive-v1';
export const LOCAL_PASS_SENDER_ID='home-7';
export const LOCAL_PASS_RECEIVER_ID='home-10';
export const LOCAL_PASS_IMPULSE_NS=2.7;
export const LOCAL_RECEIVE_TARGET_SPEED_MPS=0.35;
export const LOCAL_RECEIVE_MAX_IMPULSE_NS=3.5;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function validFrame(tick,started,position,radius){
 if(!Number.isSafeInteger(tick)||tick<1||!Array.isArray(started)||
    !position||!['x','y','z'].every(k=>finite(position[k]))||
    !finite(radius)||radius<=0)
   throw new TypeError('Valid 60Hz Rapier contact decision inputs required');
}
const nearGround=(position,radius)=>position.z>=radius-0.015&&
 position.z<=radius+0.12;
const nearPlayer=(position,player)=>Math.hypot(position.x-player.x,
 position.y-player.y)<=0.85;
const validActor=(p,id,role)=>p?.id===id&&p.team==='home'&&
 p.role===role&&['x','y','facingRad'].every(k=>finite(p[k]));
const vector=(x,y,z=0)=>Object.freeze({x,y,z});
function localEvent(tick,playerId,stage,impulseNs,other){
 return Object.freeze({
  version:LOCAL_PASS_RECEIVE_VERSION,
  tick,playerId,stage,impulseNs,
  physicalTrigger:'real-rapier-foot-contact-start',
  actionSource:'built-in-deterministic-local-ai',
  experimentalOnly:true,officialMatchAction:false,
  inferredPossession:false,passCompletionInferred:false,
  ...other
 });
}
// No arbitrary user-supplied control command enters the physics engine.
// This is called only after the canonical 22-player frame and the actual
// Rapier collision queue have both been processed.
export function decideLocalAiPass({
 tick,contactStarted,passer,receiver,ballPosition,ballRadiusM
}){
 validFrame(tick,contactStarted,ballPosition,ballRadiusM);
 if(!contactStarted.includes(LOCAL_PASS_SENDER_ID)||
    !validActor(passer,LOCAL_PASS_SENDER_ID,'midfielder')||
    !validActor(receiver,LOCAL_PASS_RECEIVER_ID,'forward')||
    !nearGround(ballPosition,ballRadiusM)||!nearPlayer(ballPosition,passer))
  return null;
 const dx=receiver.x-passer.x,dy=receiver.y-passer.y;
 const length=Math.hypot(dx,dy);
 if(dx<5||length<8||length>28||Math.cos(passer.facingRad)<0.65)
   return null;
 const impulseNs=vector(
  LOCAL_PASS_IMPULSE_NS*dx/length,
  LOCAL_PASS_IMPULSE_NS*dy/length
 );
 return localEvent(tick,LOCAL_PASS_SENDER_ID,'pass',impulseNs,{
  targetPlayerId:LOCAL_PASS_RECEIVER_ID,
  targetPositionAtPass:Object.freeze({x:receiver.x,y:receiver.y}),
  intent:'local-ai-ground-pass-demo'
 });
}
export function decideLocalAiReception({
 tick,contactStarted,passEvent,receiver,ballPosition,ballVelocity,
 ballRadiusM,ballMassKg
}){
 validFrame(tick,contactStarted,ballPosition,ballRadiusM);
 if(passEvent===null||!passEvent||
    passEvent.version!==LOCAL_PASS_RECEIVE_VERSION||
    passEvent.stage!=='pass'||passEvent.playerId!==LOCAL_PASS_SENDER_ID||
    !Number.isSafeInteger(passEvent.tick)||tick<=passEvent.tick+2||
    !contactStarted.includes(LOCAL_PASS_RECEIVER_ID)||
    !validActor(receiver,LOCAL_PASS_RECEIVER_ID,'forward')||
    !nearGround(ballPosition,ballRadiusM)||!nearPlayer(ballPosition,receiver)||
    !ballVelocity||!['x','y','z'].every(k=>finite(ballVelocity[k]))||
    !finite(ballMassKg)||ballMassKg<=0)return null;
 const preControlSpeedMps=Math.hypot(ballVelocity.x,ballVelocity.y);
 if(preControlSpeedMps<0.20||preControlSpeedMps>22)return null;
 // Physically real, bounded impulse from measured Rapier current velocity,
 // not teleportation or a pre-labelled possession state. An approximate
 // player-foot damping prototype, not calibrated human biomechanics.
 const dx=LOCAL_RECEIVE_TARGET_SPEED_MPS-ballVelocity.x;
 const dy=-ballVelocity.y;
 const required=ballMassKg*Math.hypot(dx,dy);
 if(required>LOCAL_RECEIVE_MAX_IMPULSE_NS)return null;
 const impulseNs=vector(dx*ballMassKg,dy*ballMassKg);
 return localEvent(tick,LOCAL_PASS_RECEIVER_ID,'control',impulseNs,{
  fromPlayerId:LOCAL_PASS_SENDER_ID,passTick:passEvent.tick,
  observedPreControlGroundSpeedMps:preControlSpeedMps,
  intendedPostControlGroundSpeedMps:LOCAL_RECEIVE_TARGET_SPEED_MPS,
  intent:'local-ai-ground-ball-control-demo'
 });
}
