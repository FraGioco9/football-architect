// #628 ACTIONS-B03 — original 22-player, physical-ball defensive attempts.
// Formation is changed ONLY before tick zero in DEV isolated scene.
// This module makes NO claim that ball possession or an interception was won.
import {PLAYER_MIN_SEPARATION_M,PLAYER_PITCH} from './player-movement.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const BASIC_DEFENSIVE_ACTION_VERSION=
 'actions-b03-real-opponent-physical-defensive-attempt-v1';
export const BASIC_DEFENSIVE_NEAR_OPPONENT_M=3.3;
export const BASIC_DEFENSIVE_AREA_MIN_M=18;
export const BASIC_DEFENSIVE_INTERCEPT_SPEED_MPS=1.25;
export const BASIC_DEFENSIVE_TACKLE_SPEED_MAX_MPS=0.7;
const ids=Object.freeze(['home','away']);
export function initialResearchDefensiveLineup(players,side,ball,{kind}={}){
 if(!Array.isArray(players)||players.length!==22||
   !ids.includes(side)||!['tackle','interception'].includes(kind)||
   !ball||!['x','y','z','vx','vy','vz'].every(k=>finite(ball[k]))||
   ball.z!==0||ball.vz!==0||Math.abs(ball.y)>4||
   (side==='home'?ball.x> -24||ball.x< -36:ball.x<24||ball.x>36))
  throw new TypeError('Bounded current defensive-zone research source required');
 const direction=side==='home'?1:-1,other=side==='home'?'away':'home';
 const defenderId=side+'-7',opponentId=other+'-10';
 if(players.filter(p=>p.id===defenderId&&p.team===side&&
     p.role==='midfielder').length!==1||
    players.filter(p=>p.id===opponentId&&p.team===other&&
     p.role==='forward').length!==1)
  throw new TypeError('Original defender #7 and opposing attacker #10 required');
 if(kind==='tackle'&&Math.hypot(ball.vx,ball.vy)>BASIC_DEFENSIVE_TACKLE_SPEED_MAX_MPS||
    kind==='interception'&&(
     Math.hypot(ball.vx,ball.vy)<BASIC_DEFENSIVE_INTERCEPT_SPEED_MPS||
     ball.vx*direction>=-BASIC_DEFENSIVE_INTERCEPT_SPEED_MPS))
  throw new TypeError('Real slow-ball challenge versus inbound-ball interception only');
 // Defender's shoe lies forward at +0.22m in its original orientation;
 // the first contact must STILL happen organically inside native Rapier.
 const initial=new Map([
  [defenderId,{x:ball.x-direction*0.28,y:ball.y}],
  [opponentId,{x:ball.x+direction*1.65,y:ball.y+1.2}]
 ]);
 const staged=players.map(p=>{
  const target=initial.get(p.id);
  return target?Object.freeze({...p,...target,baseX:target.x,
   baseY:target.y,vx:0,vy:0,blockedBy:null}):p;
 });
 for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
  if(Math.hypot(staged[i].x-staged[j].x,
    staged[i].y-staged[j].y)<PLAYER_MIN_SEPARATION_M-1e-8)
   throw new RangeError('Original 22-player separation fails');
 return Object.freeze(staged);
}
export function chooseBasicDefensiveAttempt({actor,players,ball,velocity}={}){
 if(!actor||!Array.isArray(players)||players.length!==22||
    !ball||!velocity||!ids.includes(actor.team)||
    !['defender','midfielder'].includes(actor.role)||
    !['x','y'].every(k=>finite(actor[k])&&finite(ball[k])&&finite(velocity[k])))
  return null;
 const attack=actor.team==='home'?1:-1;
 const ownGoalX=-attack*PLAYER_PITCH.lengthM/2;
 if(Math.abs(ownGoalX-ball.x)>PLAYER_PITCH.lengthM/2-
    BASIC_DEFENSIVE_AREA_MIN_M||
    attack*ball.x>=-BASIC_DEFENSIVE_AREA_MIN_M||
    Math.abs(ball.y)>20)return null;
 const opponent=players.filter(p=>p.team!==actor.team&&
   p.role!=='goalkeeper'&&finite(p.x)&&finite(p.y))
  .map(p=>({player:p,gapM:Math.hypot(p.x-ball.x,p.y-ball.y)}))
  .sort((a,b)=>a.gapM-b.gapM||
    a.player.id.localeCompare(b.player.id))[0];
 if(!opponent||opponent.gapM>BASIC_DEFENSIVE_NEAR_OPPONENT_M)
  return null;
 const speed=Math.hypot(velocity.x,velocity.y);
 const inbound=velocity.x*attack<=-BASIC_DEFENSIVE_INTERCEPT_SPEED_MPS;
 const kind=speed>=BASIC_DEFENSIVE_INTERCEPT_SPEED_MPS&&inbound?
   'interception':speed<=BASIC_DEFENSIVE_TACKLE_SPEED_MAX_MPS?
    'tackle':null;
 if(!kind)return null;
 const targetY=ball.y>=0?7:-7;
 return Object.freeze({
  version:BASIC_DEFENSIVE_ACTION_VERSION,kind,
  actorId:actor.id,team:actor.team,opponentId:opponent.player.id,
  opponentBallGapM:opponent.gapM,observedBallSpeedMps:speed,
  observedBallVx:velocity.x,observedBallVy:velocity.y,
  observedBallX:ball.x,observedBallY:ball.y,ownGoalX,
  targetX:ball.x+attack*9,targetY:ball.y+targetY,
  actualOpposingPlayerObserved:true,
  nativeRapierShoeStartRequired:true,physicalAttemptOnly:true,
  tackleWon:false,interceptionConfirmed:false,
  officialPossession:false,officialMatchAction:false,
  officialResult:null
 });
}
