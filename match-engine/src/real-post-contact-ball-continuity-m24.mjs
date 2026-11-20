// #628 M24: truthful 60Hz post-contact ball continuity from the ORIGINAL
// closed one-World Action LAB. Read-only, non-authorizing. Neither distance
// nor even sixty physical samples alone constitutes possession or a tackle.
import {INITIAL_PLAYERS} from './player-movement.mjs';

export const M24_OBSERVATION_TICKS=60; // one second, 60Hz; observational ONLY
const freeze=Object.freeze;
const ids=new Set(INITIAL_PLAYERS.map(p=>p.id));
const finite=v=>Number.isFinite(v);
const round=v=>Math.round(v*10000)/10000;
const length3=v=>Math.hypot(v.x,v.y,v.z);
const distance3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const distance2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const knownList=a=>Array.isArray(a)&&new Set(a).size===a.length&&
 a.every(x=>ids.has(x));

export function createRealPostContactBallContinuity(){
 let lastTick=-1,active=null,latestCompleted=null;
 const completed=[],seen=new Set();
 const report=(state,{endReason=null}={})=>freeze({
  source:'one-original-rapier-ball-after-genuine-shoe-onset',
  kind:state.kind,actorId:state.actorId,
  onsetTick:state.onsetTick,lastTick:state.lastTick,
  observedTicks:state.observedTicks,
  actualShoeActiveTicks:state.shoeActiveTicks,
  additionalGenuineSamePlayerShoeStarts:state.sameActorRecontacts,
  actualShoeEndTick:state.shoeEndTick,
  cumulativeBallTravelXYM:round(state.travelXY),
  cumulativeBallTravel3DM:round(state.travel3D),
  initialBallSpeedMps:round(state.initialSpeed),
  lastBallSpeedMps:round(state.lastSpeed),
  maximumBallSpeedMps:round(state.maxSpeed),
  initialBallCentreToPlayerXYM:round(state.initialGap),
  finalBallCentreToPlayerXYM:round(state.lastGap),
  minimumBallCentreToPlayerXYM:round(state.minGap),
  maximumBallCentreToPlayerXYM:round(state.maxGap),
  initialBallCentreZM:round(state.initialHeight),
  lastBallCentreZM:round(state.lastHeight),
  firstOtherNativeShoeStartTick:state.firstOtherStart,
  completedObservation:endReason!==null,
  endReason,
  controlOutcomeUndetermined:true,
  verifiedBallControl:false,verifiedReception:false,
  verifiedInterception:false,verifiedTackle:false,
  verifiedPossession:false,officialMatchAction:false
 });
 function finish(why){
  if(!active)return;
  latestCompleted=report(active,{endReason:why});
  completed.push(latestCompleted);
  active=null;
 }
 function observe({physics,playerFrame,foot,decisionEvidence}={}){
  const tick=physics?.tick;
  if(!Number.isSafeInteger(tick)||tick!==lastTick+1||tick<0||
     playerFrame?.tick!==tick||foot?.tick!==tick||
     decisionEvidence?.tick!==tick||
     decisionEvidence.nativeSourceObserverOnly!==true||
     decisionEvidence.readOnly!==true||
     decisionEvidence.matchAuthority!==false||
     decisionEvidence.officialPossession!==false||
     !Array.isArray(playerFrame.players)||playerFrame.players.length!==22||
     !INITIAL_PLAYERS.every((p,i)=>{
      const q=playerFrame.players[i];
      return q?.id===p.id&&q.team===p.team&&q.role===p.role&&
       [q.x,q.y].every(finite);
     })||
     !knownList(foot.started)||!knownList(foot.ended)||
     !knownList(foot.active)||
     !physics.ball?.position||!physics.ball?.velocity||
     !['x','y','z'].every(k=>finite(physics.ball.position[k])&&
      finite(physics.ball.velocity[k])))
   throw new TypeError('M24 needs consecutive original Rapier and M23 read-only evidence');
  const candidate=decisionEvidence.current?.kind;
  const first=candidate==='possible-post-pass-receiver-contact'?
   decisionEvidence.firstPossibleReception:
   candidate==='possible-opponent-pass-interruption'?
   decisionEvidence.firstPossibleOpponentInterruption:null;
  const newCandidate=first?.tick===tick&&
   !seen.has(candidate);
  if(newCandidate){
   if(!ids.has(first.playerId)||
      decisionEvidence.current.actorId!==first.playerId||
      decisionEvidence.current.exclusiveRealShoeStart!==true||
      foot.started.length!==1||foot.active.length!==1||
      foot.started[0]!==first.playerId||
      foot.active[0]!==first.playerId)
    throw new TypeError('M24 never opens a sample without actual exclusive shoe START');
  }
  const anotherTouch=active&&foot.started.some(id=>id!==active.actorId);
  // An opponent or teammate touching the ball ends attribution of the
  // current trace. That real newer contact belongs to a NEW window only
  // when M23 independently provides a fresh candidate.
  if(anotherTouch){
   active.firstOtherStart=tick;
   finish('different-real-shoe-start');
  }
  if(newCandidate){
   if(active)finish('new-real-candidate-shoe-start');
   seen.add(candidate);
   const ball=physics.ball,actor=playerFrame.players.find(p=>p.id===first.playerId);
   const speed=length3(ball.velocity),gap=distance2(ball.position,actor);
   active={kind:candidate,actorId:first.playerId,onsetTick:tick,
    lastTick:tick-1,observedTicks:0,shoeActiveTicks:0,
    shoeEndTick:null,sameActorRecontacts:0,
    travelXY:0,travel3D:0,
    initialSpeed:speed,lastSpeed:speed,maxSpeed:speed,
    initialGap:gap,lastGap:gap,minGap:gap,maxGap:gap,
    initialHeight:ball.position.z,lastHeight:ball.position.z,
    lastBallPosition:null,firstOtherStart:null};
  }
  if(active){
   if(tick!==active.onsetTick&&foot.started.includes(active.actorId))
    active.sameActorRecontacts++;
   const ball=physics.ball,actor=playerFrame.players.find(p=>p.id===active.actorId);
   const speed=length3(ball.velocity),gap=distance2(ball.position,actor);
   if(active.lastBallPosition){
    active.travelXY+=distance2(ball.position,active.lastBallPosition);
    active.travel3D+=distance3(ball.position,active.lastBallPosition);
   }
   active.lastBallPosition=freeze({...ball.position});
   active.lastSpeed=speed;active.maxSpeed=Math.max(active.maxSpeed,speed);
   active.lastGap=gap;active.minGap=Math.min(active.minGap,gap);
   active.maxGap=Math.max(active.maxGap,gap);active.lastHeight=ball.position.z;
   active.lastTick=tick;active.observedTicks++;
   if(foot.active.includes(active.actorId))active.shoeActiveTicks++;
   if(foot.ended.includes(active.actorId)&&active.shoeEndTick===null)
    active.shoeEndTick=tick;
   // This closes a fixed OBSERVATION window, not a successful receipt.
   if(active.observedTicks===M24_OBSERVATION_TICKS)
    finish('one-second-observation-complete');
  }
  lastTick=tick;
  return snapshot();
 }
 function snapshot(){
  if(lastTick<0)throw new TypeError('M24 not yet observing original physical source');
  return freeze({
   version:'m24-one-second-real-ball-post-contact-trace-v1',
   tick:lastTick,active:active?report(active):null,
   latestCompleted,completedCount:completed.length,
   completed:freeze([...completed]),
   physicallyObservedOnly:true,readOnly:true,
   original22Source:true,matchAuthority:false,
   verifiedBallControl:false,verifiedReception:false,
   verifiedInterception:false,verifiedTackle:false,
   verifiedPossession:false,officialMatchAction:false
  });
 }
 return freeze({observe,snapshot});
}
