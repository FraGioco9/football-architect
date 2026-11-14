// ME-PB-41 — strictly observed second genuine Rapier shoe START after
// an already measured uncontested-ball clearance. Experimental, read-only.
// This never declares control, an interception, or any official possession.
import {INITIAL_PLAYERS,PLAYER_PITCH,PLAYER_MAX_SPEED_MPS}
 from './player-movement.mjs';
import {FOOT_CONTACT_VERSION,footProxyTransform}
 from './player-foot-contact.mjs';
import {RELEASE_EVIDENCE_VERSION,RELEASE_CLEAR_TICKS}
 from './player-ball-release-evidence.mjs';

export const SECOND_CONTACT_EVIDENCE_VERSION='me-pb-41-real-new-shoe-start-v1';
export const SECOND_CONTACT_MAX_POST_CLEAR_TICKS=180;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const fail=()=>{throw new TypeError(
 'Consecutive real Rapier shoe START after authenticated measured clearance required'
);};
function validIds(items){
 const all=INITIAL_PLAYERS.map(p=>p.id); // lazy: cyclic movement module
 return Array.isArray(items)&&new Set(items).size===items.length&&
  items.every((id,i)=>typeof id==='string'&&all.includes(id)&&
   (i===0||all.indexOf(items[i-1])<all.indexOf(id)));
}
function outfielder(id){
 return INITIAL_PLAYERS.some(p=>p.id===id&&p.role!=='goalkeeper');
}
function validate({previous,releaseEvidence,contactFrame,players,ball}){
 const release=releaseEvidence,contact=contactFrame;
 if(!release||release.version!==RELEASE_EVIDENCE_VERSION||
    release.trueShoeEndObserved!==true||
    !Number.isSafeInteger(release.contactTick)||
    !Number.isSafeInteger(release.initiatedAtMovementTick)||
    !Number.isSafeInteger(release.shoeEndPhysicsTick)||
    !Number.isSafeInteger(release.firstUncontestedPhysicsTick)||
    !Number.isSafeInteger(release.observedPhysicsTick)||
    release.firstUncontestedPhysicsTick!==release.observedPhysicsTick||
    release.firstUncontestedPhysicsTick<=release.shoeEndPhysicsTick||
    release.currentlyMeasuredUncontested!==true||
    release.provisionalUncontestedObserved!==true||
    release.clearTicks<RELEASE_CLEAR_TICKS||
    !outfielder(release.endedShoeId)||
    release.activeShoes?.length!==0||
    release.officialPossession!==false||
    release.controlConfirmed!==false||
    release.interceptionProven!==false||
    release.freeBallOfficiallyProven!==false||
    release.ballForceApplied!==false||
    !contact||contact.version!==FOOT_CONTACT_VERSION||
    !Number.isSafeInteger(contact.tick)||
    !validIds(contact.started)||!validIds(contact.ended)||
    !validIds(contact.active)||
    !Array.isArray(players)||players.length!==INITIAL_PLAYERS.length||
    !ball||!ball.position||!ball.velocity||
    !['x','y','z'].every(k=>finite(ball.position[k])&&
      finite(ball.velocity[k]))||
    Math.abs(ball.position.x)>PLAYER_PITCH.lengthM/2||
    Math.abs(ball.position.y)>PLAYER_PITCH.widthM/2)fail();
 for(let i=0;i<players.length;i++){
  const p=players[i],original=INITIAL_PLAYERS[i];
  if(!p||p.id!==original.id||p.team!==original.team||
     p.role!==original.role||
     ![p.x,p.y,p.vx,p.vy,p.facingRad].every(finite)||
     Math.abs(p.x)>PLAYER_PITCH.lengthM/2||
     Math.abs(p.y)>PLAYER_PITCH.widthM/2||
     Math.hypot(p.vx,p.vy)>PLAYER_MAX_SPEED_MPS+1e-5||
     Math.abs(p.facingRad)>Math.PI+1e-5)fail();
 }
 const preceding=previous?.activeShoes??release.activeShoes;
 const expectedTick=(previous?.observedPhysicsTick??
  release.observedPhysicsTick)+1;
 if(contact.tick!==expectedTick||
    contact.tick>release.observedPhysicsTick+
     SECOND_CONTACT_MAX_POST_CLEAR_TICKS||
    !validIds(preceding))fail();
 if(previous!==null&&(
    !previous||previous.version!==SECOND_CONTACT_EVIDENCE_VERSION||
    previous.terminal!==false||
    previous.releaseShoeId!==release.endedShoeId||
    previous.releaseClearPhysicsTick!==release.observedPhysicsTick||
    previous.samplesObserved!==previous.observedPhysicsTick-
     release.observedPhysicsTick||
    previous.samplesObserved<1||
    previous.officialPossession!==false||
    previous.controlConfirmed!==false||
    previous.interceptionProven!==false||
    previous.ballForceApplied!==false||
    previous.secondShoeId!==null))fail();
 // Reject ghosts, gapped frames, duplicated ID orders and impossible
 // START/END transitions relative to the actual previous Rapier frame.
 const before=new Set(preceding),after=new Set(contact.active);
 const started=new Set(contact.started),ended=new Set(contact.ended);
 for(const id of started)
  if(before.has(id)&&!ended.has(id))fail();
 for(const id of ended)
  if(!before.has(id)&&!started.has(id))fail();
 for(const id of new Set([...before,...after,...started,...ended])){
  if(started.has(id)&&ended.has(id))continue;
  const shouldBeActive=(before.has(id)||started.has(id))&&!ended.has(id);
  if(after.has(id)!==shouldBeActive)fail();
 }
}
export function observeSecondPhysicalShoeStart({
 previous=null,releaseEvidence,contactFrame,players,ball
}){
 validate({previous,releaseEvidence,contactFrame,players,ball});
 const id=contactFrame.started.length===1?contactFrame.started[0]:null;
 const distinct=Boolean(id&&id!==releaseEvidence.endedShoeId&&
  outfielder(id)&&contactFrame.active.includes(id)&&
  !contactFrame.ended.includes(id));
 const actor=distinct?players.find(p=>p.id===id):null;
 const shoe=actor?footProxyTransform(actor):null;
 const ballShoeXYDistanceM=shoe?
  Math.hypot(ball.position.x-shoe.x,ball.position.y-shoe.y):null;
 const validPhysicalStart=distinct&&ballShoeXYDistanceM<=0.85&&
  ball.position.z>=0.07&&ball.position.z<=0.4;
 const contacted=contactFrame.started.length>0;
 const terminal=contacted||
  contactFrame.tick-releaseEvidence.observedPhysicsTick===
   SECOND_CONTACT_MAX_POST_CLEAR_TICKS;
 const status=contacted?(
  validPhysicalStart?'distinct-physical-shoe-start-observed':
  contactFrame.started.length!==1?'ambiguous-multiple-shoe-starts':
  id===releaseEvidence.endedShoeId?
   'original-shoe-recontact-before-new-player':
   'unqualified-shoe-start'
 ):terminal?'bounded-window-complete':'awaiting-new-physical-shoe-start';
 return Object.freeze({
  version:SECOND_CONTACT_EVIDENCE_VERSION,
  contactTick:releaseEvidence.contactTick,
  releaseShoeId:releaseEvidence.endedShoeId,
  releaseEndPhysicsTick:releaseEvidence.shoeEndPhysicsTick,
  releaseClearPhysicsTick:releaseEvidence.observedPhysicsTick,
  observedPhysicsTick:contactFrame.tick,
  samplesObserved:(previous?.samplesObserved??0)+1,
  activeShoes:Object.freeze([...contactFrame.active]),
  secondShoeId:validPhysicalStart?id:null,
  secondShoePhysicsTick:validPhysicalStart?contactFrame.tick:null,
  ballShoeXYDistanceM,
  realDistinctSecondShoeStartObserved:validPhysicalStart,
  noInterveningShoeStartObserved:true,
  terminal,status,
  // No contact is a game action or a grant of ball ownership.
  controlConfirmed:false,officialPossession:false,
  interceptionProven:false,freeBallOfficiallyProven:false,
  passCreated:false,ballForceApplied:false
 });
}
