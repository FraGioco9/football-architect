// Extracted #481 A4.2b.1 physical impulse boundary.
// A private, opt-in adapter for the SAME Rapier ball body and canonical
// 22-shoe event source. No world, policy/mover override or official results.
import {inspectPhysicalActionRejection,selectUniformAutonomousContactAction,
 UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS}
 from './player-ball-uniform-autonomous-action.mjs';
import {FOOT_CONTACT_VERSION} from './player-foot-contact.mjs';

export const PRIVATE_PHYSICAL_ACTION_EXECUTOR_VERSION=
 'me-action-foundation-real-shoe-impulse-v1';

export function createPrivatePhysicalActionExecutor({
 ballBody,shoeBridge,ballRadiusM,allowPhysicalCarry=false
}={}){
 if(!ballBody||typeof ballBody.translation!=='function'||
    typeof ballBody.linvel!=='function'||
    typeof ballBody.applyImpulse!=='function'||
    !shoeBridge||typeof shoeBridge.snapshot!=='function'||
    typeof ballRadiusM!=='number'||!Number.isFinite(ballRadiusM)||
    ballRadiusM<0.05||ballRadiusM>0.2||
    typeof allowPhysicalCarry!=='boolean')
  throw new TypeError('Private Rapier body and live shoe source required');
 let tick=0,lastActionTick=-UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS;
 let action=null,audit=null,closed=false;
 const ensureOpen=()=>{if(closed)throw new Error('Physical action executor disposed');};
 function apply(nextTick,playerFrame){
  ensureOpen();
  const contact=shoeBridge.snapshot();
  if(!Number.isSafeInteger(nextTick)||nextTick!==tick+1||
     !contact||contact.version!==FOOT_CONTACT_VERSION||
     contact.tick!==nextTick)
   throw new RangeError('Current genuine shoe event tick required');
  // This is called solely by the core after its single Rapier world.step().
  // No caller-selected action, injected START, custom impulse or player ID.
  const input={
   tick:nextTick,
   contactStarted:contact.started,contactActive:contact.active,
   playerFrame,ballPosition:ballBody.translation(),
   ballVelocity:ballBody.linvel(),ballRadiusM,lastActionTick,
   allowPhysicalCarry
  };
  const gates=inspectPhysicalActionRejection(input);
  const chosen=selectUniformAutonomousContactAction(input);
  if(chosen&&(!gates.passedInputGates||
     gates.actorId!==chosen.playerId||
     !contact.started.includes(chosen.playerId)||
     contact.started.length!==1||contact.active.length!==1||
     contact.active[0]!==chosen.playerId))
   throw new Error('Rapier exclusive START and original action gates disagree');
  const currentAudit=Object.freeze({
   ...gates,actionSelected:chosen!==null,
   noActionReason:chosen?null:
    (gates.firstFailedGate??'not-selected-after-input-gates')
  });
  let applied=null;
  if(chosen){
   // The only new physics write; same body and SAME post-collision tick
   // as the original #481, never a future/replayed intent.
   ballBody.applyImpulse(chosen.impulseNs,true);
   applied=Object.freeze({
    ...chosen,appliedByRapier:true,
    actionSource:'internal-uniform-22-player-ai',
    actualPhysicsImpulseApplied:true
   });
   lastActionTick=nextTick;
  }
  tick=nextTick;action=applied;audit=currentAudit;
  return Object.freeze({tick,action,audit});
 }
 return Object.freeze({
  apply,
  actionSnapshot:()=>{ensureOpen();return action;},
  rejectionSnapshot:()=>{ensureOpen();return audit;},
  dispose:()=>{closed=true;}
 });
}
