// Match Physics V1 C3.1 — authentic real shoe START succession audit.
// READ-ONLY: no player/ball steering, artificial shoe, dribble claim or score.
// Always consume the private closed Rapier fixture feed, never API/user events.
export const PHYSICAL_CARRY_SEQUENCE_VERSION=
 'me-pb-c3-1-readonly-real-shoe-succession-v1';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const copy3=p=>Object.freeze({x:p.x,y:p.y,z:p.z});
const dist3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const validActor=a=>a&&typeof a.engineId==='string'&&
 /^(home|away)-(?:[1-9]|10|11)$/.test(a.engineId)&&
 a.team===a.engineId.split('-')[0]&&typeof a.clubId==='string'&&
 a.temporary===true&&a.playerId===null;
const fail=()=>{throw new TypeError(
 'Consecutive authentic 60Hz Rapier shoe/ball evidence required'
);};

export function createPhysicalCarryContactSequenceObserver(fixtureId){
 if(typeof fixtureId!=='string'||!fixtureId)fail();
 let nextTick=0,lastBall=null,lastShoe=null;
 let distanceSinceLastShoeM=0,shoeStartCount=0,
  sameTeamPairs=0,samePlayerRecontacts=0,opponentPairs=0,
  measuredForwardPairs=0,ambiguousStarts=0,latestPair=null,
  authenticatedCarryImpulses=0,
  verifiedGroundCarryRecontacts=0,
  latestVerifiedGroundCarryRecontact=null,
  pendingCarry=null,interruptedCarryAttempts=0;
 function observe({physicsTick,ballSnapshot,physicalContactFeed,
   localAutonomousAction}){
  const feed=physicalContactFeed,point=ballSnapshot?.ball?.position;
  const velocity=ballSnapshot?.ball?.velocity;
  if(!Number.isSafeInteger(physicsTick)||physicsTick!==nextTick||
     ballSnapshot?.tick!==physicsTick||
     !point||!velocity||
     !['x','y','z'].every(k=>finite(point[k])&&finite(velocity[k]))||
     feed?.physicsTick!==physicsTick||feed.fixtureId!==fixtureId||
     feed.realFootEventsOnly!==true||
     feed.contactSource!=='same-step-real-rapier-shoe-ball-collider'||
     feed.officialMatchAction!==false||
     feed.officialMatchPossession!==false||
     !Array.isArray(feed.started)||!Array.isArray(feed.active)||
     !Array.isArray(feed.ended)||typeof feed.multipleActive!=='boolean'||
     feed.multipleActive!==(feed.active.length>1)||
     feed.started.some(a=>!validActor(a))||
     feed.active.some(a=>!validActor(a))||
     feed.ended.some(a=>!validActor(a))||
     (physicsTick===0&&(feed.started.length||feed.active.length||
       feed.ended.length||localAutonomousAction!==null)))
   fail();
  const ids=feed.started.map(a=>a.engineId);
  if(new Set(ids).size!==ids.length)fail();
  if(localAutonomousAction!==null&&(
      !localAutonomousAction||
      localAutonomousAction.tick!==physicsTick||
      !['pass','shot','clearance','carry'].includes(localAutonomousAction.action)||
      feed.started.length!==1||feed.active.length!==1||
      feed.started[0].engineId!==localAutonomousAction.playerId||
      feed.active[0].engineId!==localAutonomousAction.playerId||
      feed.started[0].team!==localAutonomousAction.team||
      localAutonomousAction.appliedByRapier!==true||
      localAutonomousAction.actualPhysicsImpulseApplied!==true||
      localAutonomousAction.physicalTrigger!==
       'same-tick-real-rapier-shoe-start'||
      localAutonomousAction.officialMatchAction!==false||
      (localAutonomousAction.action==='carry'&&(
       localAutonomousAction.carryTarget?.actorId!==
         localAutonomousAction.playerId||
       localAutonomousAction.carryTarget?.physicsTick!==physicsTick||
       localAutonomousAction.carryTarget?.team!==
         localAutonomousAction.team||
       localAutonomousAction.carryTarget?.shortGroundTouchOnly!==true||
       localAutonomousAction.carryTarget?.physicalRecontactObserved!==false||
       localAutonomousAction.carryTarget?.dribbleConfirmed!==null||
       !['x','y','z'].every(k=>
         finite(localAutonomousAction.impulseNs?.[k]))||
       Math.abs(Math.hypot(
        localAutonomousAction.impulseNs.x,
        localAutonomousAction.impulseNs.y,
        localAutonomousAction.impulseNs.z)-0.42)>1e-7))))
   fail();
  // Count only actual consecutive measured ball-centre displacements.
  if(lastBall)distanceSinceLastShoeM+=dist3(lastBall,point);
  // C3.2b: a continuous ACTIVE or tactical pursuit is not a second START.
  // Only a second isolated Rapier START after a real shoe END and 0.2m
  // of observed forward BALL displacement can be reported.
  if(pendingCarry){
   const prior=pendingCarry;
   if(physicsTick-prior.firstShoeTick>150||
      feed.multipleActive||feed.started.length>1){
    pendingCarry=null;interruptedCarryAttempts++;
   }else{
    if(feed.ended.some(actor=>actor.engineId===prior.engineId))
     pendingCarry=Object.freeze({...prior,shoeEndTick:physicsTick});
    if(feed.started.length===1&&physicsTick>prior.firstShoeTick){
     const next=feed.started[0];
     const advance=(prior.team==='home'?1:-1)*
      (point.x-prior.firstBallPosition.x);
     if(next.engineId===prior.engineId&&
        localAutonomousAction?.action==='carry'&&
        localAutonomousAction.playerId===prior.engineId&&
        localAutonomousAction.appliedByRapier===true&&
        localAutonomousAction.actualPhysicsImpulseApplied===true&&
        prior.shoeEndTick!==null&&prior.shoeEndTick<physicsTick&&
        feed.active.length===1&&advance>=0.2&&
        distanceSinceLastShoeM>=0.2){
      verifiedGroundCarryRecontacts++;
      latestVerifiedGroundCarryRecontact=Object.freeze({
       engineId:prior.engineId,team:prior.team,
       firstShoeTick:prior.firstShoeTick,
       shoeEndTick:prior.shoeEndTick,
       secondShoeTick:physicsTick,
       firstBallPosition:prior.firstBallPosition,
       secondBallPosition:copy3(point),
       measuredBallPath3DM:distanceSinceLastShoeM,
       measuredAttackingProgressM:advance,
       realFirstAndSecondRapierStarts:true,
       physicalShoeEndBetween:true,
       secondRealBoundedCarryImpulseApplied:true,
       secondCarryImpulseNs:Object.freeze({...localAutonomousAction.impulseNs}),
       dribbleConfirmed:null,officialMatchResult:null
      });
     }else interruptedCarryAttempts++;
     pendingCarry=null;
    }
   }
  }
  if(localAutonomousAction?.action==='carry'){
   authenticatedCarryImpulses++;
   pendingCarry=Object.freeze({
    engineId:localAutonomousAction.playerId,
    team:localAutonomousAction.team,firstShoeTick:physicsTick,
    firstBallPosition:copy3(point),shoeEndTick:null
   });
  }
  if(feed.started.length>0){
   shoeStartCount+=feed.started.length;
   // Contested feet invalidate continuity; no contested episode can
   // accidentally be counted as a clean carry or individual recontact.
   if(feed.started.length!==1||feed.active.length!==1||
      feed.multipleActive){
    ambiguousStarts++;
    lastShoe=null;
    distanceSinceLastShoeM=0;
   }else{
    const foot=feed.started[0],newShoe=Object.freeze({
     physicsTick,engineId:foot.engineId,team:foot.team,
     ballPosition:copy3(point),
     action:localAutonomousAction?.action??null,
     actualPhysicsImpulseApplied:localAutonomousAction!==null
    });
    if(lastShoe){
     const elapsed=physicsTick-lastShoe.physicsTick;
     if(elapsed<=0)fail();
     const sameTeam=foot.team===lastShoe.team;
     const samePlayer=foot.engineId===lastShoe.engineId;
     const forward=lastShoe.team==='home'?1:-1;
     const netForwardM=forward*(point.x-lastShoe.ballPosition.x);
     if(sameTeam)sameTeamPairs++;
     else opponentPairs++;
     if(samePlayer)samePlayerRecontacts++;
     if(sameTeam&&netForwardM>0)measuredForwardPairs++;
     latestPair=Object.freeze({
      from:lastShoe,to:newShoe,
      elapsedPhysicsTicks:elapsed,
      totalMeasuredBallPath3DM:distanceSinceLastShoeM,
      netBallTravel3DM:dist3(lastShoe.ballPosition,point),
      ballNetAttackingDirectionM:netForwardM,
      sameTeam,samePlayerPhysicalRecontact:samePlayer,
      opponentTouch:sameTeam===false,
      priorShoeContactWasReal:true,laterShoeContactWasReal:true,
      physicalDisplacementObserved:distanceSinceLastShoeM>0,
      dribbleConfirmed:null,ballControlConfirmed:null,
      officialMatchPossession:false,officialMatchResult:null
     });
    }
    lastShoe=newShoe;
    distanceSinceLastShoeM=0;
   }
  }else if(feed.active.length>1){
   // A new overlapping opponent contact is not a clean carry episode.
   lastShoe=null;
   distanceSinceLastShoeM=0;
  }
  lastBall=copy3(point);
  nextTick++;
  return Object.freeze({
   version:PHYSICAL_CARRY_SEQUENCE_VERSION,
   fixtureId,physicsTick,source:'closed-real-rapier-60hz-shoe-feed',
   shoeStartCount,authenticatedCarryImpulses,
   verifiedGroundCarryRecontacts,latestVerifiedGroundCarryRecontact,
   interruptedCarryAttempts,
   sameTeamPairs,samePlayerRecontacts,
   opponentPairs,measuredForwardPairs,ambiguousStarts,
   latestPair,latestShoe:lastShoe,
   readOnly:true,physicalContactEvidenceOnly:true,
   carryConfirmed:null,dribbleConfirmed:null,
   inferredFootballEvent:false,officialMatchAction:false,
   officialMatchPossession:false,officialMatchResult:null
  });
 }
 return Object.freeze({observe});
}
