// #628 M8: opt-in, before-tick-zero physically contested approach.
// This is a controlled research fixture, NOT natural match behavior.
// Real 22 canonical identities, one real Rapier ball world, no teleports
// after initialization, and no synthetic collision/action messages.
import {PLAYER_MIN_SEPARATION_M} from './player-movement.mjs';
const finite=Number.isFinite;
export const BODY_ENCOUNTER_IDS=Object.freeze(['home-10','away-10']);
export const BODY_ENCOUNTER_START_X_M=0.72;
export const BODY_ENCOUNTER_TARGET_X_M=3.5;
export function initialResearchBodyEncounterLineup(players,ball,
 {sharedContactBall=false}={}){
 // M8 default remains exactly centre ball. M9 explicitly stages a
 // 25cm offset ball once BEFORE tick zero to authenticate an actual
 // shoe-ball START alongside original physical body-body contact.
 const expectedX=sharedContactBall?0.25:0;
 if(typeof sharedContactBall!=='boolean'||
    !Array.isArray(players)||players.length!==22||
    !ball||!['x','y','z','vx','vy','vz'].every(k=>finite(ball[k]))||
    Math.abs(Math.abs(ball.x)-expectedX)>1e-9||
    [ball.y,ball.z,ball.vx,ball.vy,ball.vz].some(n=>n!==0))
  throw new TypeError('Closed real stationary M8/M9 research encounter ball required');
 for(const id of BODY_ENCOUNTER_IDS){
  const p=players.filter(v=>v.id===id);
  if(p.length!==1||p[0].role!=='forward')
   throw new TypeError('Only original opposing #10 forward bodies');
 }
 const out=players.map(p=>{
  if(p.id!=='home-10'&&p.id!=='away-10')return p;
  const x=p.team==='home'?-BODY_ENCOUNTER_START_X_M:
   BODY_ENCOUNTER_START_X_M;
  return Object.freeze({...p,x,y:0,baseX:x,baseY:0,
   vx:0,vy:0,blockedBy:null});
 });
 for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++)
  if(Math.hypot(out[i].x-out[j].x,out[i].y-out[j].y)<
     PLAYER_MIN_SEPARATION_M-1e-8)
   throw new RangeError('Original 0.98m separation required before Rapier contact');
 return Object.freeze(out);
}
export function researchBodyEncounterTarget(id){
 if(id==='home-10')return Object.freeze({x:BODY_ENCOUNTER_TARGET_X_M,y:0});
 if(id==='away-10')return Object.freeze({x:-BODY_ENCOUNTER_TARGET_X_M,y:0});
 return null;
}
