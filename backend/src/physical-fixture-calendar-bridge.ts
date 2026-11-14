/** ME-PB-54 / A1.3b.1 — read-only *persisted* fixture authority bridge.
 * Reconstruct real current-season schedule from D1 owner-approved evidence,
 * verify due-day membership AND world revision before trusting a fixture.
 * No endpoint, scoring, DB mutation, roster claim or match-result rewrite.
 */
import type {Database} from './database.ts';
import {ApiError} from './errors.ts';
import {readWorld} from './world-repository.ts';
import {loadSeasonSportingEvidence} from './season-sporting-evidence.ts';
import {requireGeneratedSchedule} from './initial-schedule.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {createPhysicalFixtureStepRuntime}
 from '../../match-engine/src/physical-fixture-step-runtime.mjs';

export const PHYSICAL_FIXTURE_CALENDAR_BRIDGE_VERSION=
 'me-pb-54-persisted-due-fixture-bridge-v1';

const invalid=()=>new ApiError(422,'physical_fixture_unavailable');
const stale=()=>new ApiError(409,'stale_world');
const worldEqual=(a:Readonly<{
 generation:string;revision:number;seasonNumber:number;
 day:number;phase:string
}>,b:Readonly<{
 generation:string;revision:number;seasonNumber:number;
 day:number;phase:string
}>)=>
 a.generation===b.generation&&a.revision===b.revision&&
 a.seasonNumber===b.seasonNumber&&a.day===b.day&&a.phase===b.phase;

export async function readDuePhysicalFixture(
 db:Database,fixtureId:string,expectedRevision:number
){
 // A caller cannot assert approval, select an arbitrary season, or
 // construct its own signed schedule. We always read D1 & recompute.
 if(typeof fixtureId!=='string'||fixtureId.length>160||
    !/^season:[1-9][0-9]{0,6}:/.test(fixtureId)||
    !Number.isSafeInteger(expectedRevision)||expectedRevision<0)
  throw invalid();
 const before=await readWorld(db);
 if(before.revision!==expectedRevision)throw stale();
 if(before.phase!=='active'||before.day>=56)throw invalid();
 const verified=await loadSeasonSportingEvidence(db,before);
 requireGeneratedSchedule(verified.schedule,verified.snapshot);
 // By design only the signed *initial league phase* is available here.
 // Dynamic knockout fixtures are NOT present in initial schedule: fail closed.
 const matches=verified.schedule.fixtures.filter(f=>f.id===fixtureId);
 if(matches.length!==1||matches[0].day!==before.day+1)
  throw invalid();
 const f=matches[0],after=await readWorld(db);
 if(!worldEqual(before,after))throw stale();
 return Object.freeze({
  version:PHYSICAL_FIXTURE_CALENDAR_BRIDGE_VERSION,
  fixture:Object.freeze({
   id:f.id,competitionId:f.competitionId,marker:f.marker,day:f.day,
   round:f.round,homeClubId:f.homeClubId,awayClubId:f.awayClubId
  }),
  source:'server-reconstructed-owner-approved-persisted-season-calendar' as const,
  worldGeneration:before.generation,
  worldRevision:before.revision,
  seasonNumber:before.seasonNumber,
  currentDay:before.day,
  dueDay:f.day,
  evidence:Object.freeze({
   participantsHash:verified.snapshot.participantsHash,
   rulesHash:verified.snapshot.rulesHash,
   calendarHash:verified.calendar.calendar_hash
  }),
  fixtureCalendarVerifiedAtRevision:true,
  schedulePhase:'initial-league-only' as const,
  rosterBound:false,
  rosterSource:'homogeneous-temporary-actors' as const,
  provisionalSquadOnly:true,
  provisionalAttributeValue:50,
  generatedPlayersUsed:false,
  matchResultsAuthorized:false,
  officialMatchResult:null,
  scoreAuthority:'external-temporary-score-v1' as const,
  remotePersistence:false
 });
}

/** Bind the verified D1 due fixture to the *same* A1.3a Rapier producer.
 * This opt-in read-only procedure is not wired to lifecycle or HTTP routes.
 * It consumes genuine physics, but never confers roster/scoring authority.
 */
