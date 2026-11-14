// C3.3c — bounded laboratory discovery of genuine opposing Rapier shoes
// DURING an already-authenticated autonomous carry. This is explicitly
// exploratory: no synthetic feet, opponent relocation or forced verdict.
// The user-controlled ball landing positions below are ordinary normalized
// roll scenarios; all 22 player bodies remain at their canonical formation.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_MAX_SPEED_MPS,PLAYER_DT}
 from '../src/player-movement.mjs';
import {createPhysicalFixtureStepRuntime} from '../src/physical-fixture-step-runtime.mjs';

const WIDTHS=Object.freeze([2,3.5,4.96,7,10,14,20]);
const LANES=Object.freeze([-12,-6,0,6,12]);
const MAX_TICKS=500;
// C3.3k: recorded true 60Hz carrier-to-ball separation; never a possession
// or reachability verdict, and never feeds back into movement or Rapier.
const BALL_GAP_BANDS=Object.freeze([
 '0-0.35m','0.35-0.55m','0.55-0.75m','0.75-1.10m','over-1.10m'
]);
const ballGapBandIndex=d=>d<0.35?0:d<0.55?1:d<0.75?2:d<1.10?3:4;
const makeFixture=country=>({
 id:`season:1:${country}-1:N01:${country}-1:${country}-2`,
 competitionId:country+'-1',marker:'N01',day:1,round:1,
 homeClubId:country+'-1',awayClubId:country+'-2'
});
const baselineScenes=Object.freeze(['home','away'].flatMap(team=>
 WIDTHS.flatMap((absX,i)=>LANES.map((y,j)=>Object.freeze({
  team,country:team==='home'?'IT':'DE',
  scenario:Object.freeze({
   preset:'roll',seed:`c3-3c-natural-${team}-${i}-${j}`,
   x:(team==='home'?-1:1)*absX,y,z:0,
   vx:team==='home'?0.3:-0.3,vy:0,vz:0
  })
 })))));
// A small, mirrored, bounded extension of real user ball-roll landings.
// Neither the 22 bodies nor fixed physics or contact colliders change.
const obliqueScenes=Object.freeze(['home','away'].flatMap(team=>
 [4,8].flatMap((absX,i)=>[-9,-3,3,9].map((y,j)=>Object.freeze({
  team,country:team==='home'?'IT':'DE',
  scenario:Object.freeze({
   preset:'roll',seed:`c3-3k-oblique-${team}-${i}-${j}`,
   x:(team==='home'?-1:1)*absX,y,z:0,
   vx:team==='home'?0.48:-0.48,vy:-Math.sign(y)*0.20,vz:0
  })
 })))));
const scenes=Object.freeze([...baselineScenes,...obliqueScenes]);
const valid=(frame,prior)=>frame.physicsTick>0&&
 frame.physicalCarryProximity?.readOnly===true&&
 frame.physicalCarryProximity.dribbleConfirmed===null&&
 frame.physicalCarryProximity.ballControlConfirmed===null&&
 frame.physicalCarryProximity.officialMatchPossession===false&&
 frame.officialMatchResult===null&&
 prior?.fixtureId===frame.fixtureId;

