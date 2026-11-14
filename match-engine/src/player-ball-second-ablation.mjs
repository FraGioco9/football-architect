// ME-PB-43 — matched Rapier 22-shoe vs 21-shoe world counterfactual.
// Whole-world divergence, NOT a unique foot impulse, touch intent or possession.
// The caller supplies identical canonical 22-player motion to both worlds.
import {ENGINE_VERSION,FIXED_DT} from './core.mjs';
import {FOOT_CONTACT_VERSION} from './player-foot-contact.mjs';
import {INITIAL_PLAYERS} from './player-movement.mjs';

export const SECOND_SHOE_ABLATION_VERSION='me-pb-43-second-shoe-matched-world-v1';
export const SECOND_SHOE_ABLATION_EPSILON=1e-6;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const invalid=()=>{throw new TypeError('Consecutive matched actual Rapier counterfactual required');};
function canonicalIds(a){
 const ids=INITIAL_PLAYERS.map(p=>p.id); // lazy due to ESM cycle
 return Array.isArray(a)&&a.length===new Set(a).size&&
  a.every((id,i)=>typeof id==='string'&&ids.includes(id)&&
    (i===0||ids.indexOf(a[i-1])<ids.indexOf(id)));
}
function validateSnapshot(snapshot){
 if(!snapshot||snapshot.version!==ENGINE_VERSION||
    !Number.isSafeInteger(snapshot.tick)||snapshot.tick<1||
    !finite(snapshot.time)||Math.abs(snapshot.time-snapshot.tick*FIXED_DT)>1e-8||
    !snapshot.ball?.position||!snapshot.ball?.velocity||
    ['position','velocity'].some(k=>['x','y','z'].some(a=>
      !finite(snapshot.ball[k][a]))))invalid();
}
function ledger(previous,foot){
 if(!foot||foot.version!==FOOT_CONTACT_VERSION||
   !canonicalIds(foot.started)||!canonicalIds(foot.ended)||
   !canonicalIds(foot.active))invalid();
 const before=new Set(previous),after=new Set(foot.active);
 const started=new Set(foot.started),ended=new Set(foot.ended);
 for(const id of started)if(before.has(id)&&!ended.has(id))invalid();
 for(const id of ended)if(!before.has(id)&&!started.has(id))invalid();
 for(const id of new Set([...before,...after,...started,...ended])){
  if(started.has(id)&&ended.has(id))continue;
  if(after.has(id)!==((before.has(id)||started.has(id))&&!ended.has(id)))
   invalid();
 }
}
const difference=(a,b)=>Object.freeze({
 x:a.x-b.x,y:a.y-b.y,z:a.z-b.z
});
const magnitude=a=>Math.hypot(a.x,a.y,a.z);
const xy=a=>Math.hypot(a.x,a.y);
export function observeMatchedSecondShoeAblation({
 previous=null,full,withoutSecondShoe,fullFoot,ablatedFoot,omittedShoeId
}){
 validateSnapshot(full);validateSnapshot(withoutSecondShoe);
 const tick=full.tick,ids=INITIAL_PLAYERS.map(p=>p.id);
 if(full.tick!==withoutSecondShoe.tick||
    !ids.includes(omittedShoeId)||
    !INITIAL_PLAYERS.some(p=>p.id===omittedShoeId&&p.role!=='goalkeeper')||
    fullFoot?.tick!==tick||ablatedFoot?.tick!==tick||
    !fullFoot||!ablatedFoot||
    [ablatedFoot.started,ablatedFoot.ended,ablatedFoot.active]
      .some(ids=>!Array.isArray(ids)||ids.includes(omittedShoeId)))invalid();
 if(previous!==null&&(
    !previous||previous.version!==SECOND_SHOE_ABLATION_VERSION||
    previous.observedPhysicsTick!==tick-1||
    previous.omittedShoeId!==omittedShoeId||
    previous.officialPossession!==false||
    previous.individualFootImpulseProven!==false||
    !canonicalIds(previous.fullActiveShoes)||
    !canonicalIds(previous.ablatedActiveShoes)))invalid();
 if(previous===null&&tick!==1)invalid();
 ledger(previous?.fullActiveShoes??[],fullFoot);
 ledger(previous?.ablatedActiveShoes??[],ablatedFoot);
 const positionDelta=difference(full.ball.position,withoutSecondShoe.ball.position);
 const velocityDelta=difference(full.ball.velocity,withoutSecondShoe.ball.velocity);
 const positionDifferenceM=magnitude(positionDelta);
 const velocityDifferenceMps=magnitude(velocityDelta);
 const divergent=positionDifferenceM>SECOND_SHOE_ABLATION_EPSILON||
   velocityDifferenceMps>SECOND_SHOE_ABLATION_EPSILON;
 const fullShoeStart=fullFoot.started.includes(omittedShoeId);
 const fullShoeEnd=fullFoot.ended.includes(omittedShoeId);
 return Object.freeze({
  version:SECOND_SHOE_ABLATION_VERSION,
  observedPhysicsTick:tick,
  omittedShoeId,
  fullActiveShoes:Object.freeze([...fullFoot.active]),
  ablatedActiveShoes:Object.freeze([...ablatedFoot.active]),
  fullShoeFirstStartPhysicsTick:previous?.fullShoeFirstStartPhysicsTick??
    (fullShoeStart?tick:null),
  fullShoeLastEndPhysicsTick:fullShoeEnd?tick:
    previous?.fullShoeLastEndPhysicsTick??null,
  firstWorldDifferencePhysicsTick:previous?.firstWorldDifferencePhysicsTick??
    (divergent?tick:null),
  fullShoeStartObserved:fullShoeStart||
    (previous?.fullShoeStartObserved??false),
  ablatedShoeContactEventsObserved:false,
  positionDeltaWorldM:positionDelta,
  velocityDeltaWorldMps:velocityDelta,
  ballPositionDifferenceM:positionDifferenceM,
  ballVelocityDifferenceMps:velocityDifferenceMps,
  ballPlanarPositionDifferenceM:xy(positionDelta),
  ballPlanarVelocityDifferenceMps:xy(velocityDelta),
  fullGroundSpeedMps:xy(full.ball.velocity),
  ablatedGroundSpeedMps:xy(withoutSecondShoe.ball.velocity),
  fullMinusAblatedGroundSpeedMps:
   xy(full.ball.velocity)-xy(withoutSecondShoe.ball.velocity),
  status:divergent?'worlds-physically-divergent':'worlds-identical-at-tick',
  // Removing a collider changes the simulated world's full trajectory,
  // even with matched kinematic inputs. No individual shoe impulse proven.
  individualFootImpulseProven:false,
  officialPossession:false,controlConfirmed:false,
  interceptionProven:false,freeBallOfficiallyProven:false,
  passCreated:false,ballForceApplied:false
 });
}
