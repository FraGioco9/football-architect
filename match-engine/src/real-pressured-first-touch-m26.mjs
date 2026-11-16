// #628 M26 — observe genuine receiver-ball retention against REAL live
// opponents; no distance-inferred collision, interception or possession.
import {INITIAL_PLAYERS} from './player-movement.mjs';
export const M26_PRESSURE_OBSERVATION_TICKS=60;
const freeze=Object.freeze,finite=Number.isFinite;
const ids=new Set(INITIAL_PLAYERS.map(p=>p.id));
const round=n=>Math.round(n*1e4)/1e4;
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function createRealPressuredFirstTouchObserver(){
 let tick=-1,active=null,completed=null;
 const report=(v,termination=null)=>freeze({
  version:'m26-original-pressured-native-receiver-continuity-v1',
  actorId:v.actorId,team:v.team,onsetTick:v.onsetTick,
  observedTicks:v.observedTicks,lastTick:v.lastTick,
  originalPassTick:v.originalPassTick,
  nearestOpponentAtOnsetM:round(v.atOnsetPressure),
  minimumRealOpponentGapM:round(v.minPressure),
  lastRealOpponentGapM:round(v.lastPressure),
  nearestOpponentIdAtOnset:v.opponentAtOnset,
  realOpponentWithin3MTicks:v.within3Ticks,
  realOpponentWithin2MTicks:v.within2Ticks,
  receiverBallWithin1MTicks:v.ballWithin1Ticks,
  receiverBallWithin2MTicks:v.ballWithin2Ticks,
  genuineSameReceiverRecontacts:v.recontacts,
  actualReceivingShoeActiveTicks:v.shoeActiveTicks,
  nearestBallGapM:round(v.minBallGap),
  finalBallGapM:round(v.lastBallGap),
  anyOtherGenuineShoeStartTick:v.otherShoeStartTick,
  endReason:termination,
  observationComplete:termination!==null,
  claimedControl:false,claimedPossession:false,
  officialReception:false,officialInterception:false,
  readOnly:true,observedFromOriginal22:true
 });
 function observe({physics,playerFrame,foot,physicalFirstTouch}={}){
  const t=physics?.tick;
  if(!Number.isSafeInteger(t)||t!==tick+1||t<0||
     playerFrame?.tick!==t||foot?.tick!==t||
     !Array.isArray(playerFrame.players)||playerFrame.players.length!==22||
     !INITIAL_PLAYERS.every((p,i)=>{
      const observed=playerFrame.players[i];
      return observed?.id===p.id&&observed.team===p.team&&
       observed.role===p.role&&
       [observed.x,observed.y].every(finite);
     })||
     !physics.ball?.position||
     !['x','y','z'].every(k=>finite(physics.ball.position[k]))||
     !Array.isArray(foot.started)||!Array.isArray(foot.active)||
     new Set(foot.started).size!==foot.started.length||
     !foot.started.every(id=>ids.has(id))||
     !foot.active.every(id=>ids.has(id)))
   throw new TypeError('M26 requires concurrent genuine 22-player Rapier samples');
  if(physicalFirstTouch!==null&&(
     physicalFirstTouch.originalRapierBallBody!==true||
     physicalFirstTouch.nativeExclusiveShoeStart!==true||
     physicalFirstTouch.actualPhysicsImpulseApplied!==true||
     physicalFirstTouch.officialPossession!==false||
     !ids.has(physicalFirstTouch.actorId)||
     physicalFirstTouch.team!==
      INITIAL_PLAYERS.find(p=>p.id===physicalFirstTouch.actorId).team||
     !Number.isSafeInteger(physicalFirstTouch.tick)||
     physicalFirstTouch.tick>t))
   throw new TypeError('M26 refuses unverified first-touch source');
  const startsNow=physicalFirstTouch?.tick===t&&!active&&!completed;
  if(startsNow){
   if(foot.started.length!==1||foot.active.length!==1||
      foot.started[0]!==physicalFirstTouch.actorId||
      foot.active[0]!==physicalFirstTouch.actorId)
    throw new TypeError('M26 begins ONLY on authentic current exclusive native START');
   const own=playerFrame.players.find(p=>p.id===physicalFirstTouch.actorId);
   const opp=playerFrame.players.filter(p=>p.team!==own.team);
   if(opp.length!==11)throw new TypeError('Exactly 11 actual defenders required');
   const nearest=opp.map(p=>({id:p.id,gapM:gap(p,own)}))
    .sort((a,b)=>a.gapM-b.gapM||a.id.localeCompare(b.id))[0];
   active={
    actorId:own.id,team:own.team,originalPassTick:physicalFirstTouch.originalPassTick,
    onsetTick:t,lastTick:t-1,observedTicks:0,
    atOnsetPressure:nearest.gapM,opponentAtOnset:nearest.id,
    minPressure:nearest.gapM,lastPressure:nearest.gapM,
    within3Ticks:0,within2Ticks:0,
    ballWithin1Ticks:0,ballWithin2Ticks:0,
    shoeActiveTicks:0,recontacts:0,
    minBallGap:Infinity,lastBallGap:Infinity,otherShoeStartTick:null
   };
  }
  if(active){
   // Never use one player's ball-retention trace after another real
   // player touches the ball. End BEFORE counting that new native tick.
   const different=foot.started.find(id=>id!==active.actorId);
   if(different){
    active.otherShoeStartTick=t;
    completed=report(active,'different-player-native-shoe-start');
    active=null;
   }else{
    const own=playerFrame.players.find(p=>p.id===active.actorId);
    const opp=playerFrame.players.filter(p=>p.team!==own.team);
    const closest=Math.min(...opp.map(p=>gap(p,own)));
    const ballGap=gap(physics.ball.position,own);
    if(![closest,ballGap].every(finite))
     throw new TypeError('Measured same-tick opponent and ball gap required');
    active.lastPressure=closest;
    active.minPressure=Math.min(active.minPressure,closest);
    active.lastBallGap=ballGap;
    active.minBallGap=Math.min(active.minBallGap,ballGap);
    if(closest<=3)active.within3Ticks++;
    if(closest<=2)active.within2Ticks++;
    if(ballGap<=1)active.ballWithin1Ticks++;
    if(ballGap<=2)active.ballWithin2Ticks++;
    if(foot.active.includes(own.id))active.shoeActiveTicks++;
    if(t!==active.onsetTick&&foot.started.includes(own.id))
     active.recontacts++;
    active.lastTick=t;active.observedTicks++;
    if(active.observedTicks===M26_PRESSURE_OBSERVATION_TICKS){
     completed=report(active,'one-second-real-physical-observation');
     active=null;
    }
   }
  }
  tick=t;
  return snapshot();
 }
 function snapshot(){
  if(tick<0)throw new TypeError('M26 requires genuine source observation');
  return freeze({
   version:'m26-native-live-pressure-window-v1',
   tick,active:active?report(active):null,completed,
   original22SourceOnly:true,readOnly:true,matchAuthority:false,
   verifiedControl:false,verifiedReception:false,
   verifiedInterception:false,verifiedTackle:false,
   verifiedPossession:false
  });
 }
 return freeze({observe,snapshot});
}
