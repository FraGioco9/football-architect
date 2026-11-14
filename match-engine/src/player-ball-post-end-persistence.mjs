// ME-PB-44 — clean, post-real-END Rapier matched-world persistence.
// Bounded read-only evidence. A later real shoe START/END censors the
// tail; persistence of the ball's WHOLE-WORLD trajectory is not possession.
import {ENGINE_VERSION,FIXED_DT} from './core.mjs';
import {FOOT_CONTACT_VERSION} from './player-foot-contact.mjs';
import {SECOND_SHOE_ABLATION_VERSION}
 from './player-ball-second-ablation.mjs';
import {INITIAL_PLAYERS} from './player-movement.mjs';

export const POST_END_PERSISTENCE_VERSION='me-pb-44-post-end-clean-tail-v1';
export const POST_END_MIN_CONSECUTIVE_TICKS=8;
export const POST_END_MIN_POSITION_DIFFERENCE_M=0.01;
export const POST_END_MIN_VELOCITY_DIFFERENCE_MPS=0.1;
export const POST_END_MAX_WINDOW_TICKS=60;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const reject=()=>{throw new TypeError(
 'Consecutive authentic Rapier matched-world post-END frames required'
);};
const v3=x=>x&&['x','y','z'].every(k=>finite(x[k]));
function validFrame(s){
 return s&&s.version===ENGINE_VERSION&&
  Number.isSafeInteger(s.tick)&&s.tick>0&&finite(s.time)&&
  Math.abs(s.time-s.tick*FIXED_DT)<1e-8&&
  v3(s.ball?.position)&&v3(s.ball?.velocity);
}
function idList(xs){
 const order=INITIAL_PLAYERS.map(p=>p.id);
 return Array.isArray(xs)&&new Set(xs).size===xs.length&&
  xs.every((id,i)=>order.includes(id)&&
   (i===0||order.indexOf(xs[i-1])<order.indexOf(id)));
}
function validFoot(f,tick){
 return f&&f.version===FOOT_CONTACT_VERSION&&f.tick===tick&&
  idList(f.started)&&idList(f.ended)&&idList(f.active);
}
function checkEvents(before,f){
 const b=new Set(before),a=new Set(f.active),s=new Set(f.started),
  e=new Set(f.ended);
 for(const id of s)if(b.has(id)&&!e.has(id))reject();
 for(const id of e)if(!b.has(id)&&!s.has(id))reject();
 for(const id of new Set([...b,...a,...s,...e])){
  if(s.has(id)&&e.has(id))continue;
  if(a.has(id)!==((b.has(id)||s.has(id))&&!e.has(id)))reject();
 }
}
const clone=v=>Object.freeze({x:v.x,y:v.y,z:v.z});
const norm=v=>Math.hypot(v.x,v.y,v.z);
const delta=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
function validate({previous,matched,full,ablated,sham,fullFoot,ablatedFoot,
 shamFoot,secondShoeId}){
 const f=full, a=ablated, h=sham, m=matched;
 if(!validFrame(f)||!validFrame(a)||!validFrame(h)||
    f.tick!==a.tick||a.tick!==h.tick||
    !validFoot(fullFoot,f.tick)||!validFoot(ablatedFoot,f.tick)||
    !validFoot(shamFoot,f.tick)||
    !m||m.version!==SECOND_SHOE_ABLATION_VERSION||
    m.observedPhysicsTick!==f.tick||
    m.omittedShoeId!==secondShoeId||
    m.fullShoeStartObserved!==true||
    !Number.isSafeInteger(m.fullShoeFirstStartPhysicsTick)||
    !Number.isSafeInteger(m.fullShoeLastEndPhysicsTick)||
    m.fullShoeFirstStartPhysicsTick>=m.fullShoeLastEndPhysicsTick||
    m.firstWorldDifferencePhysicsTick===null||
    !Number.isSafeInteger(m.firstWorldDifferencePhysicsTick)||
    m.firstWorldDifferencePhysicsTick>m.fullShoeLastEndPhysicsTick||
    m.individualFootImpulseProven!==false||
    m.officialPossession!==false||
    m.controlConfirmed!==false||
    m.interceptionProven!==false||
    m.freeBallOfficiallyProven!==false||
    m.ballForceApplied!==false||
    !INITIAL_PLAYERS.some(p=>p.id===secondShoeId&&p.role!=='goalkeeper')||
    !idList(m.fullActiveShoes)||!idList(m.ablatedActiveShoes)||
    m.fullActiveShoes.join('|')!==fullFoot.active.join('|')||
    m.ablatedActiveShoes.join('|')!==ablatedFoot.active.join('|')||
    [ablatedFoot.started,ablatedFoot.ended,ablatedFoot.active]
     .some(xs=>xs.includes(secondShoeId))||
    [fullFoot.started,fullFoot.ended,fullFoot.active]
     .some(xs=>xs.includes('not-a-player')))reject();
 // The sham is the physical negative, not just an unverified assertion.
 for(const field of ['position','velocity']){
  for(const k of ['x','y','z']){
   if(f.ball[field][k]!==h.ball[field][k])reject();
  }
 }
 const pd=delta(f.ball.position,a.ball.position);
 const vd=delta(f.ball.velocity,a.ball.velocity);
 if(!v3(m.positionDeltaWorldM)||!v3(m.velocityDeltaWorldMps)||
    ['x','y','z'].some(k=>
      m.positionDeltaWorldM[k]!==pd[k]||
      m.velocityDeltaWorldMps[k]!==vd[k])||
    Math.abs(m.ballPositionDifferenceM-norm(pd))>1e-9||
    Math.abs(m.ballVelocityDifferenceMps-norm(vd))>1e-9)reject();
 if(previous===null){
  if(f.tick!==m.fullShoeLastEndPhysicsTick||
     !fullFoot.ended.includes(secondShoeId)||
     fullFoot.started.length!==0||fullFoot.active.length!==0||
     ablatedFoot.started.length!==0||ablatedFoot.active.length!==0||
     shamFoot.started.length!==0||shamFoot.active.length!==0||
     !shamFoot.ended.includes(secondShoeId))reject();
  return;
 }
 const p=previous;
 if(!p||p.version!==POST_END_PERSISTENCE_VERSION||
    p.terminal!==false||p.observedPhysicsTick!==f.tick-1||
    p.secondShoeId!==secondShoeId||
    p.secondEndPhysicsTick!==m.fullShoeLastEndPhysicsTick||
    p.omittedShoeId!==m.omittedShoeId||
    !Number.isSafeInteger(p.cleanPostEndTicks)||
    p.cleanPostEndTicks!==p.observedPhysicsTick-p.secondEndPhysicsTick||
    p.cleanPostEndTicks<0||
    p.cleanPostEndTicks>=POST_END_MAX_WINDOW_TICKS||
    !v3(p.lastFullBallPosition)||!v3(p.lastAblatedBallPosition)||
    !idList(p.fullActiveShoes)||!idList(p.ablatedActiveShoes)||
    !idList(p.shamActiveShoes)||
    p.officialPossession!==false||p.individualFootImpulseProven!==false||
    p.controlConfirmed!==false||p.ballForceApplied!==false)reject();
 checkEvents(p.fullActiveShoes,fullFoot);
 checkEvents(p.ablatedActiveShoes,ablatedFoot);
 checkEvents(p.shamActiveShoes,shamFoot);
}
export function observePostEndMatchedFlight({
 previous=null,matched,full,ablated,sham,fullFoot,ablatedFoot,shamFoot,
 secondShoeId
}){
 validate({previous,matched,full,ablated,sham,fullFoot,ablatedFoot,
  shamFoot,secondShoeId});
 const tick=full.tick,endTick=matched.fullShoeLastEndPhysicsTick;
 const newContact=previous!==null&&[
  fullFoot.started,fullFoot.ended,fullFoot.active,
  ablatedFoot.started,ablatedFoot.ended,ablatedFoot.active,
  shamFoot.started,shamFoot.ended,shamFoot.active
 ].some(xs=>xs.length>0);
 const timedOut=previous!==null&&
  tick-endTick===POST_END_MAX_WINDOW_TICKS;
 const clean=previous!==null&&!newContact;
 const pd=matched.ballPositionDifferenceM,
   vd=matched.ballVelocityDifferenceMps;
 const qualifies=clean&&
  pd>POST_END_MIN_POSITION_DIFFERENCE_M&&
  vd>POST_END_MIN_VELOCITY_DIFFERENCE_MPS;
 const currentStreak=qualifies?
  (previous?.currentPersistenceStreakTicks??0)+1:0;
 const maxStreak=Math.max(previous?.maxPersistenceStreakTicks??0,currentStreak);
 const cleanTicks=(previous?.cleanPostEndTicks??0)+(clean?1:0);
 const travelFull=(previous?.fullPlanarTravelSinceEndM??0)+(clean?
  Math.hypot(full.ball.position.x-previous.lastFullBallPosition.x,
             full.ball.position.y-previous.lastFullBallPosition.y):0);
 const travelAblated=(previous?.ablatedPlanarTravelSinceEndM??0)+(clean?
  Math.hypot(ablated.ball.position.x-previous.lastAblatedBallPosition.x,
             ablated.ball.position.y-previous.lastAblatedBallPosition.y):0);
 const terminal=newContact||timedOut;
 const status=newContact?'censored-by-new-physical-contact':
  timedOut?'bounded-clean-window-complete':
  previous===null?'verified-genuine-second-shoe-end':
  qualifies?'persistent-world-separation':'no-qualifying-world-separation';
 return Object.freeze({
  version:POST_END_PERSISTENCE_VERSION,
  observedPhysicsTick:tick,secondShoeId,omittedShoeId:matched.omittedShoeId,
  secondStartPhysicsTick:matched.fullShoeFirstStartPhysicsTick,
  secondEndPhysicsTick:endTick,
  lastCleanPhysicsTick:clean?tick:
    previous?.lastCleanPhysicsTick??endTick,
  firstContaminatingContactPhysicsTick:newContact?tick:null,
  cleanPostEndTicks:cleanTicks,
  cleanPostEndSeconds:cleanTicks*FIXED_DT,
  currentPersistenceStreakTicks:currentStreak,
  maxPersistenceStreakTicks:maxStreak,
  firstSustainedPhysicsTick:previous?.firstSustainedPhysicsTick??
    (currentStreak>=POST_END_MIN_CONSECUTIVE_TICKS?tick:null),
  sustainedDifferenceObserved:
   (previous?.sustainedDifferenceObserved??false)||
    currentStreak>=POST_END_MIN_CONSECUTIVE_TICKS,
  lastCleanPositionDifferenceM:clean?pd:
   previous?.lastCleanPositionDifferenceM??matched.ballPositionDifferenceM,
  lastCleanVelocityDifferenceMps:clean?vd:
   previous?.lastCleanVelocityDifferenceMps??matched.ballVelocityDifferenceMps,
  minimumCleanVelocityDifferenceMps:clean?
   Math.min(previous?.minimumCleanVelocityDifferenceMps??Infinity,vd):
   previous?.minimumCleanVelocityDifferenceMps??null,
  fullPlanarTravelSinceEndM:travelFull,
  ablatedPlanarTravelSinceEndM:travelAblated,
  lastFullBallPosition:clone(clean?full.ball.position:
   previous?.lastFullBallPosition??full.ball.position),
  lastAblatedBallPosition:clone(clean?ablated.ball.position:
   previous?.lastAblatedBallPosition??ablated.ball.position),
  fullActiveShoes:Object.freeze([...fullFoot.active]),
  ablatedActiveShoes:Object.freeze([...ablatedFoot.active]),
  shamActiveShoes:Object.freeze([...shamFoot.active]),
  terminal,status,
  // A marginal persistent WHOLE-WORLD trajectory difference proves no
  // official football control, singular foot impulse, or possession.
  individualFootImpulseProven:false,controlConfirmed:false,
  officialPossession:false,interceptionProven:false,
  freeBallOfficiallyProven:false,passCreated:false,ballForceApplied:false
 });
}
