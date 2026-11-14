// ME-PB-49 / Match Physics V1 B1: ONE authoritative local ball owner.
// Pure 60Hz state transition driven exclusively by validated, consecutive
// real Rapier shoe-event snapshots + canonical 22-player measured motion.
// This is an isolated research model: NO official match possession/action,
// no added ball forces, no player teleport, no physics/material tuning.
import {INITIAL_PLAYERS,PLAYER_VERSION,PLAYER_DT,PLAYER_PITCH,
 PLAYER_MAX_SPEED_MPS} from './player-movement.mjs';
import {FOOT_CONTACT_VERSION,footProxyTransform,
 initialFootPositions,validateFootContactFrame} from './player-foot-contact.mjs';
import {ENGINE_VERSION,BALL_RADIUS,FIXED_DT}
 from './core.mjs';

export const BALL_OWNERSHIP_VERSION='me-pb-49-exclusive-real-contact-state-v1';
export const BALL_OWNERSHIP_CONTROL_TICKS=6;
export const BALL_OWNERSHIP_MAX_RELATIVE_MPS=0.75;
export const BALL_OWNERSHIP_MAX_SHOE_XY_M=0.46;
export const BALL_OWNERSHIP_MAX_BALL_HEIGHT_M=0.28;
export const BALL_OWNERSHIP_MIN_MOVING_MPS=0.2;
const OWNERSHIP_PHASES=Object.freeze(['free','contested','controlled']);
const IDS=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const fail=()=>{throw new TypeError(
 'Consecutive canonical 60Hz real Rapier shoe ledger and ball motion required'
);};
const idValid=id=>IDS.includes(id);
function validSortedIds(list){
 return Array.isArray(list)&&new Set(list).size===list.length&&
  list.every((id,i)=>idValid(id)&&(i===0||
   IDS.indexOf(list[i-1])<IDS.indexOf(id)));
}
const positionCopy=p=>Object.freeze({x:p.x,y:p.y,facingRad:p.facingRad});
export function initialBallOwnershipState(){
 return Object.freeze({
  version:BALL_OWNERSHIP_VERSION,
  physicsTick:0,phase:'free',ownerPlayerId:null,
  candidatePlayerId:null,candidateStreakTicks:0,
  contactProvenancePlayerId:null,contactProvenanceStartTick:null,
  firstControlledPhysicsTick:null,
  controlAcquisitions:0,lastTransition:'initial-free',
  activeShoeIds:Object.freeze([]),
  lastPlayerPositions:Object.freeze(initialFootPositions().map(positionCopy)),
  experimentalAuthoritativeOwnerOnly:true,
  officialMatchPossession:false,passCreated:false,ballForceApplied:false
 });
}
function validateLedger(prev,contact){
 const before=new Set(prev.activeShoeIds),after=new Set(contact.active),
  started=new Set(contact.started),ended=new Set(contact.ended);
 for(const id of started)if(before.has(id)&&!ended.has(id))fail();
 for(const id of ended)if(!before.has(id)&&!started.has(id))fail();
 for(const id of new Set([...before,...after,...started,...ended])){
  if(started.has(id)&&ended.has(id)){
   if(after.has(id))fail(); // same-tick transient never stays active
   continue;
  }
  const should=(before.has(id)||started.has(id))&&!ended.has(id);
  if(after.has(id)!==should)fail();
 }
}
function validatePrior(p){
 if(!p||p.version!==BALL_OWNERSHIP_VERSION||
    !Number.isSafeInteger(p.physicsTick)||p.physicsTick<0||
    !OWNERSHIP_PHASES.includes(p.phase)||
    !validSortedIds(p.activeShoeIds)||
    !Array.isArray(p.lastPlayerPositions)||
    p.lastPlayerPositions.length!==INITIAL_PLAYERS.length||
    p.officialMatchPossession!==false||
    p.ballForceApplied!==false||p.passCreated!==false||
    p.experimentalAuthoritativeOwnerOnly!==true||
    !Number.isSafeInteger(p.controlAcquisitions)||
    p.controlAcquisitions<0||
    !Number.isSafeInteger(p.candidateStreakTicks)||
    p.candidateStreakTicks<0||
    (p.ownerPlayerId!==null&&!idValid(p.ownerPlayerId))||
    (p.candidatePlayerId!==null&&!idValid(p.candidatePlayerId))||
    (p.contactProvenancePlayerId!==null&&
      !idValid(p.contactProvenancePlayerId))||
    (p.contactProvenanceStartTick!==null&&
      (!Number.isSafeInteger(p.contactProvenanceStartTick)||
       p.contactProvenanceStartTick<1||
       p.contactProvenanceStartTick>p.physicsTick))||
    (p.firstControlledPhysicsTick!==null&&
      (!Number.isSafeInteger(p.firstControlledPhysicsTick)||
       p.firstControlledPhysicsTick<1||
       p.firstControlledPhysicsTick>p.physicsTick))||
    (p.phase==='controlled'&&(
      p.ownerPlayerId===null||p.ownerPlayerId!==p.candidatePlayerId||
      p.ownerPlayerId!==p.contactProvenancePlayerId||
      p.candidateStreakTicks<BALL_OWNERSHIP_CONTROL_TICKS||
      !p.activeShoeIds.includes(p.ownerPlayerId)))||
    (p.phase!=='controlled'&&p.ownerPlayerId!==null)||
    (p.candidatePlayerId===null&&p.candidateStreakTicks!==0)||
    (p.candidatePlayerId!==null&&(
      p.candidateStreakTicks===0||
      p.candidatePlayerId!==p.contactProvenancePlayerId))||
    (p.contactProvenancePlayerId===null&&
      p.contactProvenanceStartTick!==null)||
    (p.contactProvenancePlayerId!==null&&
      p.contactProvenanceStartTick===null))fail();
 for(const p0 of p.lastPlayerPositions)
  if(!p0||![p0.x,p0.y,p0.facingRad].every(finite))fail();
}
function validateInput({previous,contactFrame,playerFrame,ballSnapshot}){
 const p=previous,c=contactFrame,f=playerFrame,s=ballSnapshot;
 validatePrior(p);
 const tick=p.physicsTick+1;
 if(!c||c.version!==FOOT_CONTACT_VERSION||c.tick!==tick||
    !validSortedIds(c.started)||!validSortedIds(c.ended)||
    !validSortedIds(c.active)||
    !f||f.version!==PLAYER_VERSION||f.tick!==tick||
    !finite(f.timeS)||Math.abs(f.timeS-tick*PLAYER_DT)>1e-8||
    !s||s.version!==ENGINE_VERSION||s.tick!==tick||
    !finite(s.time)||Math.abs(s.time-tick*FIXED_DT)>1e-8||
    !s.ball||!s.ball.position||!s.ball.velocity||
    !['x','y','z'].every(k=>finite(s.ball.position[k])&&
      finite(s.ball.velocity[k]))||
    s.ball.position.z<BALL_RADIUS-0.06||
    !Array.isArray(f.players)||f.players.length!==INITIAL_PLAYERS.length)
   fail();
 try{validateFootContactFrame(f,tick,p.lastPlayerPositions);}
 catch{fail();}
 // Validate canonical roster and speeds even if foot step accepted a
 // syntactically correct actor. An event frame is not a proximity flag.
 for(let i=0;i<INITIAL_PLAYERS.length;i++){
  const a=f.players[i],expected=INITIAL_PLAYERS[i];
  if(!a||a.id!==expected.id||a.team!==expected.team||
     a.role!==expected.role||a.number!==expected.number||
     ![a.vx,a.vy,a.x,a.y,a.facingRad].every(finite)||
     Math.hypot(a.vx,a.vy)>PLAYER_MAX_SPEED_MPS+1e-5)fail();
 }
 validateLedger(p,c);
}
function qualifies(actor,ball){
 const shoe=footProxyTransform(actor);
 const dx=ball.position.x-shoe.x,dy=ball.position.y-shoe.y;
 const vBall=Math.hypot(ball.velocity.x,ball.velocity.y);
 const vPlayer=Math.hypot(actor.vx,actor.vy);
 const relative=Math.hypot(ball.velocity.x-actor.vx,
                           ball.velocity.y-actor.vy);
 const alignment=vBall>0&&vPlayer>0?
  (ball.velocity.x*actor.vx+ball.velocity.y*actor.vy)/(vBall*vPlayer):0;
 return ball.position.z>=BALL_RADIUS-0.05&&
  ball.position.z<=BALL_OWNERSHIP_MAX_BALL_HEIGHT_M&&
  Math.abs(ball.position.x)<=PLAYER_PITCH.lengthM/2&&
  Math.abs(ball.position.y)<=PLAYER_PITCH.widthM/2&&
  Math.hypot(dx,dy)<=BALL_OWNERSHIP_MAX_SHOE_XY_M&&
  vBall>=BALL_OWNERSHIP_MIN_MOVING_MPS&&
  vPlayer>=BALL_OWNERSHIP_MIN_MOVING_MPS&&
  relative<=BALL_OWNERSHIP_MAX_RELATIVE_MPS&&alignment>=0.75;
}
// A trusted caller must supply the real engine's completed snapshot and
// footContactSnapshot, not handcrafted external data. The validator can
// reject inconsistent/fake ledgers but cannot cryptographically attest
// arbitrary JS objects; this isolation is not official match authority.
export function advanceBallOwnership({
 previous,contactFrame,playerFrame,ballSnapshot
}){
 validateInput({previous,contactFrame,playerFrame,ballSnapshot});
 const tick=ballSnapshot.tick,active=contactFrame.active;
 const hasExactlyOne=active.length===1;
 const id=hasExactlyOne?active[0]:null;
 const actor=id?playerFrame.players.find(p=>p.id===id):null;
 const samePhysicalEpisode=Boolean(id&&
  previous.activeShoeIds.length===1&&
  previous.activeShoeIds[0]===id&&
  previous.contactProvenancePlayerId===id&&
  !contactFrame.started.includes(id)&&
  !contactFrame.ended.includes(id));
 const startedThisTick=Boolean(id&&
  contactFrame.started.includes(id)&&
  !contactFrame.ended.includes(id)&&
  previous.activeShoeIds.length===0);
 const hasProvenance=startedThisTick||samePhysicalEpisode;
 const provenance=hasProvenance?id:null;
 const provenanceStart=startedThisTick?tick:
  samePhysicalEpisode?previous.contactProvenanceStartTick:null;
 const stable=Boolean(hasProvenance&&actor&&qualifies(actor,ballSnapshot.ball));
 const candidate=stable?id:null;
 const streak=stable?(previous.candidatePlayerId===id&&
  samePhysicalEpisode?previous.candidateStreakTicks+1:1):0;
 const qualifiesControl=streak>=BALL_OWNERSHIP_CONTROL_TICKS;
 const phase=qualifiesControl?'controlled':
  active.length>0?'contested':'free';
 const owner=qualifiesControl?id:null;
 const acquired=owner!==null&&previous.ownerPlayerId!==owner;
 let transition;
 if(acquired)transition='physically-acquired';
 else if(owner!==null)transition='physically-retained';
 else if(previous.ownerPlayerId!==null)
  transition=active.includes(previous.ownerPlayerId)?
   'control-lost-unstable-or-contested':'control-released-or-shoe-ended';
 else if(phase==='contested')transition=active.length>1?
  'multiple-physical-contacts':'contact-without-control';
 else transition='uncontrolled-free-ball';
 return Object.freeze({
  version:BALL_OWNERSHIP_VERSION,physicsTick:tick,
  phase,ownerPlayerId:owner,
  candidatePlayerId:candidate,candidateStreakTicks:streak,
  contactProvenancePlayerId:provenance,
  contactProvenanceStartTick:provenanceStart,
  firstControlledPhysicsTick:previous.firstControlledPhysicsTick??
    (acquired?tick:null),
  controlAcquisitions:previous.controlAcquisitions+(acquired?1:0),
  lastTransition:transition,
  activeShoeIds:Object.freeze([...active]),
  lastPlayerPositions:Object.freeze(playerFrame.players.map(positionCopy)),
  experimentalAuthoritativeOwnerOnly:true,
  // The match result, published possession, statistics and player actions
  // are NOT driven by this isolated control state until later integration.
  officialMatchPossession:false,passCreated:false,ballForceApplied:false
 });
}
