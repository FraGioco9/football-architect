// ME-PB-38 — read-only evidence of sustained physical shoe/ball co-motion.
// A Rapier contact is necessary but insufficient. This does NOT create
// ball control, possession, interception, an intentional touch or an action.
import {INITIAL_PLAYERS,PLAYER_PITCH,PLAYER_MAX_SPEED_MPS}
 from './player-movement.mjs';
import {FOOT_CONTACT_VERSION,footProxyTransform}
 from './player-foot-contact.mjs';
import {LOOSE_RESPONSE_VERSION,LOOSE_RESPONSE_MAX_TICKS}
 from './player-ball-loose-response.mjs';
export const CONTROL_EVIDENCE_VERSION='me-pb-38-contact-co-motion-evidence-v1';
export const CONTROL_EVIDENCE_MIN_TICKS=6;
export const CONTROL_EVIDENCE_MAX_RELATIVE_MPS=0.75;
export const CONTROL_EVIDENCE_MIN_MOVING_MPS=0.2;
export const CONTROL_EVIDENCE_MAX_SHOE_BALL_XY_M=0.46;
export const CONTROL_EVIDENCE_MAX_BALL_CENTER_Z_M=0.28;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const arrayOfCanonicalIds=values=>Array.isArray(values)&&
 new Set(values).size===values.length&&
 values.every(id=>INITIAL_PLAYERS.some(p=>p.id===id));
const outfielderId=id=>INITIAL_PLAYERS.some(p=>
 p.id===id&&p.role!=='goalkeeper');
