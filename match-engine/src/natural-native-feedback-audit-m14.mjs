// #628 M14 — reproducible NATURAL 22-player, one-Rapier-World
// mixed shoe/body event + canonical feedback stress audit.
// Never stage players, fabricate simultaneous body pairs, change collider
// radii, award match actions or switch on fixture result authority.
import {createEngine,FIXED_DT} from './core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_VERSION,
 PLAYER_MAX_SPEED_MPS,PLAYER_MIN_SEPARATION_M,PLAYER_PITCH,
 PLAYER_RADIUS_M} from './player-movement.mjs';
import {M11_BALL_STARTS} from './unstaged-body-contact-audit.mjs';

const frozen=o=>Object.freeze(o);
const allBallStates=new Map(M11_BALL_STARTS.map(x=>[x.id,x]));
const MAX_TICKS=240;
const modes=frozen(['feedback','observe']);
const sides=frozen(['home','away']);
const physicalOptions=frozen({
 diagnosticPlayerBodyCollidersEnabled:true,
 diagnosticPlayerFootContactsEnabled:true,
 diagnosticSharedContactEventsEnabled:true
});

function verify22(before,after,source,tick){
 if(before.tick!==tick-1||after.tick!==tick||
    after.version!==PLAYER_VERSION||after.players?.length!==22||
    before.players?.length!==22||source?.physicalActors?.length!==22)
  throw new Error('M14 requires exact ordered original 60Hz 22-player frames');
 let minGapM=Infinity,maxSpeedMps=0;
 for(let i=0;i<22;i++){
  const p=after.players[i],prior=before.players[i],real=source.physicalActors[i];
  if(!p||!prior||!real||p.id!==INITIAL_PLAYERS[i].id||
     p.team!==INITIAL_PLAYERS[i].team||prior.id!==p.id||
     real.id!==p.id||real.team!==p.team||
     ![p.x,p.y,p.vx,p.vy,p.facingRad].every(Number.isFinite)||
     Math.abs(p.x)>PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M+1e-7||
     Math.abs(p.y)>PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M+1e-7||
     Math.hypot(p.x-prior.x,p.y-prior.y)>
      PLAYER_MAX_SPEED_MPS*FIXED_DT+1e-7)
   throw new Error('M14 cannot change original 22 IDs, pitch or 7m/s motion bound');
  const speed=Math.hypot(p.vx,p.vy);
  if(speed>PLAYER_MAX_SPEED_MPS+1e-7)
   throw new Error('M14 canonical speed guard violated');
  maxSpeedMps=Math.max(maxSpeedMps,speed);
  for(let j=i+1;j<22;j++){
   const q=after.players[j];
   minGapM=Math.min(minGapM,Math.hypot(p.x-q.x,p.y-q.y));
  }
 }
 if(minGapM<PLAYER_MIN_SEPARATION_M-1e-8)
  throw new Error('M14 original full 22-player 0.98m separation violated');
 return {minGapM,maxSpeedMps};
}

function validateLineMovement(after){
 if(!after.shape||!after.pressers||
    !Object.hasOwn(after,'supports')||
    !Object.hasOwn(after,'originalOpposingPressConvergence'))
  throw new Error('M14 original player pressure/lines/support source lost');
 for(const team of sides){
  const x=after.shape[team],presser=after.pressers[team];
  // At distant ball territories the ORIGINAL autonomous presser can be
  // null. That is a measured non-assignment, never invent one for QA.
  const expectedSupporters=presser===null?10:9;
  if(!x||x.supporters!==expectedSupporters||
     ![x.widthM,x.depthM,x.defenderLineX,x.midfieldLineX,
       x.forwardLineX].every(Number.isFinite)||
     x.widthM<=0||x.depthM<=0||
     (presser!==null&&(
      typeof presser!=='string'||!after.players.some(p=>
       p.id===presser&&p.team===team&&p.role!=='goalkeeper'))))
   throw new Error('M14 original source-grounded lines/presser invalid for '+team+
    ': '+JSON.stringify({supporters:x?.supporters,
      presser,expectedSupporters}));
 }
}

