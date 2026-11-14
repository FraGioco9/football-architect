// ME-PB-03 — oriented, rounded low-profile Rapier foot proxy in isolated DEV.
// A tactical player's center/facing is not an anatomical pose; no possession.
import {INITIAL_PLAYERS,PLAYER_DT,PLAYER_VERSION,PLAYER_PITCH,
 PLAYER_MAX_SPEED_MPS,PLAYER_TURN_RAD_PER_S} from './player-movement.mjs';

export const FOOT_CONTACT_VERSION='me-pb-03-oriented-foot-contact-v1';
// Provisional, uncalibrated 25cm x 14.4cm x 11cm rounded shoe pad.
export const FOOT_CONTACT_HALF_LENGTH_M=0.105;
export const FOOT_CONTACT_HALF_WIDTH_M=0.052;
export const FOOT_CONTACT_HALF_HEIGHT_M=0.035;
export const FOOT_CONTACT_ROUNDING_M=0.020;
// Center ahead of tactical XY: response now depends on actual facing direction.
export const FOOT_CONTACT_FORWARD_OFFSET_M=0.22;
export const FOOT_CONTACT_CENTER_HEIGHT_M=0.09;
export const FOOT_CONTACT_RESTITUTION=0.12;
export const FOOT_CONTACT_RESTITUTION_RANGE=Object.freeze({min:0,max:0.35});
export const FOOT_CONTACT_FRICTION=0.65;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const STEP_TOLERANCE=1e-5;
const ANGLE_TOLERANCE=1e-5;
export const initialFootPositions=()=>Object.freeze(INITIAL_PLAYERS.map(p=>
 Object.freeze({x:p.x,y:p.y,facingRad:p.facingRad})));

// A pure transform, frozen and usable by deterministic geometry/unit tests.
// 3D RAPIER quaternion rotates the local long X axis about vertical Z.
export function footProxyTransform(p){
 if(!p||!finite(p.x)||!finite(p.y)||!finite(p.facingRad)||
   Math.abs(p.facingRad)>Math.PI+ANGLE_TOLERANCE)
  throw new TypeError('Finite canonical tactical facing required');
 const angle=p.facingRad;
 return Object.freeze({
  x:p.x+FOOT_CONTACT_FORWARD_OFFSET_M*Math.cos(angle),
  y:p.y+FOOT_CONTACT_FORWARD_OFFSET_M*Math.sin(angle),
  z:FOOT_CONTACT_CENTER_HEIGHT_M,
  rotation:Object.freeze({x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)})
 });
}

export function validateFootContactFrame(frame,nextTick,previousPositions){
 if(!frame||frame.version!==PLAYER_VERSION||
    !Number.isInteger(nextTick)||nextTick<1||
    frame.tick!==nextTick||!finite(frame.timeS)||
    Math.abs(frame.timeS-nextTick*PLAYER_DT)>1e-9||
    !Array.isArray(frame.players)||frame.players.length!==INITIAL_PLAYERS.length||
    !Array.isArray(previousPositions)||previousPositions.length!==INITIAL_PLAYERS.length)
  throw new TypeError('Consecutive canonical 60Hz foot-contact frame required');
 const positions=[];
 for(let i=0;i<INITIAL_PLAYERS.length;i++){
  const original=INITIAL_PLAYERS[i],p=frame.players[i],previous=previousPositions[i];
  const turn= p&&previous&&finite(p.facingRad)&&finite(previous.facingRad)?
   Math.atan2(Math.sin(p.facingRad-previous.facingRad),
    Math.cos(p.facingRad-previous.facingRad)):NaN;
  if(!p||p.id!==original.id||p.team!==original.team||
    p.number!==original.number||p.role!==original.role||
    !finite(p.x)||!finite(p.y)||!finite(p.vx)||!finite(p.vy)||
    !previous||!finite(previous.x)||!finite(previous.y)||
    !finite(turn)||Math.abs(p.facingRad)>Math.PI+ANGLE_TOLERANCE||
    Math.abs(previous.facingRad)>Math.PI+ANGLE_TOLERANCE||
    Math.abs(turn)>PLAYER_TURN_RAD_PER_S*PLAYER_DT+ANGLE_TOLERANCE||
    Math.abs(p.x)>PLAYER_PITCH.lengthM/2||
    Math.abs(p.y)>PLAYER_PITCH.widthM/2||
    Math.hypot(p.x-previous.x,p.y-previous.y)>
      PLAYER_MAX_SPEED_MPS*PLAYER_DT+STEP_TOLERANCE)
   throw new TypeError('Valid bounded physical player step and facing required for foot contacts');
  positions.push(Object.freeze({x:p.x,y:p.y,facingRad:p.facingRad}));
 }
 return Object.freeze(positions);
}
