// #628 Phase M2: reproducible initial states for position-only movement.
// Mirrored HOME/AWAY setups change only the initial physical Rapier ball.
// No ball teleport or invented football action. The M3 post-pass scene
// delegates genuine existing physical PASS authority to the Action LAB.
import {CONTROL_LAB_STARTS} from './action-lab-scenarios.mjs';
const scene=(seed,x,y)=>Object.freeze({
 preset:'roll',seed,x,y,z:0,vx:0,vy:0,vz:0
});
const spec=(id,title,description,home,focusNumber,phase='M2')=>Object.freeze({
 id,title,description,home,focusNumber,phase,officialMatchResult:false,
 shoeSourceEnabled:false
});
export const MOVEMENT_LAB_SCENARIOS=Object.freeze([
 spec('approach','Approach','Observe a player closing toward a stationary real Rapier ball; targets come from the canonical mover.',scene('me-m2-approach',0,0),10),
 spec('brake','Brake','Observe acceleration and possible deceleration toward a stationary real ball; no forced stopping.',scene('me-m2-brake',2.5,0),10),
 spec('turn','Turn','Observe current-velocity heading changes toward a lateral ball location; no manual steering.',scene('me-m2-turn',-5,24),11),
 spec('recovery','Recovery','Observe defensive response only if the canonical mover detects an actual opposing player; no imaginary threat or tackle.',scene('me-m2-recovery',-29,0),6),
 spec('recovery-response','Goal-side response','Measure real goal-side travel of the tracked, assigned recovering player, only while an actual opponent and recovery assignment persist.',scene('me-m3-recovery-response',-29,0),6,'M3'),
 spec('recovery-empty','No opponent','Negative control: no observed current-opponent screen means no recovery evidence or phantom displacement.',scene('me-m3-empty',0,30),6,'M3'),
 Object.freeze({
  ...spec('post-pass','Run after PASS','Original CONTROL Action LAB: authentic HOME or AWAY Rapier PASS, then measured receiver movement. Completion and possession unverified.',CONTROL_LAB_STARTS.home,9,'M3'),
  shoeSourceEnabled:true
 }),
 // M5 retains the already accepted original HOME opponent-first CONTROL
 // scene. One real Rapier ball and the same canonical 22-player mover.
 Object.freeze({
  ...spec('opponent-contact','Opposing shoe contest',
   'HOME-controlled original PASS, actual AWAY #7 movement and genuine subsequent opponent shoe-ball START. No body collision, tackle or interception is certified.',
   CONTROL_LAB_STARTS.home,9,'M5'),
  shoeSourceEnabled:true
 })
]);
export function movementLabScenario(id,side='home'){
 if(!['home','away'].includes(side))throw new TypeError('Known HOME/AWAY side required');
 const s=MOVEMENT_LAB_SCENARIOS.find(x=>x.id===id);
 if(!s)throw new RangeError('Unknown Phase M movement scene');
 if(s.id==='opponent-contact'&&side!=='home')
  throw new RangeError('Only original genuine HOME opponent-first CONTROL source is verified');
 const initial=s.id==='post-pass'?CONTROL_LAB_STARTS[side]:
  s.id==='opponent-contact'?CONTROL_LAB_STARTS.home:
  side==='home'?s.home:Object.freeze({
   ...s.home,seed:s.home.seed+'-away',x:-s.home.x
  });
 return Object.freeze({
  spec:s,side,initial,focusId:side+'-'+s.focusNumber
 });
}
