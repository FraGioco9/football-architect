// #628 ACTIONS-B04 — read-only physical TRAP / DRIBBLE attempt testimony.
// The one original closed Rapier executor is the ONLY source of the actual
// first receiving cushion and subsequent one-ball release tap. No possession.
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION}
 from './player-foot-contact-solver.mjs';
export const B04_BASIC_RECEIVE_DRIBBLE_VERSION='actions-b04-native-receive-tap-v1';
const finite=Number.isFinite,freeze=Object.freeze;
export function createBasicReceiveDribbleObserverB04({side,kind}={}){
 if(!['home','away'].includes(side)||!['trap','dribble'].includes(kind))
  throw new TypeError('B04 requires HOME/AWAY original physical source and known action');
 let lastTick=-1,trap=null,dribbleAttempt=null,release=null;
 const id=side+'-9';
 function snapshot(){
  return freeze({
   version:B04_BASIC_RECEIVE_DRIBBLE_VERSION,
   tick:lastTick,side,kind,actorId:id,trap,dribbleAttempt,release,
   witnessedAttempt:kind==='trap'?trap!==null:dribbleAttempt!==null,
   attemptTick:kind==='trap'?trap?.tick??null:
    dribbleAttempt?.tick??null,
   physicallyReleasedAndRecontacted:release!==null,
   physicalEvidenceOnly:true,originalRapierSource:true,readOnly:true,
   verifiedReception:false,verifiedControl:false,verifiedDribble:false,
   officialPossession:false,officialMatchAction:false
  });
 }
 function observe({physics,playerFrame,foot,solver,action=null,
  priorPass=null,cushion=null,tap=null,releaseSequence=null}={}){
  const tick=physics?.tick;
  if(!Number.isSafeInteger(tick)||tick<0||tick!==lastTick+1||
   playerFrame?.tick!==tick||foot?.tick!==tick||
   !Array.isArray(playerFrame?.players)||playerFrame.players.length!==22||
   !INITIAL_PLAYERS.every((p,i)=>{
    const q=playerFrame.players[i];
    return q?.id===p.id&&q.team===p.team&&q.role===p.role&&
     [q.x,q.y,q.vx,q.vy].every(finite);
   })||
   !['x','y','z'].every(k=>finite(physics.ball?.position?.[k])&&
    finite(physics.ball?.velocity?.[k]))||
   !Array.isArray(foot.started)||!Array.isArray(foot.active)||
   !Array.isArray(foot.ended)||new Set(foot.started).size!==foot.started.length)
   throw new TypeError('B04 requires ordered consecutive original 22-player ball/shoe source');
  if(tick===0){
   if(solver!==null||cushion!==null||tap!==null||
      priorPass!==null||releaseSequence!==null||action!==null||
      foot.started.length||foot.active.length||foot.ended.length)
    throw new TypeError('B04 cannot start from synthetic contacts or actions');
  }else if(solver?.version!==FOOT_SOLVER_EVIDENCE_VERSION||
   solver.tick!==tick||!Array.isArray(solver.pairs))
   throw new TypeError('B04 requires the current original Rapier pair solver');
  if(action!==null&&(
   action.tick!==tick||action.appliedByRapier!==true||
   action.actualPhysicsImpulseApplied!==true||
   action.officialMatchAction!==false||
   foot.started.length!==1||foot.started[0]!==action.playerId))
   throw new TypeError('B04 cannot accept external non-shoe football action');
  if(priorPass!==null&&(
   !Number.isSafeInteger(priorPass.tick)||priorPass.tick>tick||
   (priorPass.tick===tick&&(
    action?.action!=='pass'||action.playerId!==side+'-10'))||
   priorPass.playerId!==side+'-10'||priorPass.recipientId!==id||
   priorPass.team!==side||priorPass.physicalImpulseApplied!==true))
   throw new TypeError('B04 original prior pass source required');
  const pair=solver?.pairs?.find(x=>x.id===id);
  const sameTickNativeStart=()=>{
   if(foot.started.length!==1||foot.active.length!==1||
      foot.started[0]!==id||foot.active[0]!==id||
      pair?.beganThisTick!==true||pair.collisionActive!==true||
      !pair.manifolds.some(x=>x.geometricContacts>0))
    throw new TypeError('B04 genuine exclusive native original shoe START/manifold required');
  };
  if(cushion?.tick===tick){
   if(trap||!priorPass||
      cushion.actorId!==id||cushion.team!==side||
      cushion.originalPassTick!==priorPass.tick||
      cushion.originalPassActorId!==priorPass.playerId||
      cushion.nativeExclusiveShoeStart!==true||
      cushion.actualPhysicsImpulseApplied!==true||
      cushion.originalRapierBallBody!==true||
      cushion.officialMatchAction!==false||
      cushion.officialPossession!==false||
      cushion.verifiedReception!==false||
      cushion.verifiedBallControl!==false||
      !['x','y','z'].every(k=>finite(cushion.impulseNs?.[k]))||
      Math.hypot(...['x','y','z'].map(k=>cushion.impulseNs[k]))<=0||
      action!==null)
    throw new TypeError('B04 real pass then original separate receiving cushion required');
   sameTickNativeStart();
   trap=freeze({
    tick,actorId:id,team:side,passTick:priorPass.tick,
    nativeExclusiveStart:true,originalRapierBallImpulse:true,
    boundedCushionImpulseNs:cushion.impulseNs,
    receiveAttemptOnly:true,trapConfirmed:false,
    officialReception:false,officialControl:false,officialPossession:false
   });
  }else if(cushion!==null&&(!trap||cushion.tick!==trap.tick))
   throw new TypeError('B04 cushion history cannot be forged or replaced');
  if(tap?.tick===tick){
   if(kind!=='dribble'||!trap||dribbleAttempt||
      tap.actorId!==id||tap.team!==side||
      tap.priorCushionTick!==trap.tick||
      tap.originalDecisionTick!==tick||
      tap.nativeExclusiveShoeStart!==true||
      tap.actualPhysicsImpulseApplied!==true||
      tap.originalRapierBallBody!==true||
      tap.originalClearanceSuppressed!==true||
      tap.officialMatchAction!==false||
      tap.officialPossession!==false||tap.matchAuthority!==false||
      !finite(tap.impulseMagnitudeNs)||
      tap.impulseMagnitudeNs<=0||tap.impulseMagnitudeNs>1.35+1e-8||
      action!==null)
    throw new TypeError('B04 release-tap requires original cushion, true second START and one Rapier impulse');
   sameTickNativeStart();
   dribbleAttempt=freeze({
    tick,actorId:id,team:side,firstTrapTick:trap.tick,
    genuineSecondShoeStart:true,physicalTapImpulseNs:tap.impulseNs,
    physicalPushAttemptOnly:true,dribbleConfirmed:false,
    officialPossession:false,officialMatchAction:false
   });
  }else if(tap!==null&&(
   kind!=='dribble'||!dribbleAttempt||
   tap.tick!==dribbleAttempt.tick))
   throw new TypeError('B04 cannot replace earlier physical second shoe tap');
  const complete=releaseSequence?.latestCompleted;
  if(complete?.sourceVerifiedSequence&&!release){
   if(kind!=='dribble'||!dribbleAttempt||
      complete.sourceSecondShoeTick!==dribbleAttempt.tick||
      complete.actorId!==id||complete.team!==side||
      complete.firstTrueShoeEndTick<=dribbleAttempt.tick||
      complete.firstTrueSubsequentShoeStartTick<=
        complete.firstTrueShoeEndTick||
      complete.exclusiveNativeRecontact!==true||
      complete.officialPossession!==false||
      complete.verifiedDribble!==false||
      !complete.actualActionAfterTap)
    throw new TypeError('B04 release and recontact must be current M30 native audited sequence');
   release=freeze({
    actorId:id,team:side,secondPushTick:dribbleAttempt.tick,
    actualShoeEndTick:complete.firstTrueShoeEndTick,
    actualShoeRecontactTick:complete.firstTrueSubsequentShoeStartTick,
    originalActionAtRecontact:complete.actualActionAfterTap,
    realReleaseAndRecontact:true,dribbleConfirmed:false,
    officialControl:false,officialPossession:false
   });
  }
  lastTick=tick;return snapshot();
 }
 return freeze({observe,snapshot});
}