export async function runDuePhysicalFixtureWindow(
 db:Database,RAPIER:unknown,fixtureId:string,expectedRevision:number,
 scenario:unknown,ticks:number,options:{globalResponse?:number}={}
){
 if(!Number.isSafeInteger(ticks)||ticks<1||ticks>600)throw invalid();
 if(!options||typeof options!=='object'||Array.isArray(options)||
    Reflect.ownKeys(options).some(k=>k!=='globalResponse'))throw invalid();
 const receipt=await readDuePhysicalFixture(db,fixtureId,expectedRevision);
 const runtime=createPhysicalFixtureStepRuntime(
  RAPIER,receipt.fixture,scenario,options
 );
 try{
  const frames=runtime.advance(ticks);
  const last=frames.at(-1);
  if(!last||last.fixtureId!==receipt.fixture.id||
     last.physicsTick!==ticks||last.physicalRapierStep!==true||
     last.officialMatchResult!==null||last.productionScoringConnected!==false)
   throw new Error('Unexpected physical-only fixture runner evidence');
  // Re-check revision after computation, before returning any evidence.
  const after=await readWorld(db);
  if(!worldEqual({
   generation:receipt.worldGeneration,revision:receipt.worldRevision,
   seasonNumber:receipt.seasonNumber,day:receipt.currentDay,phase:'active'
  },after))throw stale();
  const trace=frames.map(f=>{
   const contact=f.physicalContactFeed;
   const decision=f.contactDecisionObservation;
   if(contact?.physicsTick!==f.physicsTick||
      contact.fixtureId!==receipt.fixture.id||
      contact.officialMatchAction!==false||
      contact.officialMatchPossession!==false||
      contact.officialGoalEvidence!==false||
      decision?.physicsTick!==f.physicsTick||
      decision.fixtureId!==receipt.fixture.id||
      decision.duties.length!==22||
      decision.footballActionExecuted!==false||
      decision.productionScoringConnected!==false||
      (['started','active','ended'] as const).some(phase=>
       decision[phase].length!==contact[phase].length||
       decision[phase].some((p,i)=>
        p.engineId!==contact[phase][i].engineId||
        p.clubId!==contact[phase][i].clubId)))
    throw new Error('Untrusted fixture physical contact/duty observation');
   return Object.freeze({
    tick:f.physicsTick,ball:f.canonicalBall,
    started:contact.started.map(p=>p.engineId),
    ended:contact.ended.map(p=>p.engineId),
    active:contact.active.map(p=>p.engineId)
   });
  });
  const evidenceSha256=await canonicalHash(trace);
  // The digest is asynchronous; also enforce the exact world revision at
  // the final response boundary, not just before hashing starts.
  const finalWorld=await readWorld(db);
  if(!worldEqual({
   generation:receipt.worldGeneration,revision:receipt.worldRevision,
   seasonNumber:receipt.seasonNumber,day:receipt.currentDay,phase:'active'
  },finalWorld))throw stale();
  return Object.freeze({
   ...receipt,
   runtimeVersion:last.version,
   physicsTick:last.physicsTick,
   elapsedSeconds:last.elapsedSeconds,
   canonicalBall:last.canonicalBall,
   actualFootStarts:trace.reduce((sum,f)=>sum+f.started.length,0),
   actualFootEnds:trace.reduce((sum,f)=>sum+f.ended.length,0),
   physicalEvidenceSha256:evidenceSha256,
   realRapierRun:true,
   physicalContactFeedVersion:last.physicalContactFeed.version,
   contactDecisionObservationVersion:last.contactDecisionObservation.version,
   autonomousDutyContactMatched:true,
   footballActionPolicyConnected:false,
   physicalContactBoundToFixture:true,
   officialFootballActionsGenerated:false,
   temporarySquad:last.temporarySquad,
   uniformPlayerStats:true,
   generatedPlayersUsed:false,
   fixtureCalendarVerifiedAtRevision:true,
   rosterBound:false,
   matchResultsAuthorized:false,
   officialMatchResult:null
  });
 }finally{runtime.dispose();}
}