function traceOne(R,item){
 const session=createPhysicalFixtureStepRuntime(R,
  makeFixture(item.country),item.scenario,
  {autonomousActions:true,autonomousCarry:true});
 let firstCarry=null,actualForeignStarts=0,activeCarryFrames=0,
  contested=null,carryTouches=0,completed=0;
 const carryTouchesByCarrier={home:0,away:0};
 const activeCarryFramesByCarrier={home:0,away:0};
 const minOpposingActorBallGapByCarrier={home:Infinity,away:Infinity};
 const realChallengeAssignmentsByCarrier={home:0,away:0};
 const realChallengerBlockedFramesByCarrier={home:0,away:0};
 const challengerBlockedByCarrierFrames={home:0,away:0};
 const realChallengePhysicalShoeFramesByCarrier={home:0,away:0};
 const realFlankAssignmentFramesByCarrier={home:0,away:0};
 const realFlankHardRejectedFramesByCarrier={home:0,away:0};
 const minFlankOpponentBallGapByCarrier={home:Infinity,away:Infinity};
 const realOrientedShoeSamplesByCarrier={home:0,away:0};
 const minStaticShoeBallClearanceByCarrier={home:Infinity,away:Infinity};
 const minShoeBallCenterGapByCarrier={home:Infinity,away:Infinity};
 const minAbsShoeLateralOffsetByCarrier={home:Infinity,away:Infinity};
 const estimatedStaticEnvelopeOverlapSamplesByCarrier={home:0,away:0};
 const minAssignedChallengerBallGapByCarrier={home:Infinity,away:Infinity};
 // C3.3i: instrument actual 22-player Rapier motion only; no new input.
 const phases=['no-flank','lateral-bypass','along-carrier-flank',
  'ball-side-shoe-approach'];
 const phaseCounts=Object.fromEntries(['home','away'].map(t=>[
  t,Object.fromEntries(phases.map(x=>[x,0]))]));
 const closestFrame={home:null,away:null};
 const closeCarrierBallFrames={home:0,away:0};
 const actorSwitches={home:0,away:0},lastActor={home:null,away:null};
 const separationBands=Object.fromEntries(['home','away'].map(t=>[
  t,Array(BALL_GAP_BANDS.length).fill(0)]));
 const assignedSeparationBands=Object.fromEntries(['home','away'].map(t=>[
  t,Array(BALL_GAP_BANDS.length).fill(0)]));
 const maxSeparationM={home:0,away:0};
 const maxAssignedSeparationM={home:0,away:0};
 // C3.3l: paired same-tick genuine Rapier geometry ONLY where the
 // physical carrier and the live ball are already >1.10m apart.
 // This is NOT a candidate interception/contact and never steers actors.
 const separatedGeometry=Object.fromEntries(['home','away'].map(t=>[
  t,{
   frames:0,phaseCounts:Object.fromEntries(phases.map(phase=>[phase,0])),
   ageBuckets:[0,0,0,0],facingBuckets:[0,0,0],
   carrierBlocked:0,otherBlocked:0,unblocked:0,
   under50cm:0,under20cm:0,
   minShoeClearanceM:Infinity,minBodyBallM:Infinity,closest:null
  }
 ]));
 try{
  assert.deepEqual(session.snapshot().physicalPlayerPositions.map(p=>
   ({engineId:p.engineId,x:p.x,y:p.y})),
   INITIAL_PLAYERS.map(p=>({engineId:p.id,x:p.x,y:p.y})),
   'no changed or relocated player may enter a physical trial');
  for(let tick=1;tick<=MAX_TICKS;tick++){
   const prior=session.snapshot();
   const f=session.step(),before=prior.physicalCarryProximity;
   assert.ok(valid(f,prior));
   assert.equal(f.physicalContactFeed.contactSource,
    'same-step-real-rapier-shoe-ball-collider');
   if(f.localAutonomousAction?.action==='carry'){
    carryTouches++;
    carryTouchesByCarrier[f.localAutonomousAction.team]++;
    firstCarry??={tick,engineId:f.localAutonomousAction.playerId,
     team:f.localAutonomousAction.team};
   }
   const active=before.activeMeasurement;
   const liveChallenge=f.contactDecisionObservation.carryChallenger;
   const oriented=f.physicalCarryChallengerShoeGeometry;
   assert.equal(Boolean(oriented),Boolean(liveChallenge));
   if(liveChallenge){
    assert.equal(oriented.source,'same-60hz-moved-rapier-shoe-transform');
    assert.equal(oriented.physicsTick,tick);
    assert.equal(oriented.engineId,liveChallenge.challengerId);
    assert.equal(oriented.team,liveChallenge.challengerTeam);
    assert.equal(oriented.actualRapierCollisionInferred,false);
    assert.equal(oriented.footballTackleConfirmed,null);
    assert.equal(oriented.officialMatchPossession,false);
    assert.equal(oriented.dribbleConfirmed,null);
    assert.equal(liveChallenge.source,
     'previous-authenticated-rapier-carry-with-physical-shoe-end');
    assert.ok(liveChallenge.sourceCarryTick<
     liveChallenge.physicalShoeEndTick);
    assert.ok(liveChallenge.physicalShoeEndTick<tick);
    assert.ok(tick-liveChallenge.sourceCarryTick<=150);
    assert.notEqual(liveChallenge.sourceCarrierTeam,
     liveChallenge.challengerTeam);
    assert.equal(liveChallenge.movementIntentOnly,true);
    if(liveChallenge.flank){
     const flank=liveChallenge.flank;
     assert.equal(flank.source,'observed-carrier-hard-step-rejection');
     assert.equal(flank.sourceCarryTick,liveChallenge.sourceCarryTick);
     assert.equal(flank.carrierId,liveChallenge.sourceCarrierId);
     assert.equal(flank.challengerId,liveChallenge.challengerId);
     assert.equal(flank.physicsTick,tick);
     assert.equal(flank.movementIntentOnly,true);
     assert.equal(flank.physicalShoeContactObserved,false);
     assert.equal(flank.dribbleConfirmed,null);
     assert.equal(flank.officialMatchPossession,false);
     assert.ok(flank.waypointCarrierClearanceM>=
      0.98+0.12-1e-9);
     assert.ok(Number.isFinite(flank.segmentCarrierClearanceM));
     assert.ok([true,false].includes(flank.bodySafeShortArc));
     if(flank.bodySafeShortArc){
      assert.equal(flank.carrierId.startsWith('away-'),true);
      assert.equal(flank.phase,'lateral-bypass');
      assert.ok(flank.carrierBallGapM>1.10);
      assert.ok(flank.segmentCarrierClearanceM>=0.98-1e-9,
       'short AWAY route stays outside real carrier body guard');
     }
     assert.ok(Number.isFinite(flank.carrierBallGapM));
     assert.ok(flank.carrierBallGapM>=0);
    }
    assert.equal(liveChallenge.dribbleConfirmed,null);
    assert.equal(liveChallenge.officialMatchPossession,false);
    assert.equal(liveChallenge.actualRapierShoeActive,
     f.physicalContactFeed.active.some(x=>
      x.engineId===liveChallenge.challengerId));
    assert.equal(f.contactDecisionObservation.duties.filter(d=>
     d.movementDuty==='challenge-carry-intent').length,1);
    const defender=f.physicalPlayerPositions.find(p=>
     p.engineId===liveChallenge.challengerId);
    const priorDefender=prior.physicalPlayerPositions.find(p=>
     p.engineId===liveChallenge.challengerId);
    assert.ok(defender&&priorDefender);
    assert.ok(Math.hypot(defender.x-priorDefender.x,
     defender.y-priorDefender.y)<=PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-7,
     'true challenger uses same bounded physical actor movement');
    if(liveChallenge.realMoverStepRejected)
     assert.ok(liveChallenge.blockedBy);
   }else assert.equal(f.contactDecisionObservation.duties.some(d=>
    d.movementDuty==='challenge-carry-intent'),false);
   if(active){
    activeCarryFrames++;
    activeCarryFramesByCarrier[active.team]++;
    const carrier=f.physicalPlayerPositions.find(p=>p.engineId===active.engineId);
    assert.ok(carrier&&carrier.team===active.team,
     'verified earlier carry must have current real physical carrier');
    const carrierBallGap=Math.hypot(carrier.x-f.ball.position.x,
     carrier.y-f.ball.position.y);
    separationBands[active.team][ballGapBandIndex(carrierBallGap)]++;
    maxSeparationM[active.team]=Math.max(
     maxSeparationM[active.team],carrierBallGap);
    const opposition=f.physicalPlayerPositions.filter(p=>
     p.team!==active.team);
    assert.equal(opposition.length,11);
    const realGap=Math.min(...opposition.map(p=>
     Math.hypot(p.x-f.ball.position.x,p.y-f.ball.position.y)));
    minOpposingActorBallGapByCarrier[active.team]=Math.min(
     minOpposingActorBallGapByCarrier[active.team],realGap);
    if(liveChallenge?.sourceCarrierTeam===active.team&&
       liveChallenge.sourceCarrierId===active.engineId){
     realChallengeAssignmentsByCarrier[active.team]++;
     realOrientedShoeSamplesByCarrier[active.team]++;
     assignedSeparationBands[active.team][ballGapBandIndex(carrierBallGap)]++;
     maxAssignedSeparationM[active.team]=Math.max(
      maxAssignedSeparationM[active.team],carrierBallGap);
     const t=active.team,phase=liveChallenge.flank?.phase??'no-flank';
     assert.ok(phases.includes(phase),'known measured actual mover phase');
     if(carrierBallGap>1.10){
      const g=separatedGeometry[t],age=tick-liveChallenge.sourceCarryTick;
      const clearance=oriented.estimatedStaticSurfaceClearanceM;
      assert.ok(Number.isSafeInteger(age)&&age>=1&&age<=150,
       'separated-ball sample must still belong to a real prior carry');
      assert.ok(Number.isFinite(oriented.relativeBallForwardM)&&
       Number.isFinite(oriented.relativeBallLateralM)&&
       Number.isFinite(oriented.bodyBallXYGapM));
      g.frames++;
      g.phaseCounts[phase]++;
      g.ageBuckets[age<=30?0:age<=75?1:age<=120?2:3]++;
      // Ball relative to the ACTUAL moved/facing shoe, never a
      // presumed collision or retroactively scripted decision.
      const forward=oriented.relativeBallForwardM;
      const lateral=Math.abs(oriented.relativeBallLateralM);
      g.facingBuckets[forward<=0?2:lateral>forward?1:0]++;
      if(liveChallenge.blockedBy===active.engineId)g.carrierBlocked++;
      else if(liveChallenge.realMoverStepRejected)g.otherBlocked++;
      else g.unblocked++;
      if(clearance<=0.50)g.under50cm++;
      if(clearance<=0.20)g.under20cm++;
      g.minShoeClearanceM=Math.min(g.minShoeClearanceM,clearance);
      g.minBodyBallM=Math.min(g.minBodyBallM,oriented.bodyBallXYGapM);
      if(!g.closest||clearance<g.closest.clearanceM)
       g.closest=Object.freeze({
        scenario:item.scenario,tick,carrierTeam:t,
        carrierId:active.engineId,challengerId:liveChallenge.challengerId,
        carrierBallGapM:carrierBallGap,bodyBallGapM:oriented.bodyBallXYGapM,
        clearanceM:clearance,relativeForwardM:forward,
        relativeLateralM:oriented.relativeBallLateralM,
        facingRad:oriented.actualFacingRad,
        phase,blockedBy:liveChallenge.blockedBy,
        carryAgeTicks:age,remainingTicks:150-age,
        realRapierShoeActive:liveChallenge.actualRapierShoeActive,
        inferredContact:false
       });
     }
     phaseCounts[t][phase]++;
     if(liveChallenge.flank?.carrierBallGapM<=0.75)
      closeCarrierBallFrames[t]++;
     if(lastActor[t]!==null&&lastActor[t]!==liveChallenge.challengerId)
      actorSwitches[t]++;
     lastActor[t]=liveChallenge.challengerId;
     if(oriented.estimatedStaticSurfaceClearanceM<
        (closestFrame[t]?.shoeGapM??Infinity))
      closestFrame[t]=Object.freeze({
       tick,sourceCarrierId:active.engineId,
       challengerId:liveChallenge.challengerId,phase,
       blockedBy:liveChallenge.blockedBy,
       carrierBallGapM:liveChallenge.flank?.carrierBallGapM??null,
       bodyBallXYGapM:oriented.bodyBallXYGapM,
       relativeForwardM:oriented.relativeBallForwardM,
       relativeLateralM:oriented.relativeBallLateralM,
       facingRad:oriented.actualFacingRad,
       shoeGapM:oriented.estimatedStaticSurfaceClearanceM,
       actualRapierContactInferred:false
      });
     minStaticShoeBallClearanceByCarrier[active.team]=Math.min(
      minStaticShoeBallClearanceByCarrier[active.team],
      oriented.estimatedStaticSurfaceClearanceM);
     minShoeBallCenterGapByCarrier[active.team]=Math.min(
      minShoeBallCenterGapByCarrier[active.team],
      oriented.shoeBallCenter3DGapM);
     minAbsShoeLateralOffsetByCarrier[active.team]=Math.min(
      minAbsShoeLateralOffsetByCarrier[active.team],
      Math.abs(oriented.relativeBallLateralM));
     if(oriented.estimatedStaticSurfaceClearanceM===0)
      estimatedStaticEnvelopeOverlapSamplesByCarrier[active.team]++;
     const challenged=f.physicalPlayerPositions.find(p=>
      p.engineId===liveChallenge.challengerId);
     const distance=Math.hypot(challenged.x-f.ball.position.x,
      challenged.y-f.ball.position.y);
     minAssignedChallengerBallGapByCarrier[active.team]=Math.min(
      minAssignedChallengerBallGapByCarrier[active.team],distance);
     if(liveChallenge.realMoverStepRejected){
      realChallengerBlockedFramesByCarrier[active.team]++;
      if(liveChallenge.blockedBy===active.engineId)
       challengerBlockedByCarrierFrames[active.team]++;
     }
     if(liveChallenge.actualRapierShoeActive)
      realChallengePhysicalShoeFramesByCarrier[active.team]++;
     if(liveChallenge.flank){
      realFlankAssignmentFramesByCarrier[active.team]++;
      minFlankOpponentBallGapByCarrier[active.team]=Math.min(
       minFlankOpponentBallGapByCarrier[active.team],distance);
      if(liveChallenge.realMoverStepRejected)
       realFlankHardRejectedFramesByCarrier[active.team]++;
     }
    }
   }
   actualForeignStarts+=f.physicalContactFeed.started.filter(shoe=>
    shoe.team!==item.team).length;
   // A foreign active shoe is NOT presumed to exist. It is checked
   // against the real same-world contact feed on this exact tick.
   const opponents=active?f.physicalContactFeed.started.concat(
    f.physicalContactFeed.active).filter(shoe=>
     shoe.team!==active.team):[];
   const uniqueOpponents=[...new Set(opponents.map(p=>p.engineId))];
   const broken=f.physicalCarryProximity.latestInterruptedWindow;
   if(active&&uniqueOpponents.length){
    assert.ok(broken,'genuine opposing Rapier foot must break this carry');
    assert.equal(broken.observedThroughTick,tick);
    assert.equal(broken.firstShoeTick,active.firstShoeTick);
    assert.equal(broken.engineId,active.engineId);
    assert.ok(broken.reason==='opponent-shoe'||
     broken.reason==='ambiguous-shoes');
    assert.equal(broken.realRapierInterruptionObserved,true);
    for(const id of uniqueOpponents)
     assert.ok(broken.otherPhysicalShoeIds.includes(id));
    // The OLD carry must end. A genuine opponent exclusive shoe START can
    // simultaneously start a FRESH, unprivileged carry; rejecting that new
    // actor would confuse candidate invalidation with physical ball ownership.
    const next=f.physicalCarryProximity.activeMeasurement;
    if(next){
     assert.notEqual(next.engineId,active.engineId,
      'the interrupted actor cannot retain its prior carry window');
     assert.equal(next.firstShoeTick,tick,
      'fresh rival carries cannot inherit the old actor carry timestamp');
     assert.equal(next.team!==active.team,true);
     assert.equal(f.localAutonomousAction?.action,'carry');
     assert.equal(f.localAutonomousAction.playerId,next.engineId);
     assert.equal(f.physicalContactFeed.started.length,1);
     assert.equal(f.physicalContactFeed.started[0].engineId,next.engineId);
     assert.equal(f.physicalContactFeed.active.length,1);
     assert.equal(f.physicalContactFeed.active[0].engineId,next.engineId);
    }
    assert.equal(broken.dribbleConfirmed,null);
    assert.equal(broken.ballControlConfirmed,null);
    assert.equal(broken.officialMatchResult,null);
    contested??=Object.freeze({
     tick,firstShoeTick:active.firstShoeTick,
     carrier:active.engineId,team:active.team,
     opponents:Object.freeze(uniqueOpponents),
     physicalReason:broken.reason,
     realRapierStarted:Object.freeze(f.physicalContactFeed.started.map(
      x=>x.engineId)),
     realRapierActive:Object.freeze(f.physicalContactFeed.active.map(
      x=>x.engineId)),
     interruptedShoeEndTick:broken.realShoeEndTick,
     freshRivalRealCarry:next?Object.freeze({
      actor:next.engineId,team:next.team,shoeStartTick:next.firstShoeTick,
      actualNewRapierCarry:true,officialPossession:false
     }):null,
     observedActorPathM:broken.measuredActorPathM,
     observedBallPathM:broken.measuredBallPath3DM,
     noOfficialPossession:true,noDribbleVerdict:true
    });
    // First real discovery is sufficient for a dedicated independent replay.
    break;
   }
   completed=f.physicalCarryProximity.measuredWindows;
  }
  return Object.freeze({
   ...item,firstCarry,carryTouches,actualForeignStarts,
   activeCarryFrames,completed,contested,
   carryTouchesByCarrier:Object.freeze({...carryTouchesByCarrier}),
   activeCarryFramesByCarrier:Object.freeze({...activeCarryFramesByCarrier}),
   minOpposingActorBallGapByCarrier:Object.freeze(
    Object.fromEntries(['home','away'].map(team=>
     [team,Number.isFinite(minOpposingActorBallGapByCarrier[team])?
      minOpposingActorBallGapByCarrier[team]:null]))),
   realChallengeAssignmentsByCarrier:Object.freeze({...realChallengeAssignmentsByCarrier}),
   realChallengerBlockedFramesByCarrier:Object.freeze({...realChallengerBlockedFramesByCarrier}),
   challengerBlockedByCarrierFrames:Object.freeze({...challengerBlockedByCarrierFrames}),
   phaseCounts:Object.freeze(Object.fromEntries(['home','away'].map(t=>[
    t,Object.freeze({...phaseCounts[t]})]))),
   closeCarrierBallFrames:Object.freeze({...closeCarrierBallFrames}),
   actorSwitches:Object.freeze({...actorSwitches}),
   closestFrame:Object.freeze({...closestFrame}),
   separationBands:Object.freeze(Object.fromEntries(['home','away'].map(t=>[
    t,Object.freeze([...separationBands[t]])]))),
   assignedSeparationBands:Object.freeze(Object.fromEntries(
    ['home','away'].map(t=>[t,Object.freeze([...assignedSeparationBands[t]])]))),
   maxSeparationM:Object.freeze({...maxSeparationM}),
   maxAssignedSeparationM:Object.freeze({...maxAssignedSeparationM}),
   separatedGeometry:Object.freeze(Object.fromEntries(['home','away'].map(t=>{
    const g=separatedGeometry[t];
    return [t,Object.freeze({
     frames:g.frames,phaseCounts:Object.freeze({...g.phaseCounts}),
     ageBuckets:Object.freeze([...g.ageBuckets]),
     facingBuckets:Object.freeze([...g.facingBuckets]),
     carrierBlocked:g.carrierBlocked,otherBlocked:g.otherBlocked,
     unblocked:g.unblocked,under50cm:g.under50cm,under20cm:g.under20cm,
     minShoeClearanceM:Number.isFinite(g.minShoeClearanceM)?
      g.minShoeClearanceM:null,
     minBodyBallM:Number.isFinite(g.minBodyBallM)?g.minBodyBallM:null,
     closest:g.closest
    })];
   }))),
   realChallengePhysicalShoeFramesByCarrier:Object.freeze({...realChallengePhysicalShoeFramesByCarrier}),
   realFlankAssignmentFramesByCarrier:Object.freeze({...realFlankAssignmentFramesByCarrier}),
   realFlankHardRejectedFramesByCarrier:Object.freeze({...realFlankHardRejectedFramesByCarrier}),
   realOrientedShoeSamplesByCarrier:Object.freeze({...realOrientedShoeSamplesByCarrier}),
   estimatedStaticEnvelopeOverlapSamplesByCarrier:Object.freeze({
    ...estimatedStaticEnvelopeOverlapSamplesByCarrier
   }),
   minStaticShoeBallClearanceByCarrier:Object.freeze(
    Object.fromEntries(['home','away'].map(team=>
     [team,Number.isFinite(minStaticShoeBallClearanceByCarrier[team])?
      minStaticShoeBallClearanceByCarrier[team]:null]))),
   minShoeBallCenterGapByCarrier:Object.freeze(
    Object.fromEntries(['home','away'].map(team=>
     [team,Number.isFinite(minShoeBallCenterGapByCarrier[team])?
      minShoeBallCenterGapByCarrier[team]:null]))),
   minAbsShoeLateralOffsetByCarrier:Object.freeze(
    Object.fromEntries(['home','away'].map(team=>
     [team,Number.isFinite(minAbsShoeLateralOffsetByCarrier[team])?
      minAbsShoeLateralOffsetByCarrier[team]:null]))),
   minFlankOpponentBallGapByCarrier:Object.freeze(
    Object.fromEntries(['home','away'].map(team=>
     [team,Number.isFinite(minFlankOpponentBallGapByCarrier[team])?
      minFlankOpponentBallGapByCarrier[team]:null]))),
   minAssignedChallengerBallGapByCarrier:Object.freeze(
    Object.fromEntries(['home','away'].map(team=>
     [team,Number.isFinite(minAssignedChallengerBallGapByCarrier[team])?
      minAssignedChallengerBallGapByCarrier[team]:null])))
  });
 }finally{session.dispose();}
}

