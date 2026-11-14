// ME-PB-39 — read-only physical shoe END and measured ball-clearance evidence.
// Rapier contact is not possession; this module never applies a force or owner.
import {INITIAL_PLAYERS,PLAYER_PITCH,PLAYER_MAX_SPEED_MPS}
 from './player-movement.mjs';
import {FOOT_CONTACT_VERSION,footProxyTransform}
 from './player-foot-contact.mjs';
import {CONTROL_EVIDENCE_VERSION,CONTROL_EVIDENCE_MIN_TICKS,
 CONTROL_EVIDENCE_MAX_SHOE_BALL_XY_M,
 CONTROL_EVIDENCE_MAX_BALL_CENTER_Z_M}
 from './player-ball-control-evidence.mjs';
export const RELEASE_EVIDENCE_VERSION='me-pb-39-contact-release-v1';
export const RELEASE_CLEAR_TICKS=3;
export const RELEASE_MIN_GROUND_SPEED_MPS=0.2;
export const RELEASE_MIN_RADIAL_SEPARATION_MPS=0.12;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const fail=()=>{throw new TypeError(
 'Consecutive genuine Rapier shoe-end and measured ball clearance required'
);};
function canonicalIds(xs){
 // Lazy roster read avoids a circular ESM initialization dependency.
 const orderedIds=INITIAL_PLAYERS.map(p=>p.id);
 return Array.isArray(xs)&&new Set(xs).size===xs.length&&
  xs.every((id,i)=>typeof id==='string'&&orderedIds.includes(id)&&
   (i===0||orderedIds.indexOf(xs[i-1])<orderedIds.indexOf(id)));
}
function validate({previous,controlEvidence,contactFrame,players,ball}){
 const c=controlEvidence,f=contactFrame;
 if(!c||c.version!==CONTROL_EVIDENCE_VERSION||
    !Number.isSafeInteger(c.contactTick)||c.contactTick<1||
    !Number.isSafeInteger(c.initiatedAtMovementTick)||
    !Number.isSafeInteger(c.observedPhysicsTick)||
    !Number.isSafeInteger(c.samplesObserved)||c.samplesObserved<1||
    c.samplesObserved!==c.observedPhysicsTick-
     c.initiatedAtMovementTick+1||
    c.controlConfirmed!==false||c.officialPossession!==false||
    c.interceptionProven!==false||c.ballForceApplied!==false||
    typeof c.sustainedCoMotionObserved!=='boolean'||
    !Number.isSafeInteger(c.consecutiveTicks)||c.consecutiveTicks<0||
    c.consecutiveTicks>c.samplesObserved||
    (c.candidatePlayerId!==null&&
     !INITIAL_PLAYERS.some(p=>p.id===c.candidatePlayerId&&
      p.role!=='goalkeeper'))||
    c.sustainedCoMotionObserved!==(c.firstSustainedPhysicsTick!==null)||
    (c.firstSustainedPhysicsTick!==null&&
     (!Number.isSafeInteger(c.firstSustainedPhysicsTick)||
      c.firstSustainedPhysicsTick>c.observedPhysicsTick))||
    typeof c.terminal!=='boolean'||
    !f||f.version!==FOOT_CONTACT_VERSION||
    f.tick!==c.observedPhysicsTick||
    !canonicalIds(f.started)||!canonicalIds(f.ended)||
    !canonicalIds(f.active)||
    c.actualShoeContactActive!==(f.active.length>0)||
    c.multipleShoesActive!==(f.active.length>1)||
    (c.candidatePlayerId!==null&&
     (f.active.length!==1||f.active[0]!==c.candidatePlayerId))||
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
     Math.abs(p.facingRad)>Math.PI+1e-5||
     Math.hypot(p.vx,p.vy)>PLAYER_MAX_SPEED_MPS+1e-5)fail();
 }
 if(previous===null){
  if(c.samplesObserved!==1)fail();
  return;
 }
 const p=previous;
 if(!p||p.version!==RELEASE_EVIDENCE_VERSION||
    p.terminal!==false||
    p.observedPhysicsTick!==f.tick-1||
    p.samplesObserved+1!==c.samplesObserved||
    p.contactTick!==c.contactTick||
    p.initiatedAtMovementTick!==c.initiatedAtMovementTick||
    !canonicalIds(p.activeShoes)||
    !Number.isSafeInteger(p.clearTicks)||p.clearTicks<0||
    p.clearTicks>p.samplesObserved||
    (p.lastSustainedShoeId!==null&&
     !INITIAL_PLAYERS.some(a=>a.id===p.lastSustainedShoeId&&
      a.role!=='goalkeeper'))||
    (p.shoeEndPhysicsTick!==null&&
     !Number.isSafeInteger(p.shoeEndPhysicsTick))||
    (p.firstUncontestedPhysicsTick!==null&&
     !Number.isSafeInteger(p.firstUncontestedPhysicsTick))||
    p.officialPossession!==false||p.controlConfirmed!==false||
    p.interceptionProven!==false||p.freeBallOfficiallyProven!==false||
    p.ballForceApplied!==false)fail();
 // Cross-check events against previous COMPLETE Rapier shoe-active set.
 // A same-frame START+END is ambiguous, never proof of a lasting release.
 const before=new Set(p.activeShoes),after=new Set(f.active);
 const starts=new Set(f.started),ends=new Set(f.ended);
 for(const id of starts)
  if(before.has(id)&&!ends.has(id))fail();
 for(const id of ends)
  if(!before.has(id)&&!starts.has(id))fail();
 for(const id of new Set([...before,...after,...starts,...ends])){
  if(starts.has(id)&&ends.has(id))continue;
  if(after.has(id)!==((before.has(id)||starts.has(id))&&!ends.has(id)))
   fail();
 }
}
export function observePostContactRelease({
 previous=null,controlEvidence,contactFrame,players,ball
}){
 validate({previous,controlEvidence,contactFrame,players,ball});
 const tick=contactFrame.tick,active=contactFrame.active;
 const newlySustained=controlEvidence.consecutiveTicks>=
  CONTROL_EVIDENCE_MIN_TICKS?controlEvidence.candidatePlayerId:null;
 const lastSustainedShoeId=previous?.shoeEndPhysicsTick!==null&&previous?
  previous.lastSustainedShoeId:
  newlySustained??previous?.lastSustainedShoeId??null;
 const trueEnd=Boolean(previous&&lastSustainedShoeId&&
  previous.activeShoes.includes(lastSustainedShoeId)&&
  contactFrame.ended.includes(lastSustainedShoeId)&&
  !contactFrame.started.includes(lastSustainedShoeId)&&
  !active.includes(lastSustainedShoeId));
 const shoeEndPhysicsTick=previous?.shoeEndPhysicsTick??(trueEnd?tick:null);
 const endedShoeId=previous?.endedShoeId??(trueEnd?lastSustainedShoeId:null);
 let minimumShoeXYDistanceM=Infinity;
 for(const p of players){
  const shoe=footProxyTransform(p);
  minimumShoeXYDistanceM=Math.min(minimumShoeXYDistanceM,
   Math.hypot(ball.position.x-shoe.x,ball.position.y-shoe.y));
 }
 const actor=players.find(p=>p.id===endedShoeId);
 const actorShoe=actor?footProxyTransform(actor):null;
 const dx=actorShoe?ball.position.x-actorShoe.x:0;
 const dy=actorShoe?ball.position.y-actorShoe.y:0;
 const radius=Math.hypot(dx,dy);
 const radialSpeed=actor&&radius>1e-9?
  ((ball.velocity.x-actor.vx)*dx+(ball.velocity.y-actor.vy)*dy)/radius:null;
 // A different shoe can START+END within this same solver tick without
 // remaining active. It is a real transient contact, never a clear frame.
 const anotherShoeEvent=contactFrame.started.some(id=>id!==endedShoeId)||
  contactFrame.ended.some(id=>id!==endedShoeId);
 const validSeparation=shoeEndPhysicsTick!==null&&active.length===0&&
  !anotherShoeEvent&&
  ball.position.z>=0.07&&
  ball.position.z<=CONTROL_EVIDENCE_MAX_BALL_CENTER_Z_M&&
  minimumShoeXYDistanceM>CONTROL_EVIDENCE_MAX_SHOE_BALL_XY_M&&
  Math.hypot(ball.velocity.x,ball.velocity.y)>=
   RELEASE_MIN_GROUND_SPEED_MPS&&
  radialSpeed!==null&&radialSpeed>=RELEASE_MIN_RADIAL_SEPARATION_MPS;
 const clearTicks=validSeparation?(previous?.clearTicks??0)+1:0;
 const firstUncontestedPhysicsTick=
  previous?.firstUncontestedPhysicsTick??
   (clearTicks>=RELEASE_CLEAR_TICKS?tick:null);
 const recontactAfterEndObserved=Boolean(
  previous?.recontactAfterEndObserved||
  (shoeEndPhysicsTick!==null&&tick>shoeEndPhysicsTick&&active.length>0));
 const terminal=controlEvidence.terminal;
 const status=terminal?'observation-window-complete':
  firstUncontestedPhysicsTick!==null&&validSeparation?
   'measured-uncontested-ball':
  shoeEndPhysicsTick!==null?'shoe-ended-awaiting-clearance':
  lastSustainedShoeId!==null?'sustained-contact-not-ended':
   'awaiting-qualifying-sustained-contact';
 return Object.freeze({
  version:RELEASE_EVIDENCE_VERSION,
  contactTick:controlEvidence.contactTick,
  initiatedAtMovementTick:controlEvidence.initiatedAtMovementTick,
  observedPhysicsTick:tick,samplesObserved:controlEvidence.samplesObserved,
  activeShoes:Object.freeze([...active]),
  lastSustainedShoeId,endedShoeId,shoeEndPhysicsTick,
  trueShoeEndObserved:shoeEndPhysicsTick!==null,
  clearTicks,minimumShoeXYDistanceM,
  radialSeparationSpeedMps:radialSpeed,firstUncontestedPhysicsTick,
  provisionalUncontestedObserved:firstUncontestedPhysicsTick!==null,
  currentlyMeasuredUncontested:validSeparation&&
   clearTicks>=RELEASE_CLEAR_TICKS,
  recontactAfterEndObserved,terminal,status,
  controlConfirmed:false,officialPossession:false,
  interceptionProven:false,freeBallOfficiallyProven:false,
  passCreated:false,ballForceApplied:false
 });
}