// Investigates the *original* source world in a fixed ball territory. A
// genuine contact count of zero is a valid negative observation, not an
// excuse to inject artificial collisions. All body feedback is M13-only.
export function auditNaturalNativeFeedback(RAPIER,{
 stateId='centre',side='home',ticks=225,mode='feedback'
}={}){
 if(!RAPIER||typeof RAPIER.World!=='function'||
    !allBallStates.has(stateId)||!sides.includes(side)||
    !modes.includes(mode)||!Number.isSafeInteger(ticks)||
    ticks<1||ticks>MAX_TICKS)
  throw new TypeError('M14 requires bounded original Rapier source state/mode');
 const source=allBallStates.get(stateId);
 const scene=frozen({preset:'roll',
  seed:'m14-original-'+stateId+'-'+side,
  x:side==='home'?source.x:-source.x,y:source.y,
  z:0,vx:0,vy:0,vz:0});
 const feedback=mode==='feedback';
 const engine=createEngine(RAPIER,scene,{
  ...physicalOptions,
  ...(feedback?{diagnosticUnstagedBodyFeedbackEnabled:true}:{})
 });
 const mover=createPlayerMovement(feedback?{
  researchOpposingPressConvergence:true,
  researchUnstagedNativeBodyFeedback:true
 }:{researchOpposingPressConvergence:true});
 let totalNativeBodyStarts=0,totalNativeBodyEnds=0;
 let totalNativeShoeStarts=0,actualResponses=0,actualRejectedResponses=0;
 let firstNativeBodyStart=null,firstAppliedFeedback=null;
 let minCanonicalGapM=Infinity,maxCanonicalSpeedMps=0;
 let maxSimultaneousBodyPairs=0,maxBodyStartsSingleTick=0;
 let pressureTicks=0,supportTicks=0,realConcurrentBodyAndShoeTicks=0;
 let actualBallConvergenceTicks=0,fullShapeTicks=0;
 const actualBodyPairs=new Set(),actualReasons=new Map();
 let latestShape=null,latestPressers=null,latestSupports=null;
 try{
  const initial=mover.snapshot();
  if(!initial.players.every((p,i)=>p.id===INITIAL_PLAYERS[i].id&&
     p.team===INITIAL_PLAYERS[i].team))
   throw new Error('M14 original initial 22-player lineup is mandatory');
  for(let tick=1;tick<=ticks;tick++){
   const prior=mover.snapshot(),ballBefore=engine.snapshot().ball.position;
   const intended=mover.step(ballBefore);
   const world=engine.step(intended);
   const native=engine.nativePlayerBodySnapshot();
   const queue=engine.sharedNativeContactSnapshot();
   if(world.tick!==tick||native.tick!==tick||queue.tick!==tick||
      native.sameOriginalRapierBallWorld!==true||
      native.controlledEncounter!==false||
      native.unstagedFeedbackEnabled!==feedback||
      native.collisionColliderRadiusM!==PLAYER_MIN_SEPARATION_M/2||
      native.physicalActors.length!==22||
      queue.oneNativeRapierWorld!==true||
      queue.oneNativeEventQueue!==true||
      queue.genuineBodyStarts!==native.currentTickStarts||
      queue.officialMatchAction!==false||
      queue.officialTackle!==false||
      queue.officialPossession!==false||
      queue.officialResult!==null||
      native.physicallyAuthoritativeMatchWorld!==false||
      native.officialInterception!==false||
      native.officialTackle!==false||native.officialPossession!==false)
    throw new Error('M14 only one original native Rapier body+shoe source');
   const begins=native.events.filter(x=>x.tick===tick&&
    x.type==='rapier-body-start'&&
    x.source==='native-rapier-collision-event');
   const ends=native.events.filter(x=>x.tick===tick&&
    x.type==='rapier-body-end'&&
    x.source==='native-rapier-collision-event');
   if(begins.length!==native.currentTickStarts||
      ends.length!==native.currentTickEnds||
      native.actualNativeStarts!==totalNativeBodyStarts+begins.length||
      native.actualNativeEnds!==totalNativeBodyEnds+ends.length)
    throw new Error('M14 native START/END must match same tick source totals');
   for(const e of begins){
    const ids=e.pair.split('|');
    if(ids.length!==2||ids[0]>=ids[1]||
       !ids.every(id=>INITIAL_PLAYERS.some(p=>p.id===id)))
     throw new Error('M14 cannot infer non-original collision pairs');
    actualBodyPairs.add(e.pair);
   }
   totalNativeBodyStarts+=begins.length;
   totalNativeBodyEnds+=ends.length;
   totalNativeShoeStarts+=queue.genuineFootStarts.length;
   if(begins.length&&queue.genuineFootStarts.length)
    realConcurrentBodyAndShoeTicks++;
   maxSimultaneousBodyPairs=Math.max(maxSimultaneousBodyPairs,
    native.activePairs.length);
   maxBodyStartsSingleTick=Math.max(maxBodyStartsSingleTick,begins.length);
   if(!firstNativeBodyStart&&begins.length)
    firstNativeBodyStart=frozen({
     tick,pairs:frozen(begins.map(x=>x.pair).sort())
    });
   let observed=intended;
   if(feedback){
    const result=mover.reconcileUnstagedNativeBodyResponse(native);
    observed=mover.snapshot();
    const acknowledged=engine.acknowledgeNativePlayerResponse(observed);
    if(acknowledged.tick!==tick||
       acknowledged.appliedMoverResponses!==observed.actualNativeResponseCount||
       acknowledged.physicalPositionsFedBackIntoMover!==(
        observed.actualNativeResponseCount>0))
     throw new Error('M14 authoritative feedback must be one current Rapier tick');
    if(result.accepted){
     actualResponses++;
     if(!native.activePairs.length||
        !actualBodyPairs.size||
        result.reason!=='genuine-unstaged-rapier-body-response')
      throw new Error('M14 response requires genuine native contact');
     if(!firstAppliedFeedback)firstAppliedFeedback=frozen({
      tick,playerIds:result.playerIds,
      adjustedM:result.adjustedM,minGapM:result.minGapM
     });
    }else{
     actualRejectedResponses++;
     if(result.reason==='no-native-active-pair'&&
        native.activePairs.length!==0)
      throw new Error('M14 empty native source may not claim active pair');
    }
    if(actualResponses!==observed.actualNativeResponseCount)
     throw new Error('M14 accepted feedback count must match canonical actual writes');
    actualReasons.set(result.reason,(actualReasons.get(result.reason)??0)+1);
   }else if(native.appliedMoverResponses!==0||
      native.physicalPositionsFedBackIntoMover!==false||
      Object.hasOwn(observed,'actualNativeResponseCount'))
    throw new Error('M14 negative control must never apply native feedback');
   const limits=verify22(prior,observed,native,tick);
   minCanonicalGapM=Math.min(minCanonicalGapM,limits.minGapM);
   maxCanonicalSpeedMps=Math.max(maxCanonicalSpeedMps,limits.maxSpeedMps);
   validateLineMovement(observed);
   fullShapeTicks++;
   if(observed.pressers.home&&observed.pressers.away)pressureTicks++;
   if(observed.supports.home||observed.supports.away)supportTicks++;
   if(observed.originalOpposingPressConvergence?.active)
    actualBallConvergenceTicks++;
   latestShape=observed.shape;latestPressers=observed.pressers;
   latestSupports=observed.supports;
  }
  return frozen({
   version:'m14-authentic-multi-territory-feedback-audit-v1',
   stateId,side,mode,ticks,initialBall:frozen({x:scene.x,y:scene.y}),
   original22Unstaged:true,sameRapierWorld:true,singleNativeEventQueue:true,
   nativeColliderRadiusM:PLAYER_MIN_SEPARATION_M/2,
   nativeBodyStarts:totalNativeBodyStarts,
   nativeBodyEnds:totalNativeBodyEnds,nativeShoeStarts:totalNativeShoeStarts,
   firstNativeBodyStart,realBodyPairs:frozen([...actualBodyPairs].sort()),
   maxSimultaneousBodyPairs,maxBodyStartsSingleTick,
   sameTickNativeBodyAndShoeStarts:realConcurrentBodyAndShoeTicks,
   acceptedNativeResponses:actualResponses,
   rejectedNativeResponses:actualRejectedResponses,
   firstAppliedFeedback,
   rejectedReasons:frozen(Object.fromEntries([...actualReasons].sort())),
   minimumCanonicalGapM:minCanonicalGapM,
   peakCanonicalSpeedMps:maxCanonicalSpeedMps,
   actualConvergenceTicks:actualBallConvergenceTicks,
   originalPressTicks:pressureTicks,originalSupportTicks:supportTicks,
   fullShapeTicks,latestPressers,latestSupports,latestShape,
   matchAuthority:false,officialTackle:false,officialInterception:false,
   officialPossession:false,officialResult:null
  });
 }finally{engine.dispose();}
}

