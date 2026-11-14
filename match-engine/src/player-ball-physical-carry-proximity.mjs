// C3.3a — MEASURE-ONLY 60Hz same-actor ball proximity between real carry shoe events.
// Never declares possession, dribble, football control or official scoring.
// Feed and snapshots arrive exclusively from the closed same-world Rapier fixture.
export const CARRY_PROXIMITY_VERSION='me-pb-c3-3a-closed-rapier-proximity-window-v1';
export const PROXIMITY_MEASURE_RADIUS_M=1.25; // diagnostic radius, NOT control law
export const PROXIMITY_LATERAL_BAND_M=0.75; // diagnostic offset, NOT a gameplay rule
export const PROXIMITY_INTERRUPTION_REASONS=Object.freeze([
 'opponent-shoe','teammate-shoe','ambiguous-shoes',
 'expired','unverified-second-start'
]);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point3=p=>Object.freeze({x:p.x,y:p.y,z:p.z});
const point2=p=>Object.freeze({x:p.x,y:p.y});
const dist2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const dist3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const bad=()=>{throw new TypeError('Closed same-tick real Rapier carry proximity evidence required')};
const actorId=id=>/^(home|away)-(?:[1-9]|10|11)$/.test(id);
const frozen=x=>Object.freeze(x);
export function createPhysicalCarryProximityObserver(fixtureId){
 if(typeof fixtureId!=='string'||!fixtureId)bad();
 let nextTick=0,pending=null,measuredWindows=0,interruptedWindows=0;
 let latestMeasuredWindow=null,latestInterruptedWindow=null;
 const reasonCounts=Object.fromEntries(
  PROXIMITY_INTERRUPTION_REASONS.map(k=>[k,0]));
 const sample=(actor,ball,team)=>{
  const gap=dist2(actor,ball);
  const goalward=(team==='home'?1:-1)*(ball.x-actor.x);
  return Object.freeze({gap,ballBehindActor:goalward<0,
   lateralSeparated:Math.abs(ball.y-actor.y)>PROXIMITY_LATERAL_BAND_M,
   outsideNearBand:gap>PROXIMITY_MEASURE_RADIUS_M});
 };
 const interrupt=(prior,reason,tick,otherIds=[])=>{
  if(!PROXIMITY_INTERRUPTION_REASONS.includes(reason))bad();
  interruptedWindows++;reasonCounts[reason]++;
  latestInterruptedWindow=frozen({
   engineId:prior.engineId,team:prior.team,
   firstShoeTick:prior.firstShoeTick,
   observedThroughTick:tick,
   sampledFrames:prior.sampledFrames,
   realShoeEndTick:prior.realShoeEndTick,
   reason,otherPhysicalShoeIds:frozen([...new Set(otherIds)].sort()),
   measuredBallPath3DM:prior.measuredBallPath3DM,
   measuredActorPathM:prior.measuredActorPathM,
   nearFrameFraction:prior.nearFrames/prior.sampledFrames,
   farFrames:prior.farFrames,maxConsecutiveFarFrames:prior.maxFarStreak,
   ballBehindActorFrames:prior.ballBehindActorFrames,
   lateralSeparatedFrames:prior.lateralSeparatedFrames,
   realRapierInterruptionObserved:
    ['opponent-shoe','teammate-shoe','ambiguous-shoes'].includes(reason),
   ballControlConfirmed:null,dribbleConfirmed:null,
   officialMatchPossession:false,officialMatchResult:null
  });
  pending=null;
 };
 function observe({physicsTick,ballSnapshot,physicalPlayerPositions,
  physicalContactFeed,localAutonomousAction,physicalCarryContactSequence}){
  const feed=physicalContactFeed,point=ballSnapshot?.ball?.position;
  const players=physicalPlayerPositions,seq=physicalCarryContactSequence;
  if(physicsTick!==nextTick||!Number.isSafeInteger(physicsTick)||
     ballSnapshot?.tick!==physicsTick||!point||
     !['x','y','z'].every(k=>finite(point[k]))||
     !Array.isArray(players)||players.length!==22||
     !Object.isFrozen(players)||players.some(p=>
      !Object.isFrozen(p)||!actorId(p.engineId)||
      p.team!==p.engineId.split('-')[0]||!finite(p.x)||!finite(p.y))||
     new Set(players.map(p=>p.engineId)).size!==22||
     feed?.physicsTick!==physicsTick||feed.fixtureId!==fixtureId||
     feed.realFootEventsOnly!==true||
     feed.contactSource!=='same-step-real-rapier-shoe-ball-collider'||
     !Array.isArray(feed.started)||!Array.isArray(feed.active)||
     !Array.isArray(feed.ended)||feed.officialMatchPossession!==false||
     seq?.physicsTick!==physicsTick||seq.fixtureId!==fixtureId||
     seq.readOnly!==true||seq.dribbleConfirmed!==null||
     !Number.isSafeInteger(seq.verifiedGroundCarryRecontacts)||
     (localAutonomousAction!==null&&
       (localAutonomousAction?.tick!==physicsTick||
        localAutonomousAction.appliedByRapier!==true||
        localAutonomousAction.actualPhysicsImpulseApplied!==true)))
    bad();
  const position=id=>players.find(p=>p.engineId===id);
  // A shorter distance is evidence of proximity, never of football possession.
  if(pending){
   const prior=pending,actor=position(prior.engineId);
   if(!actor)bad();
   const relative=sample(actor,point,prior.team),gap=relative.gap;
   const farStreak=relative.outsideNearBand?prior.farStreak+1:0;
   const current=frozen({...prior,
    throughTick:physicsTick,sampledFrames:prior.sampledFrames+1,
    nearFrames:prior.nearFrames+(gap<=PROXIMITY_MEASURE_RADIUS_M?1:0),
    gapSumM:prior.gapSumM+gap,minGapM:Math.min(prior.minGapM,gap),
    maxGapM:Math.max(prior.maxGapM,gap),
    farFrames:prior.farFrames+(relative.outsideNearBand?1:0),
    farStreak,maxFarStreak:Math.max(prior.maxFarStreak,farStreak),
    ballBehindActorFrames:prior.ballBehindActorFrames+
     (relative.ballBehindActor?1:0),
    lateralSeparatedFrames:prior.lateralSeparatedFrames+
     (relative.lateralSeparated?1:0),
    measuredActorPathM:prior.measuredActorPathM+
      dist2(prior.previousActorPosition,actor),
    measuredBallPath3DM:prior.measuredBallPath3DM+
      dist3(prior.previousBallPosition,point),
    previousActorPosition:point2(actor),previousBallPosition:point3(point),
    realShoeEndTick:feed.ended.some(p=>p.engineId===prior.engineId)?
      physicsTick:prior.realShoeEndTick});
   // Any other START or concurrent shoe ACTIVE invalidates an uninterrupted
   // single-actor window. Do not bridge teammate/opponent touches.
   const otherShoes=[...feed.started,...feed.active].filter(p=>
    p.engineId!==prior.engineId);
   const hasOpponent=otherShoes.some(p=>p.team!==prior.team);
   const hasTeammate=otherShoes.some(p=>p.team===prior.team);
   const ambiguous=feed.multipleActive||feed.started.length>1;
   const intervening=otherShoes.length>0||ambiguous;
   const expired=physicsTick-prior.firstShoeTick>150;
   const newSameShoeStart=feed.started.some(p=>
    p.engineId===prior.engineId&&physicsTick>prior.firstShoeTick);
   if(intervening){
    const reason=ambiguous?'ambiguous-shoes':
     hasOpponent?'opponent-shoe':hasTeammate?'teammate-shoe':'ambiguous-shoes';
    interrupt(current,reason,physicsTick,otherShoes.map(p=>p.engineId));
   }else if(expired){
    interrupt(current,'expired',physicsTick);
   }else if(newSameShoeStart){
    const witness=seq.latestVerifiedGroundCarryRecontact;
    if(witness?.engineId===prior.engineId&&
       witness.team===prior.team&&
       witness.firstShoeTick===prior.firstShoeTick&&
       witness.secondShoeTick===physicsTick&&
       prior.realShoeEndTick!==null&&
       prior.firstShoeTick<prior.realShoeEndTick&&
       prior.realShoeEndTick<physicsTick&&
       witness.shoeEndTick===prior.realShoeEndTick&&
       witness.measuredAttackingProgressM>=0.2&&
       witness.secondRealBoundedCarryImpulseApplied===true&&
       current.sampledFrames>=2){
     measuredWindows++;
     latestMeasuredWindow=frozen({
      engineId:prior.engineId,team:prior.team,
      firstShoeTick:prior.firstShoeTick,
      shoeEndTick:prior.realShoeEndTick,
      secondShoeTick:physicsTick,
      sampledFrames:current.sampledFrames,
      nearFrames:current.nearFrames,
      nearFrameFraction:current.nearFrames/current.sampledFrames,
      diagnosticRadiusM:PROXIMITY_MEASURE_RADIUS_M,
      averageGapM:current.gapSumM/current.sampledFrames,
      minGapM:current.minGapM,maxGapM:current.maxGapM,
      farFrames:current.farFrames,
      maxConsecutiveFarFrames:current.maxFarStreak,
      ballBehindActorFrames:current.ballBehindActorFrames,
      lateralSeparatedFrames:current.lateralSeparatedFrames,
      lateralDiagnosticBandM:PROXIMITY_LATERAL_BAND_M,
      measuredActorPathM:current.measuredActorPathM,
      measuredBallPath3DM:current.measuredBallPath3DM,
      measuredAttackingProgressM:witness.measuredAttackingProgressM,
      sameActorGenuineContactPair:true,
      physicalRapierProofOnly:true,
      ballAttached:false,ballControlConfirmed:null,
      dribbleConfirmed:null,officialMatchPossession:false,
      officialMatchResult:null
     });
    }else interrupt(current,'unverified-second-start',physicsTick);
    if(pending!==null)pending=null;
   }else pending=current;
  }
  // New real carry starts a new window, including after a valid second touch.
  const action=localAutonomousAction;
  if(action?.action==='carry'){
   if(feed.started.length!==1||feed.active.length!==1||
      feed.started[0].engineId!==action.playerId||
      feed.active[0].engineId!==action.playerId||
      seq.authenticatedCarryImpulses<1)bad();
   const actor=position(action.playerId);
   if(!actor||actor.team!==action.team)bad();
   const relative=sample(actor,point,action.team),gap=relative.gap;
   pending=frozen({
    engineId:action.playerId,team:action.team,
    firstShoeTick:physicsTick,throughTick:physicsTick,
    realShoeEndTick:null,
    sampledFrames:1,nearFrames:gap<=PROXIMITY_MEASURE_RADIUS_M?1:0,
    gapSumM:gap,minGapM:gap,maxGapM:gap,
    farFrames:relative.outsideNearBand?1:0,
    farStreak:relative.outsideNearBand?1:0,
    maxFarStreak:relative.outsideNearBand?1:0,
    ballBehindActorFrames:relative.ballBehindActor?1:0,
    lateralSeparatedFrames:relative.lateralSeparated?1:0,
    measuredActorPathM:0,measuredBallPath3DM:0,
    previousActorPosition:point2(actor),
    previousBallPosition:point3(point)
   });
  }
  nextTick++;
  return frozen({
   version:CARRY_PROXIMITY_VERSION,fixtureId,physicsTick,
   source:'closed-physical-60hz-actor-ball-distance',
   measurementRadiusM:PROXIMITY_MEASURE_RADIUS_M,
   measuredWindows,interruptedWindows,latestMeasuredWindow,
   latestInterruptedWindow,
   interruptionReasons:frozen({...reasonCounts}),
   lateralDiagnosticBandM:PROXIMITY_LATERAL_BAND_M,
   activeMeasurement:pending?frozen({
    engineId:pending.engineId,team:pending.team,
    firstShoeTick:pending.firstShoeTick,
    sampledFrames:pending.sampledFrames,nearFrames:pending.nearFrames,
    minGapM:pending.minGapM,maxGapM:pending.maxGapM,
    farFrames:pending.farFrames,
    ballBehindActorFrames:pending.ballBehindActorFrames,
    lateralSeparatedFrames:pending.lateralSeparatedFrames,
    realShoeEndTick:pending.realShoeEndTick
   }):null,
   readOnly:true,proximityIsNotPossession:true,
   ballControlConfirmed:null,dribbleConfirmed:null,
   officialMatchPossession:false,officialMatchResult:null
  });
 }
 return frozen({observe});
}
