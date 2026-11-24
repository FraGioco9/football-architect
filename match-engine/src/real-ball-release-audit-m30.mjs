// #628 M30 — real same-world post-tap shoe release/recontact audit.
// Reads original 22 player movement, Rapier solver/contact and ball trajectories.
// Does not make a football possession, reception, tackle or dribble decision.
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from './player-foot-contact-solver.mjs';
export const M30_OBSERVATION_TICKS=240;
const freeze=Object.freeze,finite=Number.isFinite;
const idList=INITIAL_PLAYERS.map(x=>x.id);
const idSet=new Set(idList);
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const round=x=>Math.round(x*10000)/10000;
const ordered=a=>Array.isArray(a)&&new Set(a).size===a.length&&a.every(
 (id,i)=>idSet.has(id)&&(i===0||idList.indexOf(a[i-1])<idList.indexOf(id)));
export function createRealBallReleaseAuditM30(){
 let tick=-1,active=null,latestCompleted=null;
 function report(s,reason=null){
  return freeze({
   version:'m30-rapier-release-recontact-audit-v1',
   actorId:s.id,team:s.team,sourceSecondShoeTick:s.start,
   observedTicks:s.samples,lastTick:s.lastTick,
   actualTapImpulseNs:round(s.impulse),
   firstTrueShoeEndTick:s.endTick,
   firstTrueSubsequentShoeStartTick:s.newStartTick,
   genuineNativeReleaseObserved:s.endTick!==null,
   genuineNativeRecontactAfterRelease:s.newStartTick!==null,
   exclusiveNativeRecontact:s.exclusive,
   realOpponentFirstShoeStartTick:s.opponentStartTick,
   nearestActualDefenderM:round(s.nearest),
   actualOpposingPressureTicks:s.pressureTicks,
   originalShoeActiveTicks:s.activeTicks,
   originalShoeManifoldTicks:s.manifoldTicks,
   originalShoeSolverTicks:s.solverTicks,
   originalShoeForceTicks:s.forceTicks,
   observedBallTravelXYM:round(s.travel),
   maxActualBallReceiverGapM:round(s.maxGap),
   lastActualBallReceiverGapM:round(s.lastGap),
   actualActionAfterTap:s.nextAction,
   endReason:reason,observationComplete:reason!==null,
   // A new START alone cannot certify deliberate ball control; source
   // race with an opponent must be resolved by future actual football rules.
   sourceVerifiedSequence:s.endTick!==null&&s.newStartTick!==null,
   readOnly:true,original22Source:true,matchAuthority:false,
   verifiedReception:false,verifiedDribble:false,verifiedControl:false,
   verifiedInterception:false,verifiedTackle:false,verifiedPossession:false,
   officialPossession:false,officialMatchAction:false
  });
 }
 function observe({physics,playerFrame,foot,solver,choice,tap,action=null}={}){
  const t=physics?.tick;
  if(!Number.isSafeInteger(t)||t!==tick+1||t<0||
     playerFrame?.tick!==t||foot?.tick!==t||
     !ordered(foot.started)||!ordered(foot.ended)||!ordered(foot.active)||
     !Array.isArray(playerFrame.players)||playerFrame.players.length!==22||
     !INITIAL_PLAYERS.every((p,i)=>{
      const q=playerFrame.players[i];return q?.id===p.id&&q.team===p.team&&
       q.role===p.role&&[q.x,q.y,q.vx,q.vy].every(finite);
     })||
     !['x','y','z'].every(k=>finite(physics.ball?.position?.[k])&&
      finite(physics.ball?.velocity?.[k]))||
     (action!==null&&(action.tick!==t||
      action.appliedByRapier!==true||action.actualPhysicsImpulseApplied!==true||
      action.officialMatchAction!==false||
      foot.started.length!==1||foot.started[0]!==action.playerId)))
   throw new TypeError('M30 requires original consecutive native Rapier player/ball frames');
  if(t===0){
   if(solver!==null||tap!==null||choice!==null)
    throw new TypeError('M30 cannot start from invented tick-zero events');
  }else if(solver?.version!==FOOT_SOLVER_EVIDENCE_VERSION||
     solver.tick!==t||!Array.isArray(solver.pairs)||
     !ordered(solver.pairs.map(x=>x.id))||
     solver.pairs.some(p=>
      p.collisionActive!==foot.active.includes(p.id)||
      p.beganThisTick!==foot.started.includes(p.id)||
      p.endedThisTick!==foot.ended.includes(p.id)||
      !Array.isArray(p.manifolds))||
     [...foot.active,...foot.started,...foot.ended].some(id=>
      !solver.pairs.some(p=>p.id===id)))
   throw new TypeError('M30 current native solver disagrees with original collision queue');
  if(tap?.tick===t){
   const id=tap.actorId,p=playerFrame.players.find(x=>x.id===id);
   const pair=solver.pairs.find(x=>x.id===id);
   if(active||latestCompleted||!['home-9','away-9'].includes(id)||
      tap.originalRapierBallBody!==true||
      tap.actualPhysicsImpulseApplied!==true||
      tap.nativeExclusiveShoeStart!==true||
      tap.officialPossession!==false||
      tap.matchAuthority!==false||
      tap.originalDecisionTick!==t||
      choice?.tick!==t||choice.actorId!==id||
      choice.decision!=='defer-clearance-to-keep-ball-near'||
      choice.physicalImpulseAllowed!==false||
      p?.team!==tap.team||foot.started.length!==1||
      foot.started[0]!==id||foot.active.length!==1||
      foot.active[0]!==id||
      pair?.beganThisTick!==true||!finite(tap.impulseMagnitudeNs)||
      tap.impulseMagnitudeNs<=0||tap.impulseMagnitudeNs>1.35+1e-8||
      action!==null)
    throw new TypeError('M30 requires real source-matched second tap without original clearance');
   active={id,team:tap.team,start:t,lastTick:t-1,impulse:tap.impulseMagnitudeNs,
    samples:0,endTick:null,newStartTick:null,exclusive:false,
    opponentStartTick:null,nearest:Infinity,pressureTicks:0,
    activeTicks:0,manifoldTicks:0,solverTicks:0,forceTicks:0,
    travel:0,lastBall:null,maxGap:0,lastGap:0,nextAction:null};
  }
  if(active){
   const s=active,id=s.id,actor=playerFrame.players.find(x=>x.id===id);
   const pair=solver.pairs.find(x=>x.id===id);
   const opponents=playerFrame.players.filter(x=>x.team!==s.team);
   if(opponents.length!==11||!actor)
    throw new TypeError('M30 lost real actor or canonical 11 defenders');
   if(s.lastBall)s.travel+=gap(s.lastBall,physics.ball.position);
   s.lastBall=freeze({...physics.ball.position});
   const d=gap(actor,physics.ball.position);
   s.lastGap=d;s.maxGap=Math.max(s.maxGap,d);
   s.nearest=Math.min(s.nearest,...opponents.map(x=>gap(x,actor)));
   if(opponents.some(x=>gap(x,actor)<=3))s.pressureTicks++;
   if(foot.active.includes(id))s.activeTicks++;
   if(pair?.manifolds.some(x=>x.geometricContacts>0))s.manifoldTicks++;
   if(pair?.manifolds.some(x=>x.solverContacts>0))s.solverTicks++;
   if(pair?.rapierForceReported)s.forceTicks++;
   if(t>s.start&&foot.ended.includes(id)&&s.endTick===null)s.endTick=t;
   if(t>s.start&&s.endTick!==null&&t>s.endTick&&
      foot.started.includes(id)&&s.newStartTick===null){
    s.newStartTick=t;
    s.exclusive=foot.started.length===1&&foot.active.length===1;
   }
   const other=foot.started.find(x=>x!==id);
   if(t>s.start&&other&&s.opponentStartTick===null)
    s.opponentStartTick=t;
   if(t>s.start&&action){
    s.nextAction=freeze({tick:t,playerId:action.playerId,action:action.action});
   }
   s.samples++;s.lastTick=t;
   const end=s.newStartTick!==null?'native-release-and-recontact':
    s.opponentStartTick!==null?'competing-native-shoe-start':
    s.nextAction!==null?'subsequent-real-physical-action':
    s.samples>=M30_OBSERVATION_TICKS?'four-second-native-window-complete':null;
   if(end){latestCompleted=report(s,end);active=null;}
  }
  tick=t;return snapshot();
 }
 function snapshot(){
  if(tick<0)throw new TypeError('M30 audit has no frame');
  return freeze({version:'m30-native-release-audit-observer-v1',tick,
   active:active?report(active):null,latestCompleted,
   original22Source:true,readOnly:true,matchAuthority:false,
   verifiedReception:false,verifiedDribble:false,verifiedControl:false,
   verifiedInterception:false,verifiedTackle:false,verifiedPossession:false,
   officialPossession:false,officialMatchAction:false});
 }
 return freeze({observe,snapshot});
}