export function auditNaturalNativeFeedbackMatrix(RAPIER,{
 ticks=225,
 stateIds=M11_BALL_STARTS.map(x=>x.id)
}={}){
 if(!Array.isArray(stateIds)||stateIds.length===0||
    new Set(stateIds).size!==stateIds.length||
    stateIds.some(id=>!allBallStates.has(id)))
  throw new TypeError('Only distinct original unstaged ball states allowed');
 const rows=[];
 for(const side of sides)for(const id of stateIds)
  for(const mode of modes)
   rows.push(auditNaturalNativeFeedback(RAPIER,{
    stateId:id,side,mode,ticks
   }));
 const positive=rows.filter(x=>x.mode==='feedback');
 const controls=rows.filter(x=>x.mode==='observe');
 return frozen({
  version:'m14-real-22-player-multi-territory-matrix-v1',
  originalStates:stateIds.length,eachTicks:ticks,rows:frozen(rows),
  totalRuns:rows.length,
  feedbackCasesWithNativeContact:positive.filter(x=>x.nativeBodyStarts>0).length,
  positiveFeedbackCases:positive.filter(x=>x.acceptedNativeResponses>0).length,
  totalAcceptedNativeResponses:positive.reduce((n,x)=>n+x.acceptedNativeResponses,0),
  nativeBodyStarts:positive.reduce((n,x)=>n+x.nativeBodyStarts,0),
  nativeShoeStarts:positive.reduce((n,x)=>n+x.nativeShoeStarts,0),
  maximumSimultaneousNativeBodyPairs:Math.max(...positive.map(x=>x.maxSimultaneousBodyPairs)),
  multipleSimultaneousNativeBodyPairsObserved:
   positive.some(x=>x.maxSimultaneousBodyPairs>1),
  sameTickNativeBodyAndShoeStarts:positive.reduce(
   (n,x)=>n+x.sameTickNativeBodyAndShoeStarts,0),
  controlsWithNativeBodyStarts:controls.filter(x=>x.nativeBodyStarts>0).length,
  controlsAcceptedResponses:controls.reduce((n,x)=>n+x.acceptedNativeResponses,0),
  all22AndFootballAuthorityInvariant:true
 });
}