const fail=()=>{throw new TypeError(
 'Consecutive genuine Rapier contact and canonical bounded co-motion samples required'
);};
function validate({previous,response,contactFrame,players,ball,movementTick}){
 if(!response||response.version!==LOOSE_RESPONSE_VERSION||
    !['responding','completed'].includes(response.phase)||
    response.officialPossession!==false||response.ballForceApplied!==false||
    !response.responders||!outfielderId(response.responders.home)||
    !outfielderId(response.responders.away)||
    !response.responders.home.startsWith('home-')||
    !response.responders.away.startsWith('away-')||
    !Number.isSafeInteger(response.contactTick)||response.contactTick<1||
    !Number.isSafeInteger(response.initiatedAtMovementTick)||
    !Number.isSafeInteger(response.lastMovementTick)||
    !Number.isSafeInteger(response.responseTicks)||
    response.responseTicks!==response.lastMovementTick-
     response.initiatedAtMovementTick+1||
    response.responseTicks>LOOSE_RESPONSE_MAX_TICKS||
    !Number.isSafeInteger(movementTick)||
    movementTick!==response.lastMovementTick||
    movementTick<=response.initiatedAtMovementTick||
    !contactFrame||contactFrame.version!==FOOT_CONTACT_VERSION||
    contactFrame.tick!==movementTick-1||
    !arrayOfCanonicalIds(contactFrame.started)||
    !arrayOfCanonicalIds(contactFrame.ended)||
    !arrayOfCanonicalIds(contactFrame.active)||
    !Array.isArray(players)||players.length!==INITIAL_PLAYERS.length||
    !ball||!ball.position||!ball.velocity||
    !['x','y','z'].every(k=>finite(ball.position[k])&&
     finite(ball.velocity[k]))||
    Math.abs(ball.position.x)>PLAYER_PITCH.lengthM/2||
    Math.abs(ball.position.y)>PLAYER_PITCH.widthM/2)
  fail();
 for(let i=0;i<players.length;i++){
  const p=players[i],expected=INITIAL_PLAYERS[i];
  if(!p||p.id!==expected.id||p.team!==expected.team||
     p.role!==expected.role||
     ![p.x,p.y,p.vx,p.vy,p.facingRad].every(finite)||
     Math.abs(p.x)>PLAYER_PITCH.lengthM/2||
     Math.abs(p.y)>PLAYER_PITCH.widthM/2||
     Math.hypot(p.vx,p.vy)>PLAYER_MAX_SPEED_MPS+1e-5||
     Math.abs(p.facingRad)>Math.PI+1e-5)fail();
 }
 if(previous===null){
  if(movementTick!==response.initiatedAtMovementTick+1)fail();
 }else if(!previous||previous.version!==CONTROL_EVIDENCE_VERSION||
     previous.terminal!==false||
     previous.contactTick!==response.contactTick||
     previous.initiatedAtMovementTick!==response.initiatedAtMovementTick||
     previous.observedPhysicsTick!==contactFrame.tick-1||
     !Number.isSafeInteger(previous.samplesObserved)||
     previous.samplesObserved!==previous.observedPhysicsTick-
      response.initiatedAtMovementTick+1||
     !Number.isSafeInteger(previous.consecutiveTicks)||
     previous.consecutiveTicks<0||
     previous.consecutiveTicks>previous.samplesObserved||
     previous.candidatePlayerId!==null&&
      !outfielderId(previous.candidatePlayerId)||
     typeof previous.sustainedCoMotionObserved!=='boolean'||
     previous.officialPossession!==false||
     previous.controlConfirmed!==false||
     previous.interceptionProven!==false||
     previous.ballForceApplied!==false)fail();
}
export function observeLooseBallControlEvidence({
 previous=null,response,contactFrame,players,ball,movementTick
}){
 validate({previous,response,contactFrame,players,ball,movementTick});
 const active=contactFrame.active;
 const id=active.length===1&&
  Object.values(response.responders).includes(active[0])&&
  !contactFrame.ended.includes(active[0])?active[0]:null;
 const p=id===null?null:players.find(item=>item.id===id);
 const proxy=p?footProxyTransform(p):null;
 const xyDistance=proxy?Math.hypot(ball.position.x-proxy.x,
  ball.position.y-proxy.y):null;
 const ballSpeed=Math.hypot(ball.velocity.x,ball.velocity.y);
 const shoeSpeed=p?Math.hypot(p.vx,p.vy):null;
 const relativeSpeed=p?Math.hypot(ball.velocity.x-p.vx,
  ball.velocity.y-p.vy):null;
 const aligned=p&&ballSpeed>0&&shoeSpeed>0&&
  (ball.velocity.x*p.vx+ball.velocity.y*p.vy)/
   (ballSpeed*shoeSpeed)>=0.75;
 const qualifying=Boolean(p&&
  ball.position.z>=0.07&&
  ball.position.z<=CONTROL_EVIDENCE_MAX_BALL_CENTER_Z_M&&
  xyDistance<=CONTROL_EVIDENCE_MAX_SHOE_BALL_XY_M&&
  ballSpeed>=CONTROL_EVIDENCE_MIN_MOVING_MPS&&
  shoeSpeed>=CONTROL_EVIDENCE_MIN_MOVING_MPS&&
  relativeSpeed<=CONTROL_EVIDENCE_MAX_RELATIVE_MPS&&aligned);
 const candidate=qualifying?id:null;
 const streak=candidate!==null&&previous?.candidatePlayerId===candidate?
  previous.consecutiveTicks+1:candidate!==null?1:0;
 const reached=streak>=CONTROL_EVIDENCE_MIN_TICKS;
 const ever=Boolean(previous?.sustainedCoMotionObserved||reached);
 const terminal=response.phase==='completed';
 return Object.freeze({
  version:CONTROL_EVIDENCE_VERSION,
  contactTick:response.contactTick,
  initiatedAtMovementTick:response.initiatedAtMovementTick,
  observedPhysicsTick:contactFrame.tick,
  samplesObserved:(previous?.samplesObserved??0)+1,
  candidatePlayerId:candidate,consecutiveTicks:streak,
  maximumConsecutiveTicks:Math.max(previous?.maximumConsecutiveTicks??0,streak),
  sustainedCoMotionObserved:ever,
  firstSustainedPhysicsTick:previous?.firstSustainedPhysicsTick??
    (reached?contactFrame.tick:null),
  lastQualifyingPhysicsTick:qualifying?contactFrame.tick:
    (previous?.lastQualifyingPhysicsTick??null),
  actualShoeContactActive:active.length>0,
  multipleShoesActive:active.length>1,
  ballShoeDistanceM:xyDistance,
  relativeGroundSpeedMps:relativeSpeed,
  ballGroundSpeedMps:ballSpeed,
  terminal,
  status:terminal?'observation-window-complete':
    reached?'sustained-contact-co-motion-observed':
    qualifying?'contact-co-motion-streak':'no-qualifying-co-motion',
  // These fields are intentionally ALWAYS false. Even sustained contact
  // and aligned velocity are not sufficient to authenticate ball control.
  controlConfirmed:false,officialPossession:false,
  interceptionProven:false,passCreated:false,ballForceApplied:false
 });
}
