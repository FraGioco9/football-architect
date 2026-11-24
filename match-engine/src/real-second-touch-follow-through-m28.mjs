// #628 M28 — read-only original Rapier ball continuity after a real M27 no-kick.
// Proximity does NOT establish reception, dribbling, tackle or possession.
import {INITIAL_PLAYERS} from './player-movement.mjs';
export const M28_FOLLOW_THROUGH_TICKS=120;
const freeze=Object.freeze,finite=Number.isFinite;
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const r=x=>Math.round(x*1e4)/1e4;
const ids=new Set(INITIAL_PLAYERS.map(p=>p.id));
const known=a=>Array.isArray(a)&&new Set(a).size===a.length&&a.every(id=>ids.has(id));
export function createRealSecondTouchFollowThrough(){
 let tick=-1,active=null,latestCompleted=null;
 function report(s,reason=null){
  return freeze({
   version:'m28-original-rapier-post-defer-v1',
   actorId:s.id,team:s.team,sourceDecisionTick:s.start,
   originalCushionTick:s.cushionTick,lastTick:s.lastTick,
   observedTicks:s.samples,genuineSecondShoeStart:true,
   actualShoeActiveTicks:s.shoeActive,
   additionalRealReceiverShoeStarts:s.recontacts,
   firstOtherNativeShoeStartTick:s.otherStart,subsequentRealAction:s.nextAction,
   receiverBallWithin1MTicks:s.near,
   longestContinuousReceiverBallWithin1MTicks:s.longest,
   realOpponentWithin3MTicks:s.underPressure,
   minimumActualBallGapM:r(s.minGap),maximumActualBallGapM:r(s.maxGap),
   lastActualBallGapM:r(s.lastGap),minimumRealOpponentGapM:r(s.minOpponent),
   actualBallTravelXYM:r(s.travel),
   initialBallSpeedMps:r(s.firstSpeed),finalBallSpeedMps:r(s.lastSpeed),
   sustainedOneSecondProximityObserved:s.longest>=60,
   endReason:reason,observationComplete:reason!==null,
   readOnly:true,original22Source:true,matchAuthority:false,
   verifiedControl:false,verifiedReception:false,verifiedInterception:false,
   verifiedTackle:false,verifiedPossession:false,officialMatchAction:false
  });
 }
 const finish=why=>{latestCompleted=report(active,why);active=null;};
 function observe({physics,playerFrame,foot,action=null,
  physicalFirstTouch=null,physicalReceiverChoice=null}={}){
  const t=physics?.tick;
  if(!Number.isSafeInteger(t)||t<0||t!==tick+1||
     playerFrame?.tick!==t||foot?.tick!==t||
     !Array.isArray(playerFrame.players)||playerFrame.players.length!==22||
     !INITIAL_PLAYERS.every((p,i)=>{
      const q=playerFrame.players[i];
      return q?.id===p.id&&q.team===p.team&&q.role===p.role&&
       [q.x,q.y,q.vx,q.vy].every(finite);
     })||
     !known(foot.started)||!known(foot.active)||!known(foot.ended)||
     !physics.ball?.position||!physics.ball?.velocity||
     !['x','y','z'].every(k=>finite(physics.ball.position[k])&&
      finite(physics.ball.velocity[k]))||
     (action!==null&&(
      action.tick!==t||action.appliedByRapier!==true||
      action.actualPhysicsImpulseApplied!==true||
      action.officialMatchAction!==false||
      !ids.has(action.playerId)||foot.started.length!==1||
      foot.started[0]!==action.playerId)))
   throw new TypeError('M28 needs original 22-player native Rapier tick');
  const choice=physicalReceiverChoice;
  if(active&&(choice?.tick!==active.start||choice.actorId!==active.id||
     choice.decision!=='defer-clearance-to-keep-ball-near'||
     choice.physicalImpulseAllowed!==false))
   throw new TypeError('M28 original M27 source cannot change');
  if(choice?.tick===t&&choice.decision==='defer-clearance-to-keep-ball-near'){
   const id=choice.actorId,p=playerFrame.players.find(p=>p.id===id);
   if(active||latestCompleted||!['home-9','away-9'].includes(id)||
      !p||p.team!==choice.team||
      choice.genuineNativeSecondShoeStart!==true||
      choice.physicalImpulseAllowed!==false||
      choice.officialPossession!==false||choice.matchAuthority!==false||
      physicalFirstTouch?.actorId!==id||
      physicalFirstTouch?.tick!==choice.previousRealCushionTick||
      !Number.isSafeInteger(physicalFirstTouch.tick)||
      physicalFirstTouch.tick>=t||
      physicalFirstTouch.nativeExclusiveShoeStart!==true||
      physicalFirstTouch.actualPhysicsImpulseApplied!==true||
      physicalFirstTouch.originalRapierBallBody!==true||
      foot.started.length!==1||foot.active.length!==1||
      foot.started[0]!==id||foot.active[0]!==id||action!==null)
    throw new TypeError('M28 requires real second un-kicked shoe START');
   if(playerFrame.players.filter(q=>q.team!==p.team).length!==11)
    throw new TypeError('M28 must have exactly 11 real defenders');
   const d=gap(p,physics.ball.position),v=physics.ball.velocity;
   active={id,team:p.team,start:t,cushionTick:physicalFirstTouch.tick,
    lastTick:t-1,samples:0,shoeActive:0,recontacts:0,
    otherStart:null,nextAction:null,near:0,streak:0,longest:0,
    underPressure:0,minGap:d,maxGap:d,lastGap:d,minOpponent:Infinity,
    travel:0,previous:null,firstSpeed:Math.hypot(v.x,v.y),
    lastSpeed:Math.hypot(v.x,v.y)};
  }
  if(active){
   const different=foot.started.find(id=>id!==active.id);
   if(different){
    active.otherStart=t;finish('different-genuine-shoe-start');
   }else if(action){
    active.nextAction=freeze({tick:t,playerId:action.playerId,
     action:action.action,actualPhysicsImpulseApplied:true});
    if(foot.started.includes(active.id))active.recontacts++;
    finish('new-genuine-physical-action');
   }else{
    const actor=playerFrame.players.find(p=>p.id===active.id),
     opponents=playerFrame.players.filter(p=>p.team!==active.team);
    const ball=physics.ball,d=gap(ball.position,actor);
    if(opponents.length!==11||!finite(d))
     throw new TypeError('M28 lost true actor or opponent source');
    const nearest=Math.min(...opponents.map(p=>gap(p,actor)));
    if(!finite(nearest))throw new TypeError('M28 needs physical defender');
    if(active.previous)active.travel+=gap(ball.position,active.previous);
    active.previous=freeze({...ball.position});
    active.minGap=Math.min(active.minGap,d);
    active.maxGap=Math.max(active.maxGap,d);active.lastGap=d;
    active.minOpponent=Math.min(active.minOpponent,nearest);
    if(d<=1){active.near++;active.streak++;}else active.streak=0;
    active.longest=Math.max(active.longest,active.streak);
    if(nearest<=3)active.underPressure++;
    if(foot.active.includes(active.id))active.shoeActive++;
    if(t>active.start&&foot.started.includes(active.id))active.recontacts++;
    active.lastTick=t;active.samples++;
    active.lastSpeed=Math.hypot(ball.velocity.x,ball.velocity.y);
    if(active.samples===M28_FOLLOW_THROUGH_TICKS)
     finish('two-second-native-observation-complete');
   }
  }
  tick=t;return snapshot();
 }
 function snapshot(){
  if(tick<0)throw new TypeError('M28 observation not started');
  return freeze({
   version:'m28-read-only-real-follow-through-observer-v1',
   tick,active:active?report(active):null,latestCompleted,
   readOnly:true,original22Source:true,matchAuthority:false,
   verifiedControl:false,verifiedReception:false,
   verifiedInterception:false,verifiedTackle:false,
   verifiedPossession:false,officialMatchAction:false
  });
 }
 return freeze({observe,snapshot});
}
