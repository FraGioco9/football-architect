// ME-PB-42 — strict read-only 60Hz physical second-shoe episode / ball motion.
// Whole-world ball delta-v is NOT an individual shoe impulse or possession.
import {ENGINE_VERSION,FIXED_DT,BALL_MASS_KG}
 from './core.mjs';
import {SECOND_CONTACT_EVIDENCE_VERSION}
 from './player-ball-second-contact-evidence.mjs';
import {FOOT_CONTACT_VERSION}
 from './player-foot-contact.mjs';
import {INITIAL_PLAYERS,PLAYER_PITCH}
 from './player-movement.mjs';

export const SECOND_EPISODE_VERSION='me-pb-42-second-contact-trajectory-v1';
export const SECOND_EPISODE_MAX_TICKS=60;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const reject=()=>{throw new TypeError(
 'Consecutive actual Rapier second-shoe episode and measured ball snapshots required'
);};
const ids=()=>INITIAL_PLAYERS.map(p=>p.id);
const validIds=a=>{
 const order=ids();
 return Array.isArray(a)&&new Set(a).size===a.length&&a.every((x,i)=>
  typeof x==='string'&&order.includes(x)&&
   (i===0||order.indexOf(a[i-1])<order.indexOf(x)));
};
const vec=o=>Object.freeze({x:o.x,y:o.y,z:o.z});
const delta=(v,w)=>vec({x:v.x-w.x,y:v.y-w.y,z:v.z-w.z});
const length2=v=>Math.hypot(v.x,v.y);
const magnitude=v=>Math.hypot(v.x,v.y,v.z);
function heading(a,b){
 const aa=length2(a),bb=length2(b);
 if(aa<0.2||bb<0.2)return null;
 const cos=(a.x*b.x+a.y*b.y)/(aa*bb);
 return Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI;
}
function validateBall(s){
 if(!s||s.version!==ENGINE_VERSION||
    !Number.isSafeInteger(s.tick)||s.tick<0||
    !finite(s.time)||Math.abs(s.time-s.tick*FIXED_DT)>1e-8||
    !s.ball?.position||!s.ball?.velocity||
    !['x','y','z'].every(k=>
      finite(s.ball.position[k])&&finite(s.ball.velocity[k]))||
    Math.abs(s.ball.position.x)>PLAYER_PITCH.lengthM/2||
    Math.abs(s.ball.position.y)>PLAYER_PITCH.widthM/2||
    s.ball.position.z<0||s.ball.position.z>30)reject();
}
function verifyLedger(before,contact){
 if(!validIds(before)||!validIds(contact.started)||
    !validIds(contact.ended)||!validIds(contact.active))reject();
 const old=new Set(before),next=new Set(contact.active);
 const start=new Set(contact.started),end=new Set(contact.ended);
 for(const id of start)if(old.has(id)&&!end.has(id))reject();
 for(const id of end)if(!old.has(id)&&!start.has(id))reject();
 for(const id of new Set([...old,...next,...start,...end])){
  if(start.has(id)&&end.has(id))continue; // genuine transient
  if(next.has(id)!==((old.has(id)||start.has(id))&&!end.has(id)))
   reject();
 }
}
function validate({previous,secondContactEvidence,before,after,contactFrame}){
 const e=secondContactEvidence,f=contactFrame;
 if(!e||e.version!==SECOND_CONTACT_EVIDENCE_VERSION||
    e.status!=='distinct-physical-shoe-start-observed'||
    e.realDistinctSecondShoeStartObserved!==true||
    e.noInterveningShoeStartObserved!==true||e.terminal!==true||
    !Number.isSafeInteger(e.releaseClearPhysicsTick)||
    !Number.isSafeInteger(e.secondShoePhysicsTick)||
    e.secondShoePhysicsTick<=e.releaseClearPhysicsTick||
    e.secondShoePhysicsTick!==e.observedPhysicsTick||
    !ids().includes(e.secondShoeId)||!ids().includes(e.releaseShoeId)||
    e.releaseShoeId===e.secondShoeId||
    !INITIAL_PLAYERS.some(p=>p.id===e.secondShoeId&&p.role!=='goalkeeper')||
    e.controlConfirmed!==false||e.officialPossession!==false||
    e.interceptionProven!==false||e.freeBallOfficiallyProven!==false||
    e.ballForceApplied!==false||e.passCreated!==false||
    !f||f.version!==FOOT_CONTACT_VERSION||
    !Number.isSafeInteger(f.tick))reject();
 validateBall(before);validateBall(after);
 if(after.tick!==before.tick+1||f.tick!==after.tick||
    after.tick<e.secondShoePhysicsTick||
    after.tick>=e.secondShoePhysicsTick+SECOND_EPISODE_MAX_TICKS)
   reject();
 if(previous===null){
  if(after.tick!==e.secondShoePhysicsTick||
     !f.started.includes(e.secondShoeId)||
     !f.active.includes(e.secondShoeId)||
     f.started.length!==1||f.ended.length!==0||
     !validIds(e.activeShoes)||e.activeShoes.join(',')!==
      f.active.join(','))reject();
  verifyLedger([],f);
  return;
 }
 const p=previous;
 if(!p||p.version!==SECOND_EPISODE_VERSION||p.terminal!==false||
    p.contactStartPhysicsTick!==e.secondShoePhysicsTick||
    p.firstShoeId!==e.releaseShoeId||
    p.secondShoeId!==e.secondShoeId||
    p.releaseClearPhysicsTick!==e.releaseClearPhysicsTick||
    p.observedPhysicsTick!==before.tick||
    p.samplesObserved!==before.tick-e.secondShoePhysicsTick+1||
    p.samplesObserved<1||
    p.realSecondShoeEndObserved!==false||p.contactEndPhysicsTick!==null||
    p.officialPossession!==false||p.controlConfirmed!==false||
    p.interceptionProven!==false||p.ballForceApplied!==false||
    !p.lastBallPosition||!p.lastBallVelocity||
    ['x','y','z'].some(k=>
      p.lastBallPosition[k]!==before.ball.position[k]||
      p.lastBallVelocity[k]!==before.ball.velocity[k])||
    !p.initialBallPosition||!p.initialBallVelocity||
    !finite(p.accumulatedPlanarTravelM)||p.accumulatedPlanarTravelM<0||
    !validIds(p.activeShoes))reject();
 verifyLedger(p.activeShoes,f);
}
export function observeSecondPhysicalShoeEpisode({
 previous=null,secondContactEvidence,before,after,contactFrame
}){
 validate({previous,secondContactEvidence,before,after,contactFrame});
 const tick=after.tick,id=secondContactEvidence.secondShoeId;
 const competing=contactFrame.started.some(x=>x!==id)||
  contactFrame.ended.some(x=>x!==id)||
  contactFrame.active.some(x=>x!==id);
 const genuineEnd=Boolean(previous&&
  previous.activeShoes.includes(id)&&contactFrame.ended.includes(id)&&
  !contactFrame.started.includes(id)&&!contactFrame.active.includes(id));
 const finishedByLimit=tick-secondContactEvidence.secondShoePhysicsTick===
  SECOND_EPISODE_MAX_TICKS-1;
 const terminal=competing||genuineEnd||finishedByLimit;
 const status=competing?'competing-physical-shoe-event':
  genuineEnd?'real-second-shoe-end':
  finishedByLimit?'observation-window-exhausted':'active-second-shoe-contact';
 const startPosition=previous?.initialBallPosition??before.ball.position;
 const startVelocity=previous?.initialBallVelocity??before.ball.velocity;
 const stepDelta=delta(after.ball.velocity,before.ball.velocity);
 const overallDelta=delta(after.ball.velocity,startVelocity);
 const path=(previous?.accumulatedPlanarTravelM??0)+
  Math.hypot(after.ball.position.x-before.ball.position.x,
             after.ball.position.y-before.ball.position.y);
 const initialMagnitude=length2(startVelocity);
 const currentMagnitude=length2(after.ball.velocity);
 const speedChange=currentMagnitude-initialMagnitude;
 return Object.freeze({
  version:SECOND_EPISODE_VERSION,
  contactStartPhysicsTick:secondContactEvidence.secondShoePhysicsTick,
  releaseClearPhysicsTick:secondContactEvidence.releaseClearPhysicsTick,
  firstShoeId:secondContactEvidence.releaseShoeId,
  secondShoeId:id,
  observedPhysicsTick:tick,
  samplesObserved:(previous?.samplesObserved??0)+1,
  activeShoes:Object.freeze([...contactFrame.active]),
  activeContactSampleTicks:(previous?.activeContactSampleTicks??0)+
   (contactFrame.active.includes(id)?1:0),
  contactEndPhysicsTick:genuineEnd?tick:null,
  contactDurationTicks:genuineEnd?
   tick-secondContactEvidence.secondShoePhysicsTick:null,
  realSecondShoeEndObserved:genuineEnd,
  initialBallPosition:previous?.initialBallPosition??vec(startPosition),
  initialBallVelocity:previous?.initialBallVelocity??vec(startVelocity),
  lastBallPosition:vec(after.ball.position),
  lastBallVelocity:vec(after.ball.velocity),
  startStepDeltaVelocityWorldMps:previous?.startStepDeltaVelocityWorldMps??
   stepDelta,
  latestStepDeltaVelocityWorldMps:stepDelta,
  netBallDeltaVelocityWorldMps:overallDelta,
  netWholeBallMomentumDeltaWorldNs:vec({
   x:overallDelta.x*BALL_MASS_KG,y:overallDelta.y*BALL_MASS_KG,
   z:overallDelta.z*BALL_MASS_KG
  }),
  incomingGroundSpeedMps:initialMagnitude,
  currentGroundSpeedMps:currentMagnitude,
  groundSpeedChangeMps:speedChange,
  observedHeadingDifferenceDeg:heading(startVelocity,after.ball.velocity),
  accumulatedPlanarTravelM:path,
  planarDisplacementFromStartM:Math.hypot(
   after.ball.position.x-startPosition.x,
   after.ball.position.y-startPosition.y
  ),
  maximumObservedBallSpeedMps:Math.max(
   previous?.maximumObservedBallSpeedMps??initialMagnitude,
   magnitude(after.ball.velocity)
  ),
  terminal,status,
  // A change in the WHOLE BALL velocity is never proof of per-foot causality.
  physicalCauseExclusivelyProven:false,
  officialPossession:false,controlConfirmed:false,
  interceptionProven:false,freeBallOfficiallyProven:false,
  passCreated:false,ballForceApplied:false
 });
}
