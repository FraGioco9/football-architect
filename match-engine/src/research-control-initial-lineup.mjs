// #620 CONTROL LAB research-only 22-player initial setup.
// No teleports after tick zero, no contact injection, no pass/possession award.
import {PLAYER_MIN_SEPARATION_M} from './player-movement.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const positions=Object.freeze([
 ...[-6,-5,-4,-3,-2].flatMap(x=>[-3.2,-3.8,-4.5,-5.2,-6].map(y=>
  Object.freeze({x,y})))
]);
export const CONTROL_RESEARCH_CANDIDATES=positions;
export function initialResearchControlLineup(players,ball,slot){
 if(!Number.isInteger(slot)||slot<0||slot>=positions.length||
    !Array.isArray(players)||players.length!==22||!ball||
    ![ball.x,ball.y,ball.z,ball.vx,ball.vy,ball.vz].every(finite)||
    Math.abs(ball.x+4.96)>1e-6||ball.y!==0||ball.z!==0||
    Math.abs(ball.vx-0.3)>1e-6||ball.vy!==0||ball.vz!==0)
  throw new TypeError('Closed deterministic grounded CONTROL starting setup required');
 const actorId='home-9',original=players.find(p=>p.id===actorId);
 if(!original||original.team!=='home'||original.role!=='forward')
  throw new TypeError('Canonical genuine receiving teammate required');
 const {x,y}=positions[slot];
 const lineup=players.map(p=>p.id===actorId?
  Object.freeze({...p,x,y,baseX:x,baseY:y,
   vx:0,vy:0,blockedBy:null}):p);
 for(let i=0;i<lineup.length;i++)for(let j=i+1;j<lineup.length;j++)
  if(Math.hypot(lineup[i].x-lineup[j].x,
     lineup[i].y-lineup[j].y)<PLAYER_MIN_SEPARATION_M-1e-7)
   throw new RangeError('Physical body separation at CONTROL tick zero required');
 return Object.freeze(lineup);
}
