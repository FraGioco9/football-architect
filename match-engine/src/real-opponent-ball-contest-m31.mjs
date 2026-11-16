// #628 M31 — read-only physical contested ball race after M30 research tap.
// Only a true original Rapier shoe START is an opponent contact. Distance is
// pressure context, NEVER evidence of tackle, interception or ball ownership.
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from './player-foot-contact-solver.mjs';
export const M31_CONTEST_TICKS=240;
const freeze=Object.freeze,finite=Number.isFinite;
const all=INITIAL_PLAYERS.map(p=>p.id);
const known=new Set(all);
const ordered=a=>Array.isArray(a)&&new Set(a).size===a.length&&a.every(
 (x,i)=>known.has(x)&&(i===0||all.indexOf(a[i-1])<all.indexOf(x)));
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rounded=x=>x===null?null:Math.round(x*1e4)/1e4;
export function createRealOpponentBallContestAuditM31(){
 let tick=-1,active=null,completed=null;
 function report(s,endReason=null){
  return freeze({
   version:'m31-original-rapier-opponent-ball-contest-v1',
   actorId:s.actor,team:s.team,sourceTapTick:s.start,
   observedTicks:s.samples,lastTick:s.lastTick,
   receiverOriginalSecondShoeStart:true,
   realTapMagnitudeNs:rounded(s.tap),
   firstReceiverNativeEndTick:s.release,
   firstReceiverIndependentNativeRecontactTick:s.receiverRecontact,
   firstOpposingNativeShoeStartTick:s.opponentContact?.tick??null,
   firstOpposingNativeShoeStartPlayerId:s.opponentContact?.id??null,
   firstOpposingNativeShoeStartWithSolverManifold:
    s.opponentContact?.manifold??false,
   firstOpposingNativeShoeStartWithForce:
    s.opponentContact?.force??false,
   opponentContactBeforeReceiverRecontact:s.opponentContact!==null&&
    (s.receiverRecontact===null||s.opponentContact.tick<s.receiverRecontact),
   opposingShoeContactIsNative:s.opponentContact!==null,
   realReceiverNativeShoeActiveTicks:s.receiverActive,
   realOpponentNativeShoeActiveTicks:s.opponentActive,
   realOpponentForceTicks:s.opponentForce,
   measuredOpponentWithin3MTicks:s.within3,
   measuredOpponentWithin2MTicks:s.within2,
   minimumRealOpponentToBallGapM:rounded(s.minOppBall),
   minimumRealOpponentToReceiverGapM:rounded(s.minOppReceiver),
   measuredBallTravelXYM:rounded(s.travel),
   receiverNextRealAction:s.nextAction,
   firstOtherSameTeamShoeStartTick:s.otherTeammate,
   observationComplete:endReason!==null,endReason,
   classification:s.opponentContact?
    'genuine-opposing-rapier-shoe-ball-start':
    s.receiverRecontact?'genuine-receiver-recontact-without-opponent-start':
    s.release?'native-ball-release-no-independent-recontact':
    'original-contact-still-active',
   original22Source:true,readOnly:true,matchAuthority:false,
   verifiedControl:false,verifiedDribble:false,verifiedReception:false,
   verifiedInterception:false,verifiedTackle:false,
   verifiedPossession:false,officialPossession:false,
   officialMatchAction:false
  });
 }
 function observe({physics,playerFrame,foot,solver,tap=null,
  m30=null,action=null}={}){
  const t=physics?.tick;
  if(!Number.isSafeInteger(t)||t!==tick+1||t<0||
     foot?.tick!==t||playerFrame?.tick!==t||
     !ordered(foot.started)||!ordered(foot.active)||!ordered(foot.ended)||
     !Array.isArray(playerFrame.players)||playerFrame.players.length!==22||
     !INITIAL_PLAYERS.every((p,i)=>{
      const q=playerFrame.players[i];
      return q?.id===p.id&&q.team===p.team&&q.role===p.role&&
       [q.x,q.y,q.vx,q.vy].every(finite);
     })||
     !['x','y','z'].every(k=>finite(physics.ball?.position?.[k])&&
      finite(physics.ball?.velocity?.[k]))||
     m30?.tick!==t||m30.readOnly!==true||
     m30.matchAuthority!==false||m30.verifiedPossession!==false||
     (action!==null&&(action.tick!==t||
      action.appliedByRapier!==true||
      action.actualPhysicsImpulseApplied!==true||
      action.officialMatchAction!==false||
      foot.started.length!==1||foot.started[0]!==action.playerId)))
   throw new TypeError('M31 needs consecutive canonical same-world 22-player Rapier frames');
  if(t===0){
   if(solver!==null||m30.active!==null||m30.latestCompleted!==null||tap!==null)
    throw new TypeError('M31 cannot create a tick-zero source');
  }else{
   if(solver?.version!==FOOT_SOLVER_EVIDENCE_VERSION||
      solver.tick!==t||!ordered(solver.pairs?.map(p=>p.id))||
      solver.pairs.some(p=>p.collisionActive!==foot.active.includes(p.id)||
       p.beganThisTick!==foot.started.includes(p.id)||
       p.endedThisTick!==foot.ended.includes(p.id)||
       !Array.isArray(p.manifolds))||
      [...foot.started,...foot.ended,...foot.active].some(id=>
       !solver.pairs.some(p=>p.id===id)))
    throw new TypeError('M31 refuses inconsistent native Rapier solver source');
  }
  if(tap?.tick===t){
   const id=tap.actorId,pair=solver.pairs.find(p=>p.id===id);
   if(active||completed||!['home-9','away-9'].includes(id)||
      tap.originalRapierBallBody!==true||
      tap.actualPhysicsImpulseApplied!==true||
      tap.nativeExclusiveShoeStart!==true||
      tap.originalDecisionTick!==t||
      tap.officialMatchAction!==false||
      tap.matchAuthority!==false||tap.officialPossession!==false||
      !finite(tap.impulseMagnitudeNs)||
      tap.impulseMagnitudeNs<=0||tap.impulseMagnitudeNs>1.35+1e-8||
      m30.active?.sourceSecondShoeTick!==t||
      m30.active.actorId!==id||
      pair?.beganThisTick!==true||foot.started.length!==1||
      foot.started[0]!==id||foot.active.length!==1||
      foot.active[0]!==id||action!==null)
    throw new TypeError('M31 can only start from same-tick genuine M30 physical tap');
   active={actor:id,team:tap.team,start:t,tap:tap.impulseMagnitudeNs,
    samples:0,lastTick:t-1,release:null,receiverRecontact:null,
    opponentContact:null,otherTeammate:null,
    receiverActive:0,opponentActive:0,opponentForce:0,
    within3:0,within2:0,minOppBall:Infinity,minOppReceiver:Infinity,
    travel:0,previous:null,nextAction:null};
  }
  if(active){
   const s=active,receiver=playerFrame.players.find(p=>p.id===s.actor);
   const opposition=playerFrame.players.filter(p=>p.team!==s.team);
   if(!receiver||opposition.length!==11)
    throw new TypeError('M31 lost original actor or live opponents');
   const position=physics.ball.position;
   if(s.previous)s.travel+=d(position,s.previous);
   s.previous=freeze({...position});
   const minBall=Math.min(...opposition.map(p=>d(p,position)));
   const minReceiver=Math.min(...opposition.map(p=>d(p,receiver)));
   if(!finite(minBall)||!finite(minReceiver))
    throw new TypeError('M31 requires current real defender geometry');
   s.minOppBall=Math.min(s.minOppBall,minBall);
   s.minOppReceiver=Math.min(s.minOppReceiver,minReceiver);
   if(minReceiver<=3)s.within3++;
   if(minReceiver<=2)s.within2++;
   if(foot.active.includes(s.actor))s.receiverActive++;
   const opponentPairs=solver.pairs.filter(p=>
    p.id.startsWith(s.team==='home'?'away-':'home-'));
   if(opponentPairs.some(p=>p.collisionActive))s.opponentActive++;
   if(opponentPairs.some(p=>p.rapierForceReported))s.opponentForce++;
   if(t>s.start&&s.release===null&&foot.ended.includes(s.actor))
    s.release=t;
   if(t>s.start&&s.release!==null&&t>s.release&&
      s.receiverRecontact===null&&foot.started.includes(s.actor))
    s.receiverRecontact=t;
   if(t>s.start&&!s.opponentContact){
    const other=foot.started.find(id=>id.startsWith(
     s.team==='home'?'away-':'home-'));
    if(other){
     const pair=solver.pairs.find(p=>p.id===other);
     if(!pair?.beganThisTick)
      throw new TypeError('M31 opposing native START missing solver pair');
     s.opponentContact=freeze({tick:t,id:other,
      manifold:pair.manifolds.some(m=>m.geometricContacts>0||m.solverContacts>0),
      force:pair.rapierForceReported});
    }
   }
   if(t>s.start&&s.otherTeammate===null&&foot.started.some(id=>
    id!==s.actor&&id.startsWith(s.team+'-')))
    s.otherTeammate=t;
   if(t>s.start&&action&&!s.nextAction)
    s.nextAction=freeze({tick:t,playerId:action.playerId,
     action:action.action,actualPhysicsImpulseApplied:true});
   s.samples++;s.lastTick=t;
   // Never miss later genuine defensive events after the receiver's
   // original clearance: hold the 4-second fixed native window open.
   if(s.samples===M31_CONTEST_TICKS){
    completed=report(s,'four-second-native-contest-window-complete');
    active=null;
   }
  }
  tick=t;return snapshot();
 }
 function snapshot(){
  if(tick<0)throw new TypeError('M31 source observer not started');
  return freeze({version:'m31-native-opponent-contest-observer-v1',
   tick,active:active?report(active):null,latestCompleted:completed,
   readOnly:true,original22Source:true,matchAuthority:false,
   verifiedControl:false,verifiedDribble:false,verifiedReception:false,
   verifiedInterception:false,verifiedTackle:false,
   verifiedPossession:false,officialPossession:false,
   officialMatchAction:false});
 }
 return freeze({observe,snapshot});
}
