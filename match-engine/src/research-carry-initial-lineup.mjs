// #620 CARRY LAB: bounded paired marking before tick zero only.
// No altered policy, generated collision, player teleport or injected impulse.
// One real opposing marker near each otherwise-safe recipient disables a
// PASS candidate via the original near-opponent <1.6m rule.
import {PLAYER_MIN_SEPARATION_M} from './player-movement.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const CARRY_MARKER_GAP_M=1.15;
export function initialResearchCarryLineup(players,side,ball){
 if(!Array.isArray(players)||players.length!==22||
    !['home','away'].includes(side)||!ball||
    ![ball.x,ball.y,ball.z,ball.vx,ball.vy,ball.vz].every(finite))
  throw new TypeError('Bounded canonical CARRY starting lineup required');
 const direction=side==='home'?1:-1;
 if(Math.abs(direction*ball.x+4.96)>1e-6||
    ball.y!==0||ball.z!==0||
    Math.abs(direction*ball.vx-0.3)>1e-6||
    ball.vy!==0||ball.vz!==0)
  throw new RangeError('Carry requires original central-ground ball approach');
 const otherSide=side==='home'?'away':'home';
 const actor=players.find(p=>p.id===side+'-10');
 if(actor?.role!=='forward'||actor.team!==side||
    Math.hypot(actor.x-ball.x,actor.y-ball.y)>0.1)
  throw new TypeError('Exactly the original canonical #10 shoe actor required');
 const markers=new Map();
 for(const no of [9,11]){
  const recipient=players.find(p=>p.id===side+'-'+no);
  const marker=players.find(p=>p.id===otherSide+'-'+no);
  if(recipient?.team!==side||recipient.role!=='forward'||
     marker?.team!==otherSide||marker.role!=='forward')
   throw new TypeError('Opposing canonical forward marker/recipient pair required');
  const x=recipient.x+direction*CARRY_MARKER_GAP_M;
  markers.set(marker.id,Object.freeze({x,y:recipient.y}));
 }
 const staged=players.map(p=>{
  const marker=markers.get(p.id);
  return marker?Object.freeze({...p,...marker,baseX:marker.x,baseY:marker.y,
   vx:0,vy:0,blockedBy:null}):p;
 });
 for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
  if(Math.hypot(staged[i].x-staged[j].x,
    staged[i].y-staged[j].y)<PLAYER_MIN_SEPARATION_M-1e-8)
   throw new RangeError('Carry initial 0.98m body separation violated');
 return Object.freeze(staged);
}
