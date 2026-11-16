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
 }),
 // M6 observation-only: original free support assignment from 22 actual
 // player XY in the opposing third. No forced teammate route, pass or action.
 spec('support-lane','Support lane','Read the original chosen free teammate and measure current movement into its sampled opponent/teammate-aware lane.',scene('me-m6-support-lane',27,0),9,'M6'),
 spec('support-neutral','No support assignment','Negative: original central-ball territory must not invent a support lane or pass receiver.',scene('me-m6-support-neutral',0,0),9,'M6'),
 // M7: same ORIGINAL Rapier ball World, opt-in native 22-body dynamic
 // colliders (body-body only), or strictly identical default-off control.
 // This is a research shadow; mover positions are NOT reconciled to Rapier.
 spec('body-world','22 Rapier body observers','Research opt-in: all 22 native body colliders share the Rapier ball world; real collision events and divergence are measured, but solver positions are not fed back into the mover.',scene('me-m7-body-world',27,0),9,'M7'),
 spec('body-off','22 bodies OFF','Negative control: same source ball and 22-player mover but NO native player body colliders; no collision can be inferred from close spacing.',scene('me-m7-body-world',27,0),9,'M7'),
 // Explicit controlled research collision, not a natural football match.
 // Only real 60Hz player velocities, native Rapier collision events and
 // checked post-solver XY feedback can satisfy an M8 positive witness.
 spec('body-encounter','Body encounter and feedback','Controlled before-tick-zero opposing forwards run toward each other. Observe native same-world collision and accept only bounded Rapier-resolved XY into the original mover.',scene('me-m8-body-encounter',0,0),10,'M8'),
 spec('body-encounter-off','Body encounter OFF','Exact same original 22-player controlled approach without native player colliders. No collision or physical feedback can be credited.',scene('me-m8-body-encounter',0,0),10,'M8'),
 // M9: verified single-queue cohabitation in one original Rapier World.
 // Neither M9 choice activates game actions or creates a second ball.
 spec('shared-contacts','Shared shoe + body events','One original Rapier ball World and native event queue routes genuine shoe-ball START and body-body START independently. Explicit collision stress fixture; no match authority.',scene('me-m9-shared-contacts',-0.25,0),10,'M9'),
 spec('shared-contacts-off','Shared contacts OFF','Negative: exactly the same controlled 22-player approach with no native shoe/body collision bridges.',scene('me-m9-shared-contacts',-0.25,0),10,'M9'),
 // M10: no substituted player coordinates, target overrides, or staged
 // pair. Natural existing 22-player mover sees current real Rapier ball XY.
 spec('pressure-support','Free support under opposition','Original free support runner and the real opposing presser move under original 60Hz duties; observe both actual XY paths with live shoes+body observers in one native queue. No staged pair, forced target or football award.',scene('me-m10-pressure-support',27,0),9,'M10'),
 spec('pressure-neutral','No support under opposition','Original neutral-ball negative: the same unstaged 22-player mover and same real native shoe/body event queue cannot invent a support assignment.',scene('me-m10-pressure-neutral',0,0),9,'M10'),
 // M12: actual current opposing pressers may converge on the ACTUAL ball.
 // No player staging, false contact, or 11v11 panel.
 spec('opposing-convergence','Original press convergence','Both original currently assigned opposing pressers converge on the actual ball only when their own observed XY enter the same bounded contest area. 22 unstaged players, one shared native Rapier queue; native body START is required, never guessed.',scene('me-m12-opposing-convergence',0,0),10,'M12'),
 spec('opposing-convergence-off','Press convergence OFF','Identical original 22-player positions and original ball physics, with the new press-to-ball intent disabled. Both native bridges stay enabled as an authentic negative.',scene('me-m12-opposing-convergence',0,0),10,'M12'),
 // M13: both experiments retain the positive real press-to-ball policy;
 // only one permits same-world native body solver XY reconciliation.
 spec('opposing-feedback','Unstaged native body feedback','M12 original opposed pressers and a real shared Rapier body START; apply original native solver XY ONLY when the 22-player canonical 0.98m, speed, pitch and authentic-event gates pass. Research, not football action.',scene('me-m13-unstaged-feedback',0,0),10,'M13'),
 spec('opposing-feedback-off','Unstaged body feedback OFF','Same ORIGINAL unstaged 22-player contest and native contact events, but do not apply physical solver corrections to canonical player motion. Genuine contact remains independently observable.',scene('me-m13-unstaged-feedback',0,0),10,'M13')
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
