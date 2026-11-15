// #620 CONTROL: one bounded starting formation, not a fabricated reception.
// Exactly one original teammate is 3.2m ahead of the REAL passer's foot.
// All other identities, roles, initial poses and physical limitations remain.
import {PLAYER_MIN_SEPARATION_M} from './player-movement.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const CONTROL_RECEIVER_INITIAL=Object.freeze({
 id:'home-9',x:-5,y:-3.2
});
export function initialResearchControlLineup(players,ball){
 if(!Array.isArray(players)||players.length!==22||!ball||
    ![ball.x,ball.y,ball.z,ball.vx,ball.vy,ball.vz].every(finite)||
    Math.abs(ball.x+4.96)>1e-6||ball.y!==0||ball.z!==0||
    Math.abs(ball.vx-0.3)>1e-6||ball.vy!==0||ball.vz!==0)
  throw new TypeError('Closed deterministic grounded CONTROL starting setup required');
 const {id,x,y}=CONTROL_RECEIVER_INITIAL;
 if(players.filter(p=>p.id===id&&p.team==='home'&&p.role==='forward').length!==1)
  throw new TypeError('Canonical genuine receiving teammate required');
 const staged=players.map(p=>p.id===id?
  Object.freeze({...p,x,y,baseX:x,baseY:y,vx:0,vy:0,blockedBy:null}):p);
 for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
  if(Math.hypot(staged[i].x-staged[j].x,
     staged[i].y-staged[j].y)<PLAYER_MIN_SEPARATION_M-1e-7)
   throw new RangeError('Canonical 0.98m initial player separation required');
 return Object.freeze(staged);
}
