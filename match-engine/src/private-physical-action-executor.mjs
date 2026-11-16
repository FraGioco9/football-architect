// Extracted #481 A4.2b.1 physical impulse boundary.
// A private, opt-in adapter for the SAME Rapier ball body and canonical
// 22-shoe event source. No world, policy/mover override or official results.
import {inspectPhysicalActionRejection,selectUniformAutonomousContactAction,
 UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS}
 from './player-ball-uniform-autonomous-action.mjs';
import {FOOT_CONTACT_VERSION} from './player-foot-contact.mjs';
import {calculateRealReceivingCushion}
 from './physical-receiving-cushion-m25.mjs';

export const PRIVATE_PHYSICAL_ACTION_EXECUTOR_VERSION=
 'me-action-foundation-real-shoe-impulse-v1';

export function createPrivatePhysicalActionExecutor({
 ballBody,shoeBridge,ballRadiusM,allowPhysicalCarry=false,
 researchReceivingCushionSide=null
}={}){
 if(!ballBody||typeof ballBody.translation!=='function'||
    typeof ballBody.linvel!=='function'||
    typeof ballBody.applyImpulse!=='function'||
    !shoeBridge||typeof shoeBridge.snapshot!=='function'||
    typeof ballRadiusM!=='number'||!Number.isFinite(ballRadiusM)||
    ballRadiusM<0.05||ballRadiusM>0.2||
    typeof allowPhysicalCarry!=='boolean'||
    (researchReceivingCushionSide!==null&&
     !['home','away'].includes(researchReceivingCushionSide))||
    (researchReceivingCushionSide!==null&&allowPhysicalCarry)
  throw new TypeError('Private Rapier body and live shoe source required');
 let tick=0,lastActionTick=-UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS;
 let action=null,audit=null,closed=false;
 let actualPriorPass=null,interrupted=false,firstCushion=null;
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
  if(researchReceivingCushionSide!==null){
   const side=researchReceivingCushionSide;
   const opposite=side==='home'?'away':'home',receiverId=side+'-9';
   // Existing real PASS impulse precedes candidate cushioning. Any other
   // genuine post-PASS shoe START invalidates untouched pass attribution.
   if(actualPriorPass&&nextTick>actualPriorPass.tick&&
      contact.started.some(id=>id!==receiverId))
    interrupted=true;
   if(actualPriorPass&&!interrupted&&!firstCushion&&
      nextTick>actualPriorPass.tick&&chosen===null&&
      contact.started.length===1&&contact.active.length===1&&
      contact.started[0]===receiverId&&
      contact.active[0]===receiverId){
    const p=playerFrame?.players?.find(x=>x.id===receiverId);
    const opponents=playerFrame?.players?.filter(x=>x.team===opposite);
    if(!p||p.team!==side||!Array.isArray(opponents)||
       opponents.length!==11||![p.x,p.y,p.vx,p.vy].every(Number.isFinite)||
       opponents.some(x=>![x.x,x.y].every(Number.isFinite)))
     throw new TypeError('M25 needs original same-tick 22-player source');
    const position=ballBody.translation(),velocity=ballBody.linvel();
    const opponentGap=Math.min(...opponents.map(x=>
      Math.hypot(x.x-p.x,x.y-p.y)));
    const result=calculateRealReceivingCushion({
     ballVelocity:velocity,playerVelocity:p,
     ballCentreZ:position.z,ballRadiusM,
     realBallPlayerGapM:Math.hypot(position.x-p.x,position.y-p.y),
     nearestOpponentM:opponentGap
    });
    if(result!==null){
     const before=Object.freeze({...velocity});
     // The ONLY extra write: bounded XY counter-impulse onto the SAME
     // real Rapier body AFTER this tick's native shoe collision START.
     ballBody.applyImpulse(result.impulseNs,true);
     firstCushion=Object.freeze({
      version:'m25-research-first-touch-impulse-v1',
      tick:nextTick,actorId:receiverId,team:side,
      originalPassTick:actualPriorPass.tick,
      originalPassActorId:actualPriorPass.playerId,
      nativeExclusiveShoeStart:true,originalRapierBallBody:true,
      actualPhysicsImpulseApplied:true,...result,
      realPreBallVelocity:before,
      realPostBallVelocity:Object.freeze({...ballBody.linvel()}),
      officialMatchAction:false,officialPossession:false,
      verifiedReception:false,verifiedBallControl:false
     });
    }
   }
   if(applied?.action==='pass'&&applied.team===side&&
      applied.playerId===side+'-10'&&
      applied.passTarget?.recipientId===receiverId&&!actualPriorPass)
    actualPriorPass=Object.freeze({tick:nextTick,playerId:applied.playerId});
  }
  tick=nextTick;action=applied;audit=currentAudit;
  return Object.freeze({tick,action,audit});
 }
 return Object.freeze({
  apply,
  actionSnapshot:()=>{ensureOpen();return action;},
  rejectionSnapshot:()=>{ensureOpen();return audit;},
  cushionSnapshot:()=>{ensureOpen();return firstCushion;},
  dispose:()=>{closed=true;}
 });
}
