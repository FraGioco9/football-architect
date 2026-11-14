// ME-PB-54 A1.3a: real executable 60Hz fixture physics step producer.
// Explicit stdin request only; isolated from scoring, API, Worker and D1.
// Usage: cd match-engine; printf '%s' '{"fixture":...,"scenario":...,"ticks":155}' | node tools/physical-fixture-runner.mjs
import {createHash} from 'node:crypto';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

async function main(){
 const chunks=[];let length=0;
 for await(const chunk of process.stdin){
  length+=chunk.length;
  if(length>16384)throw new RangeError('Fixture physics stdin too large');
  chunks.push(chunk);
 }
 if(length===0)throw new TypeError('Fixture physics stdin JSON required');
 const request=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!request||typeof request!=='object'||Array.isArray(request)||
    Reflect.ownKeys(request).some(key=>![
     'fixture','scenario','ticks','globalResponse','autonomousActions','autonomousCarry'
    ].includes(key)))
  throw new TypeError('Only fixture, scenario, ticks, globalResponse, autonomousActions and autonomousCarry allowed');
 if(Object.hasOwn(request,'autonomousActions')&&request.autonomousActions!==true)
  throw new TypeError('Autonomous action trial must be explicit true only');
 // C3.2b stays opt-in, experimental and outside official scoring.
 if(Object.hasOwn(request,'autonomousCarry')&&(
    request.autonomousCarry!==true||request.autonomousActions!==true))
  throw new TypeError('Physical carry requires explicit autonomousActions and autonomousCarry true');
 const {fixture,scenario,ticks}=request;
 if(!Number.isSafeInteger(ticks)||ticks<1||ticks>600)
  throw new RangeError('Fixture physics run requires 1..600 ticks');
 const R=await initializeRapier(wasm);
 const opts={...(Object.hasOwn(request,'globalResponse')?
  {globalResponse:request.globalResponse}:{}),
  ...(request.autonomousActions===true?{autonomousActions:true}:{}),
  ...(request.autonomousCarry===true?{autonomousCarry:true}:{})};
 const session=createPhysicalFixtureStepRuntime(R,fixture,scenario,opts);
 const hash=createHash('sha256');
 // Independent diagnostic action-provenance digest; never official scoring.
 const actionAuditHash=createHash('sha256');
 let started=0,ended=0,activeFrames=0,last,actionCount=0;
 let completedPhysicalWindows=0,lastClosedActionTick=null;
 const actionTypes={pass:0,shot:0,clearance:0,
  ...(request.autonomousCarry===true?{carry:0}:{})};
 try{
  for(let n=0;n<ticks;n++){
   last=session.step();
   const contacts=last.physicalContactFeed;
   const decision=last.contactDecisionObservation;
   if(contacts.physicsTick!==last.physicsTick||
      contacts.officialMatchAction!==false||
      contacts.officialMatchPossession!==false||
      decision?.physicsTick!==last.physicsTick||
      decision.duties.length!==22||
      decision.actionPolicyConnected!==(request.autonomousActions===true)||
      decision.footballActionExecuted!==(last.localAutonomousAction!==null)||
      ['started','active','ended'].some(phase=>
       decision[phase].length!==contacts[phase].length||
       decision[phase].some((p,i)=>
        p.engineId!==contacts[phase][i].engineId)))
    throw new Error('Untrusted physical shoe/duty join');
   const proximity=last.physicalCarryProximity;
   if(proximity?.physicsTick!==last.physicsTick||
      proximity.fixtureId!==last.fixtureId||
      proximity.readOnly!==true||
      proximity.ballControlConfirmed!==null||
      proximity.dribbleConfirmed!==null||
      proximity.officialMatchResult!==null||
      !Number.isSafeInteger(proximity.measuredWindows))
    throw new Error('Untrusted same-world read-only player-ball gap measurement');
   const carryEvidence=last.physicalCarryContactSequence;
   if(carryEvidence?.physicsTick!==last.physicsTick||
      carryEvidence.fixtureId!==last.fixtureId||
      carryEvidence.readOnly!==true||
      carryEvidence.dribbleConfirmed!==null||
      carryEvidence.officialMatchResult!==null||
      !Number.isSafeInteger(carryEvidence.verifiedGroundCarryRecontacts)||
      carryEvidence.verifiedGroundCarryRecontacts<0)
    throw new Error('Untrusted independent physical carry/recontact evidence');
   const carryIntent=decision.carryPursuit??null;
   if(carryIntent&&(request.autonomousCarry!==true||
      carryIntent.physicalShoeEndTick!==null&&(
       !Number.isSafeInteger(carryIntent.physicalShoeEndTick)||
       carryIntent.physicalShoeEndTick>=last.physicsTick)))
    throw new Error('Untrusted physical shoe-END gated pursuit');
   const physical=last.physicalActionOutcome;
   if(physical?.physicsTick!==last.physicsTick||
      physical.fixtureId!==last.fixtureId||
      physical.latestExecutedAction!==last.localAutonomousAction||
      physical.officialMatchResult!==null||
      physical.actionSuccessAdjudicated!==false)
    throw new Error('Untrusted real-Rapier provisional action outcome');
   if(physical.lastCompleted&&
      physical.lastCompleted.actionTick!==lastClosedActionTick){
    if(physical.lastCompleted.terminal!==true||
       physical.lastCompleted.passCompleted!==null||
       physical.lastCompleted.goalScored!==null)
     throw new Error('Provisional outcome cannot certify football success');
    lastClosedActionTick=physical.lastCompleted.actionTick;
    completedPhysicalWindows++;
   }
   const action=last.localAutonomousAction;
   if(action){
    if(action.tick!==last.physicsTick||
       !contacts.started.some(p=>p.engineId===action.playerId)||
       contacts.started.length!==1||contacts.active.length!==1||
       contacts.active[0].engineId!==action.playerId||
       action.appliedByRapier!==true||action.officialMatchAction!==false||
       !Object.hasOwn(actionTypes,action.action))
     throw new Error('Untrusted physics action without real shoe contact');
    actionTypes[action.action]++;
    actionCount++;
   }
   started+=contacts.started.length;
   ended+=contacts.ended.length;
   if(contacts.active.length)activeFrames++;
   hash.update(last.canonicalBall);
   hash.update('|');
   hash.update(contacts.started.map(p=>p.engineId).join(','));
   hash.update('|');
   hash.update(contacts.ended.map(p=>p.engineId).join(','));
   hash.update('\n');
   actionAuditHash.update(JSON.stringify({
    fixtureId:last.fixtureId,tick:last.physicsTick,
    shoeStarts:contacts.started.map(p=>[p.engineId,p.team,p.clubId]),
    shoeActive:contacts.active.map(p=>[p.engineId,p.team,p.clubId]),
    matchedDuties:decision.started.map(p=>[p.engineId,p.team,p.movementDuty,p.contactTick]),
    action:action?[action.tick,action.playerId,action.team,action.action,
     action.recipientId,action.impulseNs,action.decisionContext.rule]:null,
    physicalAftermath:physical.lastCompleted?[
     physical.lastCompleted.actionTick,physical.lastCompleted.observedThroughTick,
     physical.lastCompleted.ballTravelSinceImpulseM,
     physical.lastCompleted.opponentShoeStarts,
     physical.lastCompleted.intendedRecipientShoeStartObserved]:null
   })+'\n');
  }
  process.stdout.write(JSON.stringify({
   schemaVersion:1,
   version:last.version,
   fixtureId:last.fixtureId,
   elapsedSeconds:last.elapsedSeconds,
   ticks:last.physicsTick,
   globalResponse:last.globalResponse,
   physicalRapierStep:true,
   physicalContactFeedVersion:last.physicalContactFeed.version,
   contactDecisionObservationVersion:last.contactDecisionObservation.version,
   autonomousMovementAssignments:22,
   contactMatchedToAutonomousDuties:true,
   actionPolicyConnected:request.autonomousActions===true,
   ...(request.autonomousCarry===true?{
    autonomousCarryMode:true,
    physicalCarryDiagnostics:{
     schemaVersion:1,
     evidenceSource:'real-rapier-shoe-start-end-and-bounded-impulse',
     readOnly:true,
     firstCarryImpulses:last.physicalCarryContactSequence.authenticatedCarryImpulses,
     verifiedGroundCarryRecontacts:last.physicalCarryContactSequence.verifiedGroundCarryRecontacts,
     interruptedCarryAttempts:last.physicalCarryContactSequence.interruptedCarryAttempts,
     latestVerifiedGroundCarryRecontact:last.physicalCarryContactSequence.latestVerifiedGroundCarryRecontact,
     measuredProximityWindows:last.physicalCarryProximity.measuredWindows,
     interruptedProximityWindows:last.physicalCarryProximity.interruptedWindows,
     latestMeasuredProximityWindow:last.physicalCarryProximity.latestMeasuredWindow,
     proximityInterruptionReasons:last.physicalCarryProximity.interruptionReasons,
     latestInterruptedProximityWindow:last.physicalCarryProximity.latestInterruptedWindow,
     dribbleConfirmed:null,officialMatchResult:null
    }
   }:{}),
   localAutonomousActionCount:actionCount,
   localAutonomousActionTypes:actionTypes,
   physicalActionOutcomeVersion:last.physicalActionOutcome.version,
   provisionalObservationWindowTicks:last.physicalActionOutcome.observationWindowTicks,
   completedPhysicalActionObservationWindows:completedPhysicalWindows,
   lastObservedPhysicalAction:last.physicalActionOutcome.lastCompleted,
   actionSuccessAdjudicated:false,
   localFootballActionTrial:request.autonomousActions===true,
   footballActionExecuted:actionCount>0,
   contactMapping:'temporary-fixture-clubs-only',
   playerCount:last.playerCount,
   playersPerTeam:last.temporarySquad.playersPerTeam,
   temporaryPlayerSource:last.temporarySquad.source,
   homeClubId:last.temporarySquad.homeClubId,
   awayClubId:last.temporarySquad.awayClubId,
   statsHomogeneous:last.temporarySquad.statsHomogeneous,
   neutralAttributeValue:last.temporarySquad.attributeValue,
   physicalMovementUniform:last.temporarySquad.physicalMovementUniform,
   ratingsAppliedToPhysics:false,generatedPlayersUsed:false,
   fixtureCalendarVerified:false,rosterBound:false,
   productionScoringConnected:false,
   officialMatchResult:null,
   scoreAuthority:last.scoreAuthority,
   realFootStarts:started,
   realFootEnds:ended,
   activeShoeFrames:activeFrames,
   finalCanonicalBall:last.canonicalBall,
   canonicalPhysicalEvidenceSha256:hash.digest('hex'),
   localActionProvenanceSha256:actionAuditHash.digest('hex'),
   actionProvenanceSource:'real-rapier-shoe-duty-impulse-and-window',
   actionProvenanceIsOfficial:false
  })+'\n');
 }finally{session.dispose();}
}
main().catch(err=>{process.stderr.write(String(err.message)+'\n');process.exitCode=1;});
