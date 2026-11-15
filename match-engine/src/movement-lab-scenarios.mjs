// #628 Phase M2: reproducible initial states for position-only movement.
// Mirrored HOME/AWAY setups change only the initial physical Rapier ball.
// No ball teleport, AI command, shoe contact, possession or official action.
const scene=(seed,x,y)=>Object.freeze({
 preset:'roll',seed,x,y,z:0,vx:0,vy:0,vz:0
});
const spec=(id,title,description,home,focusNumber)=>Object.freeze({
 id,title,description,home,focusNumber,officialMatchResult:false,
 shoeSourceEnabled:false
});
export const MOVEMENT_LAB_SCENARIOS=Object.freeze([
 spec('approach','Approach','Observe a player closing toward a stationary real Rapier ball; targets come from the canonical mover.',scene('me-m2-approach',0,0),10),
 spec('brake','Brake','Observe acceleration and possible deceleration toward a stationary real ball; no forced stopping.',scene('me-m2-brake',2.5,0),10),
 spec('turn','Turn','Observe current-velocity heading changes toward a lateral ball location; no manual steering.',scene('me-m2-turn',-5,24),11),
 spec('recovery','Recovery','Observe defensive response only if the canonical mover detects an actual opposing player; no imaginary threat or tackle.',scene('me-m2-recovery',-29,0),6)
]);
export function movementLabScenario(id,side='home'){
 if(!['home','away'].includes(side))throw new TypeError('Known HOME/AWAY side required');
 const s=MOVEMENT_LAB_SCENARIOS.find(x=>x.id===id);
 if(!s)throw new RangeError('Unknown Phase M movement scene');
 const initial=side==='home'?s.home:Object.freeze({
  ...s.home,seed:s.home.seed+'-away',x:-s.home.x
 });
 return Object.freeze({
  spec:s,side,initial,focusId:side+'-'+s.focusNumber
 });
}