test('C3.3c real opponent-in-carry diagnostic, independently replay only witnessed actors',async()=>{
 const R=await initializeRapier(rapier);
 const results=[],firstWitnessByCarrierTeam={home:null,away:null};
 let searched=0;
 const testedTeams={home:0,away:0};
 // The side where the BALL started is not necessarily the side of the
 // authentic CARRIER. Search a strictly bounded set of legal user ball
 // landings, grouping evidence by the TRUE Rapier carrier team, and stop
 // once BOTH real teams have physical witnesses. No altered player bodies.
 for(const candidate of scenes){
  if(firstWitnessByCarrierTeam.home&&firstWitnessByCarrierTeam.away&&
     testedTeams.home>=1&&testedTeams.away>=1)break;
  searched++;
  const result=traceOne(R,candidate);
  results.push(result);
  testedTeams[candidate.team]++;
  if(result.contested&&!firstWitnessByCarrierTeam[result.contested.team])
   firstWitnessByCarrierTeam[result.contested.team]=result;
 }
 assert.ok(searched>=2&&searched<=scenes.length);
 assert.ok(testedTeams.home>=1&&testedTeams.home<=scenes.length/2);
 assert.ok(testedTeams.away>=1&&testedTeams.away<=scenes.length/2);
 assert.equal(scenes.length,86,
  'strict maximum 70 original plus 16 genuinely mirrored oblique rolls');
 for(const r of results){
  for(const team of ['home','away']){
   assert.equal(r.separationBands[team].reduce((a,b)=>a+b,0),
    r.activeCarryFramesByCarrier[team]);
   assert.equal(r.assignedSeparationBands[team].reduce((a,b)=>a+b,0),
    r.realChallengeAssignmentsByCarrier[team]);
   const g=r.separatedGeometry[team];
   assert.equal(g.frames,r.assignedSeparationBands[team][4],
    'same-tick separated geometry must cover exactly the authentic assigned gap >1.10m band');
   assert.equal(Object.values(g.phaseCounts).reduce((a,b)=>a+b,0),g.frames);
   assert.equal(g.ageBuckets.reduce((a,b)=>a+b,0),g.frames);
   assert.equal(g.facingBuckets.reduce((a,b)=>a+b,0),g.frames);
   assert.equal(g.carrierBlocked+g.otherBlocked+g.unblocked,g.frames);
   assert.ok(g.under20cm<=g.under50cm&&g.under50cm<=g.frames);
  }
 }
 assert.ok(results.some(r=>r.team==='home'&&r.carryTouches>=1),
  'natural HOME candidate needs authentic physical carry');
 assert.ok(results.some(r=>r.team==='away'&&r.carryTouches>=1),
  'natural AWAY candidate needs authentic physical carry');
 const totals=Object.freeze({
  searched,maximumResearchScenes:scenes.length,
  testedTeams:Object.freeze({...testedTeams}),
  canonicalPlayers:22,physicsTickLimit:MAX_TICKS,
  homeCarrierWitnesses:results.filter(x=>x.contested?.team==='home').length,
  awayCarrierWitnesses:results.filter(x=>x.contested?.team==='away').length,
  initialHomeSideWitnesses:results.filter(x=>x.contested&&x.team==='home').length,
  initialAwaySideWitnesses:results.filter(x=>x.contested&&x.team==='away').length,
  candidateCarryStarts:results.reduce((a,x)=>a+x.carryTouches,0),
  obliqueSceneBudget:obliqueScenes.length,relocatedPlayers:0,
  ballGapBandsM:BALL_GAP_BANDS,
  activeCarrierBallGapBands:Object.freeze(Object.fromEntries(
   ['home','away'].map(t=>[t,Object.freeze(BALL_GAP_BANDS.map((_,i)=>
    results.reduce((n,r)=>n+r.separationBands[t][i],0)))]))),
  assignedCarrierBallGapBands:Object.freeze(Object.fromEntries(
   ['home','away'].map(t=>[t,Object.freeze(BALL_GAP_BANDS.map((_,i)=>
    results.reduce((n,r)=>n+r.assignedSeparationBands[t][i],0)))]))),
  maxActiveCarrierBallGapM:Object.freeze(Object.fromEntries(
   ['home','away'].map(t=>[t,Math.max(0,...results.map(r=>
    r.maxSeparationM[t]))]))),
  maxAssignedCarrierBallGapM:Object.freeze(Object.fromEntries(
   ['home','away'].map(t=>[t,Math.max(0,...results.map(r=>
    r.maxAssignedSeparationM[t]))]))),
  C3_3L_SEPARATED_SHOE_AUDIT:Object.freeze(Object.fromEntries(
   ['home','away'].map(t=>{
    const items=results.map(r=>r.separatedGeometry[t]);
    const sum=key=>items.reduce((n,g)=>n+g[key],0);
    const min=key=>{
     const values=items.map(g=>g[key]).filter(Number.isFinite);
     return values.length?Math.min(...values):null;
    };
    const closest=items.reduce((best,g)=>
     g.closest&&(!best||g.closest.clearanceM<best.clearanceM)?
      g.closest:best,null);
    return [t,Object.freeze({
     separatedAssignedFrames:sum('frames'),
     phaseCounts:Object.freeze(Object.fromEntries(
      ['no-flank','lateral-bypass','along-carrier-flank',
       'ball-side-shoe-approach'].map(phase=>[phase,
       items.reduce((n,g)=>n+g.phaseCounts[phase],0)]))),
     carryAgeBucketsTicks:Object.freeze(['1-30','31-75','76-120','121-150']),
     carryAgeFrameCounts:Object.freeze([0,1,2,3].map(i=>
      items.reduce((n,g)=>n+g.ageBuckets[i],0))),
     shoeFacingBuckets:Object.freeze(['front','side','behind']),
     shoeFacingFrameCounts:Object.freeze([0,1,2].map(i=>
      items.reduce((n,g)=>n+g.facingBuckets[i],0))),
     carrierBlocked:sum('carrierBlocked'),otherBlocked:sum('otherBlocked'),
     unblocked:sum('unblocked'),
     staticClearanceAtMost50cm:sum('under50cm'),
     staticClearanceAtMost20cm:sum('under20cm'),
     minOrientedShoeSurfaceClearanceM:min('minShoeClearanceM'),
     minDefenderBodyBallGapM:min('minBodyBallM'),closest
    })];
   }))),
  candidateForeignStarts:results.reduce((a,x)=>a+x.actualForeignStarts,0),
  activeCarryFrames:results.reduce((a,x)=>a+x.activeCarryFrames,0),
  carryTouchesByCarrier:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>[team,results.reduce((a,x)=>
    a+x.carryTouchesByCarrier[team],0)]))),
  activeCarryFramesByCarrier:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>[team,results.reduce((a,x)=>
    a+x.activeCarryFramesByCarrier[team],0)]))),
  minOpposingActorBallGapByCarrierM:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>{
    const values=results.map(x=>x.minOpposingActorBallGapByCarrier[team])
     .filter(Number.isFinite);
    return [team,values.length?Math.min(...values):null];
   }))),
  realChallengeAssignmentsByCarrier:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>[team,results.reduce((a,x)=>
    a+x.realChallengeAssignmentsByCarrier[team],0)]))),
  realChallengerBlockedFramesByCarrier:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>[team,results.reduce((a,x)=>
    a+x.realChallengerBlockedFramesByCarrier[team],0)]))),
  challengerBlockedByCarrierFrames:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>[team,results.reduce((a,x)=>
    a+x.challengerBlockedByCarrierFrames[team],0)]))),
  phaseCounts:Object.freeze(Object.fromEntries(['home','away'].map(t=>[
   t,Object.freeze(Object.fromEntries(['no-flank','lateral-bypass',
    'along-carrier-flank','ball-side-shoe-approach'].map(phase=>[
     phase,results.reduce((n,r)=>n+r.phaseCounts[t][phase],0)])))]))),
  closeCarrierBallFrames:Object.freeze(Object.fromEntries(['home','away'].map(t=>[
   t,results.reduce((n,r)=>n+r.closeCarrierBallFrames[t],0)]))),
  actorSwitches:Object.freeze(Object.fromEntries(['home','away'].map(t=>[
   t,results.reduce((n,r)=>n+r.actorSwitches[t],0)]))),
  closestFrame:Object.freeze(Object.fromEntries(['home','away'].map(t=>[
   t,results.reduce((best,r)=>r.closestFrame[t]&&
     (!best||r.closestFrame[t].shoeGapM<best.shoeGapM)?
      Object.freeze({scenario:r.scenario,...r.closestFrame[t]}):best,null)]))),
  realChallengePhysicalShoeFramesByCarrier:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>[team,results.reduce((a,x)=>
    a+x.realChallengePhysicalShoeFramesByCarrier[team],0)]))),
  realFlankAssignmentFramesByCarrier:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>[team,results.reduce((a,x)=>
    a+x.realFlankAssignmentFramesByCarrier[team],0)]))),
  realOrientedShoeSamplesByCarrier:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>[team,results.reduce((a,x)=>
    a+x.realOrientedShoeSamplesByCarrier[team],0)]))),
  estimatedStaticEnvelopeOverlapSamplesByCarrier:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>[team,results.reduce((a,x)=>
    a+x.estimatedStaticEnvelopeOverlapSamplesByCarrier[team],0)]))),
  minStaticShoeBallClearanceByCarrierM:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>{
    const values=results.map(x=>x.minStaticShoeBallClearanceByCarrier[team])
     .filter(Number.isFinite);
    return [team,values.length?Math.min(...values):null];
   }))),
  minShoeBallCenterGapByCarrierM:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>{
    const values=results.map(x=>x.minShoeBallCenterGapByCarrier[team])
     .filter(Number.isFinite);
    return [team,values.length?Math.min(...values):null];
   }))),
  minAbsShoeLateralOffsetByCarrierM:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>{
    const values=results.map(x=>x.minAbsShoeLateralOffsetByCarrier[team])
     .filter(Number.isFinite);
    return [team,values.length?Math.min(...values):null];
   }))),
  realFlankHardRejectedFramesByCarrier:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>[team,results.reduce((a,x)=>
    a+x.realFlankHardRejectedFramesByCarrier[team],0)]))),
  minFlankOpponentBallGapByCarrierM:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>{
    const values=results.map(x=>x.minFlankOpponentBallGapByCarrier[team])
     .filter(Number.isFinite);
    return [team,values.length?Math.min(...values):null];
   }))),
  minAssignedChallengerBallGapByCarrierM:Object.freeze(Object.fromEntries(
   ['home','away'].map(team=>{
    const values=results.map(x=>x.minAssignedChallengerBallGapByCarrier[team])
      .filter(Number.isFinite);
    return [team,values.length?Math.min(...values):null];
   }))),
  missingActualCarrierWitnesses:Object.freeze(['home','away'].filter(team=>
   firstWitnessByCarrierTeam[team]===null)),
  witnesses:Object.freeze(['home','away'].map(team=>{
   const one=firstWitnessByCarrierTeam[team];
   return one?Object.freeze({
    team,scenario:one.scenario, ...one.contested
   }):null;
  }))
 });
 console.log('C3_3C_GENUINE_RAPIER_OPPONENT_SEARCH',JSON.stringify(totals));
 // A genuine research witness MUST replay independently. An absent team
 // stays explicitly OPEN; it cannot be promoted to a fake PASS nor may it
 // make unrelated accepted 729+ Node physics checks red. This test is a
 // forensic diagnostic, NOT the final C3.3c acceptance gate.
 assert.ok(firstWitnessByCarrierTeam.home,
  'previously observed authentic HOME carry opposition must remain reproducible');
 for(const team of ['home','away']){
  const one=firstWitnessByCarrierTeam[team];
  if(!one)continue;
  assert.equal(one.contested.team,team);
  assert.ok(one.contested.opponents.some(id=>id.startsWith(
   team==='home'?'away-':'home-')));
  assert.ok(one.contested.firstShoeTick<one.contested.tick);
  assert.ok(one.contested.observedBallPathM>0);
  assert.ok(one.contested.observedActorPathM>0);
  assert.ok(one.contested.physicalReason==='opponent-shoe'||
   one.contested.physicalReason==='ambiguous-shoes');
  assert.equal(one.contested.noOfficialPossession,true);
  assert.equal(one.contested.noDribbleVerdict,true);
  const replay=traceOne(R,one);
  assert.deepEqual(replay.contested,one.contested,
   'two independent Rapier worlds must reproduce EXACT '+team+' shoe evidence');
  assert.deepEqual(replay.firstCarry,one.firstCarry);
  assert.equal(replay.contested.freshRivalRealCarry?.officialPossession??false,false);
 }
});

