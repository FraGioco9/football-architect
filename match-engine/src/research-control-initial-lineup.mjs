// #620 CONTROL: two bounded DEV-only before-tick-zero research formations.
// No synthetic shoe event, forced action, second ball or player teleport.
// Original 22 identities, same canonical 60Hz mover and Rapier world.
import {PLAYER_MIN_SEPARATION_M} from './player-movement.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const CONTROL_RECEIVER_INITIAL=Object.freeze({
 id:'home-9',x:-5,y:-3.2
});
export const CONTROL_OPPONENT_FIRST_INITIAL=Object.freeze({
 receiver:Object.freeze({id:'home-9',x:-5,y:-6.5}),
 alternative:Object.freeze({id:'home-11',x:-30,y:18}),
 opponent:Object.freeze({id:'away-7',x:-2.95,y:-2})
});
// Bounded alternative starting geometry, NEVER a staged collision:
// the existing autonomous mover and physical shoe world run unchanged.
export const CONTROL_CLOSE_DEFENDER_INITIAL=Object.freeze({
 id:'away-7',x:-2.8,y:-3.8
});
export function initialResearchControlLineup(players,ball,{
 opponentFirst=false,side='home',closeDefender=false
}={}){
 if(!['home','away'].includes(side)||(opponentFirst&&side!=='home'))
  throw new TypeError('Bounded CONTROL side; opponent-first HOME only');
 if(typeof closeDefender!=='boolean'||(closeDefender&&opponentFirst))
  throw new TypeError('Close-defender research must be distinct from opponent-first');
 if(typeof opponentFirst!=='boolean')
  throw new TypeError('Bounded opponent-first flag must be boolean');
 if(!Array.isArray(players)||players.length!==22||!ball||
    ![ball.x,ball.y,ball.z,ball.vx,ball.vy,ball.vz].every(finite)||
    Math.abs(ball.x-(side==='home'?-4.96:4.96))>1e-6||
    ball.y!==0||ball.z!==0||
    Math.abs(ball.vx-(side==='home'?0.3:-0.3))>1e-6||ball.vy!==0||ball.vz!==0)
  throw new TypeError('Closed deterministic grounded CONTROL starting setup required');
 const target=opponentFirst?CONTROL_OPPONENT_FIRST_INITIAL.receiver:
  CONTROL_RECEIVER_INITIAL;
 if(players.filter(p=>p.id===side+'-9'&&p.team===side&&
     p.role==='forward').length!==1)
  throw new TypeError('Canonical genuine receiving teammate required');
 if(opponentFirst&&(
    players.filter(p=>p.id==='away-7'&&p.team==='away'&&
      p.role==='midfielder').length!==1||
    players.filter(p=>p.id==='home-11'&&p.team==='home'&&
      p.role==='forward').length!==1))
  throw new TypeError('Canonical opponent and safe recipient alternative required');
 if(closeDefender&&players.filter(p=>p.id===(side==='home'?'away':'home')+'-7'&&
     p.team!==(side)&&p.role==='midfielder').length!==1)
  throw new TypeError('M26 requires canonical original opposing midfielder #7');
 const stagedPositions=opponentFirst?[
  target,CONTROL_OPPONENT_FIRST_INITIAL.alternative,
  CONTROL_OPPONENT_FIRST_INITIAL.opponent
 ]:closeDefender?[target,{
  ...CONTROL_CLOSE_DEFENDER_INITIAL,
  id:side==='home'?'away-7':'home-7'
 }]:[target];
 // HOME coordinates and HOME IDs are canonical; reverse pitch X and
 // mirror team IDs only for the bounded AWAY receiving fixture.
 const mirror=p=>side==='home'?p:Object.freeze({
  id:p.id.replace(/^home-/,'away-').replace(/^away-7$/,'home-7'),
  x:-p.x,y:p.y
 });
 const positions=new Map(stagedPositions.map(p=>{
  const position=mirror(p);return [position.id,position];
 }));
 const staged=players.map(p=>{
  const pos=positions.get(p.id);
  return pos?Object.freeze({...p,x:pos.x,y:pos.y,
   baseX:pos.x,baseY:pos.y,vx:0,vy:0,blockedBy:null}):p;
 });
 for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
  if(Math.hypot(staged[i].x-staged[j].x,
     staged[i].y-staged[j].y)<PLAYER_MIN_SEPARATION_M-1e-7)
   throw new RangeError('Canonical 0.98m initial player separation required');
 return Object.freeze(staged);
}
