// #628 ACTIONS-B02: one original goalkeeper, one original ball.
// A lateral dive APPROACH target is only an intent for the canonical
// 60Hz mover; a foot parry is separately authorized by real Rapier START.
import {PLAYER_MIN_SEPARATION_M,PLAYER_PITCH}
 from './player-movement.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const sideSign=team=>team==='home'?1:-1;
export const GOALKEEPER_DIVE_APPROACH_VERSION='actions-b02-goalkeeper-live-shot-approach-v1';
export const GOALKEEPER_PARRY_MAX_GOAL_DISTANCE_M=12;
export const GOALKEEPER_PARRY_HALF_WIDTH_M=4.5;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

export function initialResearchGoalkeeperSaveLineup(players,side,ball){
 if(!Array.isArray(players)||players.length!==22||
    !['home','away'].includes(side)||!ball||
    !['x','y','z','vx','vy','vz'].every(k=>finite(ball[k]))||
    ball.z!==0||ball.vz!==0)
  throw new TypeError('Original 22 players and grounded incoming ball required');
 const attack=sideSign(side),goalX=-attack*PLAYER_PITCH.lengthM/2;
 if(Math.abs(ball.x-goalX)>9||
    Math.abs(ball.y)>3||ball.vx*attack>=-0.5||
    Math.hypot(ball.vx,ball.vy)>12)
  throw new RangeError('Goalward ball must approach the original keeper');
 const id=side+'-1';
 if(players.filter(p=>p.id===id&&p.role==='goalkeeper'&&p.team===side).length!==1)
  throw new TypeError('Original named goalkeeper required');
 // Stage only the actual goalkeeper before tick ZERO, with his original
 // forward-facing shoe 0.28m behind the goalward moving ball.
 const x=ball.x-attack*0.28,y=ball.y;
 const staged=players.map(p=>p.id===id?
  Object.freeze({...p,x,y,baseX:x,baseY:y,vx:0,vy:0,blockedBy:null}):p);
 for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
  if(Math.hypot(staged[i].x-staged[j].x,
   staged[i].y-staged[j].y)<PLAYER_MIN_SEPARATION_M-1e-8)
   throw new RangeError('Canonical 0.98m separation must survive staging');
 return Object.freeze(staged);
}

export function chooseBasicGoalkeeperDiveTarget({
 keeper,ballPosition,ballVelocity
}={}){
 if(!keeper||keeper.role!=='goalkeeper'||
    !['home','away'].includes(keeper.team)||!ballPosition||!ballVelocity||
    !['x','y'].every(k=>finite(keeper[k]))||
    !['x','y','z'].every(k=>finite(ballPosition[k])&&finite(ballVelocity[k])))
  throw new TypeError('Only measured original goalkeeper and ball states allowed');
 const attack=sideSign(keeper.team);
 const goalX=-attack*PLAYER_PITCH.lengthM/2;
 const goalDist=Math.abs(goalX-ballPosition.x);
 if(goalDist>GOALKEEPER_PARRY_MAX_GOAL_DISTANCE_M||
    goalDist<0.1||ballVelocity.x*attack>=-0.5||
    Math.abs(ballPosition.y)>8||
    ballPosition.z>0.5)return null;
 const travelSeconds=(goalX-ballPosition.x)/ballVelocity.x;
 if(!finite(travelSeconds)||travelSeconds<=0||travelSeconds>3)
  return null;
 const predictedY=ballPosition.y+ballVelocity.y*travelSeconds;
 if(Math.abs(predictedY)>GOALKEEPER_PARRY_HALF_WIDTH_M)return null;
 return Object.freeze({
  version:GOALKEEPER_DIVE_APPROACH_VERSION,
  x:goalX+attack*2.6,y:clamp(predictedY,-3.4,3.4),
  observedBallX:ballPosition.x,observedBallY:ballPosition.y,
  observedBallVx:ballVelocity.x,observedBallVy:ballVelocity.y,
  flightToGoalS:travelSeconds,
  attemptOnly:true,physicalFootContactConfirmed:false,
  savedShot:false,officialSave:false,officialPossession:false
 });
}