test('C3.3c no-contact and genuine non-carry teammate/opponent feet cannot invent carried possession',async()=>{
 const R=await initializeRapier(rapier);
 const isolated=createPhysicalFixtureStepRuntime(R,makeFixture('FR'),{
  preset:'drop',seed:'c3-3c-natural-empty',
  x:0,y:28,z:4,vx:0,vy:0,vz:0
 },{autonomousActions:true,autonomousCarry:true});
 try{
  for(let tick=1;tick<=75;tick++){
   const f=isolated.step();
   assert.equal(f.physicalContactFeed.started.length,0);
   assert.equal(f.physicalCarryProximity.measuredWindows,0);
   assert.equal(f.physicalCarryProximity.interruptedWindows,0);
   assert.equal(f.physicalCarryProximity.activeMeasurement,null);
   assert.equal(f.localAutonomousAction,null);
   assert.equal(f.officialMatchResult,null);
  }
 }finally{isolated.dispose();}
 const noCarry=createPhysicalFixtureStepRuntime(R,makeFixture('IT'),{
  preset:'roll',seed:'c3-1-canonical-home',
  x:-4.96,y:0,z:0,vx:0.3,vy:0,vz:0
 },{autonomousActions:true});
 let teammateStart=null,opponentStart=null;
 try{
  for(let tick=1;tick<=250;tick++){
   const f=noCarry.step();
   const shoe=f.physicalContactFeed.started[0];
   if(shoe?.team==='home'&&shoe.engineId==='home-9')
    teammateStart??=tick;
   if(shoe?.team==='away')opponentStart??=tick;
   assert.equal(f.physicalCarryProximity.measuredWindows,0);
   assert.equal(f.physicalCarryProximity.interruptedWindows,0);
   assert.equal(f.physicalCarryProximity.activeMeasurement,null);
   assert.equal(f.physicalCarryProximity.dribbleConfirmed,null);
   assert.equal(f.officialMatchPossession,false);
  }
  assert.ok(teammateStart,'real teammate Rapier shoe never reached ball');
  assert.ok(opponentStart,'real opponent Rapier shoe never reached ball');
  assert.ok(opponentStart>teammateStart);
 }finally{noCarry.dispose();}
});
