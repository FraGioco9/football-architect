// #628 M29 — source-verified second-touch contact dynamics, read-only.
// Native active shoe contact and proximity are NOT official ball custody.
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from './player-foot-contact-solver.mjs';
import {footProxyTransform} from './player-foot-contact.mjs';
const freeze=Object.freeze,finite=Number.isFinite;
const round=v=>Math.round(v*10000)/10000;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const ids=INITIAL_PLAYERS.map(p=>p.id);
const known=new Set(ids);
const ordered=a=>Array.isArray(a)&&new Set(a).size===a.length&&
 a.every((id,i)=>known.has(id)&&(i===0||ids.indexOf(a[i-1])<ids.indexOf(id)));
function validate({physics,playerFrame,foot,solver,m28,action},priorTick){
 const t=physics?.tick;
 if(!Number.isSafeInteger(t)||t!==priorTick+1||t<0||
    playerFrame?.tick!==t||foot?.tick!==t||m28?.tick!==t||
    m28.readOnly!==true||m28.matchAuthority!==false||
    m28.verifiedPossession!==false||m28.verifiedControl!==false||
    !ordered(foot.started)||!ordered(foot.active)||!ordered(foot.ended)||
    !Array.isArray(playerFrame.players)||playerFrame.players.length!==22||
    !INITIAL_PLAYERS.every((p,i)=>{
     const q=playerFrame.players[i];
     return q?.id===p.id&&q.team===p.team&&q.role===p.role&&
      [q.x,q.y,q.vx,q.vy,q.facingRad].every(finite);
    })||
    !['x','y','z'].every(k=>finite(physics.ball?.position?.[k])&&
     finite(physics.ball?.velocity?.[k]))||
    (action!==null&&(
     action?.tick!==t||action?.appliedByRapier!==true||
     action.actualPhysicsImpulseApplied!==true||
     action.officialMatchAction!==false||
     foot.started.length!==1||foot.started[0]!==action.playerId)))
  throw new TypeError('M29 requires original consecutive native player/ball evidence');
 if(t===0){
  if(solver!==null||m28.active!==null||m28.latestCompleted!==null)
   throw new TypeError('M29 tick-zero source must not invent a Rapier contact');
  return;
 }
 if(solver?.version!==FOOT_SOLVER_EVIDENCE_VERSION||solver.tick!==t||
    !Array.isArray(solver.pairs)||
    !ordered(solver.pairs.map(p=>p.id))||
    !Number.isSafeInteger(solver.reportedForcePairs)||
    solver.reportedForcePairs<0)
  throw new TypeError('M29 needs genuine current Rapier pair solver source');
 const forces=solver.pairs.filter(p=>p.rapierForceReported);
 if(forces.length!==solver.reportedForcePairs||
    solver.simultaneousSolverPairs!==(forces.length>=2)||
    solver.pairs.some(p=>
     p.collisionActive!==foot.active.includes(p.id)||
     p.beganThisTick!==foot.started.includes(p.id)||
     p.endedThisTick!==foot.ended.includes(p.id)||
     !Array.isArray(p.manifolds)||
     p.manifolds.some(m=>!Number.isInteger(m.solverContacts)||
      m.solverContacts<0||!Number.isInteger(m.geometricContacts)||
      m.geometricContacts<0)||
     (p.rapierForceReported&&(
      !finite(p.derivedNetImpulseMagnitudeNs)||
      !finite(p.derivedSumOfForceMagnitudesNs)||
      p.derivedNetImpulseMagnitudeNs<0||
      p.derivedSumOfForceMagnitudesNs<0)))||
    [...foot.started,...foot.active,...foot.ended].some(id=>
     !solver.pairs.some(p=>p.id===id)))
  throw new TypeError('M29 native shoe events and same-world force/manifold source disagree');
}
export function createNativeControlEvidenceGateM29(){
 let tick=-1,active=null,latestCompleted=null;
 function report(s,reason=null){
  return freeze({
   version:'m29-native-control-evidence-gate-v1',
   actorId:s.id,team:s.team,sourceDecisionTick:s.start,
   observedTicks:s.samples,lastTick:s.lastTick,
   realActivePairTicks:s.activePairTicks,realManifoldTicks:s.manifoldTicks,
   realSolverContactTicks:s.solverTicks,realForceReportTicks:s.forceTicks,
   derivedNetPairImpulseSumNs:round(s.impulseSum),
   actualShoeReleaseEvents:s.releases,
   subsequentExclusiveShoeStarts:s.newStarts,
   genuineReleaseThenRecontact:s.reacquisitions,
   maxRealBallPlayerRelativeSpeedMps:round(s.maxRelativeSpeed),
   maximumBallToRealShoeCentreXYM:round(s.maxShoeGap),
   actualBallTravelXYM:round(s.ballTravel),
   actualReceiverTravelXYM:round(s.playerTravel),
   original22Source:true,readOnly:true,
   independentlyReacquiredAfterRelease:s.reacquisitions>0,
   continuousNativePairWithoutRelease:s.samples>0&&
    s.activePairTicks===s.samples&&s.releases===0,
   physicalSequenceClassification:s.reacquisitions>0?
    'independent-native-recontact-candidate':
    s.releases>0?'released-without-new-native-contact':
    'continuous-native-contact-only',
   endReason:reason,complete:reason!==null,
   // Deliberately NOT an official rules decision: a native force sample
   // or repeated START alone can never award football possession.
   controlCandidateOnly:true,verifiedControl:false,verifiedReception:false,
   verifiedTackle:false,verifiedInterception:false,verifiedPossession:false,
   officialPossession:false,officialMatchAction:false,matchAuthority:false
  });
 }
 function observe({physics,playerFrame,foot,solver,m28,action=null}={}){
  validate({physics,playerFrame,foot,solver,m28,action},tick);
  const t=physics.tick,window=m28.active;
  if(window?.sourceDecisionTick===t){
   const id=window.actorId,actor=playerFrame.players.find(p=>p.id===id);
   const native=solver?.pairs.find(p=>p.id===id);
   if(active||latestCompleted||
      !['home-9','away-9'].includes(id)||actor?.team!==window.team||
      window.genuineSecondShoeStart!==true||
      window.observedTicks!==1||
      !foot.started.includes(id)||foot.started.length!==1||
      !foot.active.includes(id)||foot.active.length!==1||
      native?.beganThisTick!==true||native.collisionActive!==true||
      action!==null)
    throw new TypeError('M29 starts only on independent original M28 native second shoe');
   active={id,team:window.team,start:t,lastTick:t-1,samples:0,
    activePairTicks:0,manifoldTicks:0,solverTicks:0,forceTicks:0,
    impulseSum:0,releases:0,newStarts:0,reacquisitions:0,awaitingNewStart:false,
    maxRelativeSpeed:0,maxShoeGap:0,ballTravel:0,playerTravel:0,
    lastBall:null,lastPlayer:null};
  }
  if(active){
   const id=active.id,sameTickWindow=(window?.actorId===id&&
    window.lastTick===t)||(
     // M28 closes its 120th sample *on* this tick: active becomes null
     // but its completed report still includes the current native frame.
     m28.latestCompleted?.actorId===id&&
     m28.latestCompleted.lastTick===t&&
     m28.latestCompleted.endReason==='two-second-native-observation-complete');
   // M28's other-shoe/physical-action endpoint does NOT attribute the
   // conflicting tick to the original receiver; M29 must do the same.
   if(sameTickWindow){
    const actor=playerFrame.players.find(p=>p.id===id);
    const pair=solver.pairs.find(p=>p.id===id);
    const pose=footProxyTransform(actor),b=physics.ball;
    if(!actor||window.observedTicks!==active.samples+1)
     throw new TypeError('M29 and M28 must sample exactly the same real tick');
    if(active.lastBall){
     active.ballTravel+=dist(active.lastBall,b.position);
     active.playerTravel+=dist(active.lastPlayer,actor);
    }
    active.lastBall=freeze({...b.position});
    active.lastPlayer=freeze({x:actor.x,y:actor.y});
    active.maxRelativeSpeed=Math.max(active.maxRelativeSpeed,
     Math.hypot(b.velocity.x-actor.vx,b.velocity.y-actor.vy));
    active.maxShoeGap=Math.max(active.maxShoeGap,dist(pose,b.position));
    if(pair?.collisionActive)active.activePairTicks++;
    if(pair?.manifolds.some(m=>m.geometricContacts>0))active.manifoldTicks++;
    if(pair?.manifolds.some(m=>m.solverContacts>0))active.solverTicks++;
    if(pair?.rapierForceReported){
     active.forceTicks++;
     active.impulseSum+=pair.derivedNetImpulseMagnitudeNs;
    }
    if(foot.ended.includes(id)){active.releases++;active.awaitingNewStart=true;}
    if(t>active.start&&foot.started.includes(id)){
     active.newStarts++;
     if(active.awaitingNewStart){active.reacquisitions++;active.awaitingNewStart=false;}
    }
    active.samples++;active.lastTick=t;
   }else if(!m28.latestCompleted||
      m28.latestCompleted.actorId!==id||
      m28.latestCompleted.endReason===null)
    throw new TypeError('M29 refuses missing original M28 episode while active');
   const finished=m28.latestCompleted;
   if(finished?.actorId===id&&
      (finished.lastTick===t||finished.endReason==='different-genuine-shoe-start'||
       finished.endReason==='new-genuine-physical-action')){
    if(finished.observedTicks!==active.samples||
       finished.sourceDecisionTick!==active.start||
       finished.actualShoeActiveTicks<active.activePairTicks)
     throw new TypeError('M29 original native evidence must agree with completed M28');
    latestCompleted=report(active,finished.endReason);
    active=null;
   }
  }
  tick=t;
  return snapshot();
 }
 function snapshot(){
  if(tick<0)throw new TypeError('M29 has no source-tick evidence');
  return freeze({version:'m29-native-control-gate-observer-v1',
   tick,active:active?report(active):null,latestCompleted,
   readOnly:true,matchAuthority:false,verifiedControl:false,
   verifiedReception:false,verifiedInterception:false,
   verifiedTackle:false,verifiedPossession:false,
   officialPossession:false,officialMatchAction:false});
 }
 return freeze({observe,snapshot});
}
