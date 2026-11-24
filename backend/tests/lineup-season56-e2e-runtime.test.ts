import {readRewardSettlementManifest,projectFinalRewardEvidence,buildRewardManifest} from '../src/reward-settlement-evidence.ts';
import {planRewardSettlement} from '../src/reward-settlement-plan.mjs';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {readMatchDirectory} from '../src/public-match-directory.ts';
/** #613 FULL 56-day V2 authority on isolated local Worker D1.
 * Deliberately a single immutable-fixture test. Never reset the user's world.
 * Runs the real protected day writer, archive and close, with no legacy score.
 */
import {beforeAll,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {prepareSeason} from '../src/commands.ts';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {advanceAdministrativeClockLineupV1} from '../src/admin-calendar-clock-lineup-v1.ts';
import {completeConfirmationEvent} from '../src/admin-calendar-confirm.ts';
import {stageDomesticCalendar} from '../src/admin-domestic-stage.ts';
import {executeInternationalDraw} from '../src/admin-international-draw.ts';
import {publishInternationalCalendarLineupV1} from '../src/admin-calendar-publish-lineup-v1.ts';
import {executeLineupLifecycleV1} from '../src/lineup-lifecycle-command.ts';
import {archiveSeasonLineupV1} from '../src/season-archive-command-lineup-v1.ts';
import {closeSeasonLineupV1} from '../src/season-close-command-lineup-v1.ts';
import {readSeasonTwoCandidate} from '../src/season-two-candidate-read.ts';
import {approveSeasonTwoSnapshot} from '../src/season-two-approval-command.ts';
import {prepareSeasonTwo} from '../src/season-two-prepare-command.ts';
import {verifyLineupSeasonArchiveV1} from '../src/lineup-season-archive-proof.ts';
import {loadSeasonSportingEvidence} from '../src/season-sporting-evidence.ts';
import {replayLineupSeasonV1} from '../src/lineup-season-replay.ts';
import {planLineupSportingDayV1} from '../src/lineup-sporting-day-plan.ts';
import {readClosedSeasonHistory} from '../src/season-archive-read.ts';
import {readPublicSportingSeasonLineupV1} from '../src/public-sporting-read-lineup-v1.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import type {AdminSession} from '../src/auth.ts';

const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000);
type World=Awaited<ReturnType<typeof readWorld>>;
const count=async(table:string):Promise<number>=>{
 const row=await db.prepare('SELECT COUNT(*) AS n FROM '+table).first() as {n:number}|null;
 if(!row)throw Error('Missing '+table);
 return row.n;
};
beforeAll(async()=>applyD1Migrations(db,bindings.TEST_MIGRATIONS));

it('#613 finalizes full V2 season (56 days, 4082 receipts, 54 ties), archives and closes with atomic rollback',async()=>{
 await clearTestWorld(db);
 const session:AdminSession=(await seedUnifiedOperator(
  db,'lineup-fullseason-qa','lineup-fullseason@example.invalid',now,'8'.repeat(64)
 )).session;
 let world:World=await readWorld(db);
 const command=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
 const advance=async(next:Promise<{world:World}>)=>{world=(await next).world;};

 await advance(prepareSeason(db,session,command(),'lineup-season-prepare-0001',
  await loadApprovedSnapshot(),now));
 await advance(initializeAdministrativeEvents(db,session,command(),
  'lineup-season-events-0001',now));
 await advance(advanceAdministrativeClockLineupV1(db,session,'start',command(),
  'lineup-season-admin-start-0001',now));
 for(const eventId of ['domestic:entrants','international:entrants']){
  await advance(completeConfirmationEvent(db,session,{...command(),eventId},
   'lineup-season-confirm-'+eventId,now));
 }
 await advance(advanceAdministrativeClockLineupV1(db,session,'advance',command(),
  'lineup-season-admin-day2-0001',now));
 await advance(stageDomesticCalendar(db,session,command(),
  'lineup-season-domestic-0001',now));
 await advance(advanceAdministrativeClockLineupV1(db,session,'advance',command(),
  'lineup-season-admin-day3-0001',now));
 await advance(executeInternationalDraw(db,session,command(),
  'lineup-season-draw-0001',now));
 await advance(publishInternationalCalendarLineupV1(db,session,command(),
  'lineup-season-publish-0001',now));
 expect(world.day).toBe(3);
 const rewardPin={rewardVersion:'draft-5',configVersion:'synthetic-776'};
 await expect(readRewardSettlementManifest(db,rewardPin)).rejects.toMatchObject({code:'reward_payday_required'});
 expect(await count('season_lineup_day_outcomes')).toBe(3);
 expect(await count('match_lineup_result_receipts')).toBe(0);

 const milestones=await db.prepare(
  "SELECT event_id,status,scheduled_day FROM season_admin_events WHERE scope='season' ORDER BY event_order"
 ).all() as {results:{event_id:string;status:string;scheduled_day:number}[]};
 expect(milestones.results.map(e=>e.event_id)).toEqual([
  'season:archive','season:close','season:next-prepare'
 ]);
 expect(milestones.results.every(e=>e.status==='scheduled'&&e.scheduled_day===56)).toBe(true);

 let lastBatchError='';
 const boundStatements=new WeakMap<object,{sql:string;args:unknown[]}>();
 const guardStart='INSERT INTO world_state(id,generation) SELECT 2,? WHERE NOT EXISTS(';
 const tracedDb={
  prepare:(sql:string)=>{
   const stmt=db.prepare(sql);
   return {
    bind:(...args:unknown[])=>{
     const bound=stmt.bind(...args);
     boundStatements.set(bound,{sql,args});
     return bound;
    },
    first:(...args:any[])=>stmt.first(...args),
    all:(...args:any[])=>stmt.all(...args),
    run:(...args:any[])=>stmt.run(...args)
   };
  },
  batch:async(statements:any[])=>{
   try{return await db.batch(statements)}
   catch(error){
    const failedGuards:{index:number;query:string;params:string[]}[]=[];
    for(let i=0;i<statements.length;i++){
     const item=boundStatements.get(statements[i]);
     if(!item||!item.sql.startsWith(guardStart))continue;
     const query=item.sql.slice(guardStart.length,-1);
     const args=item.args.slice(1);
     try{
      const found=await db.prepare(query).bind(...args).first();
      if(!found)failedGuards.push({index:i,query:query.slice(0,450),
       params:args.map(x=>String(x).slice(0,70))});
     }catch(readError){failedGuards.push({index:i,query:'read failed '+String(readError),
       params:[]})}
    }
    lastBatchError=String(error)+'; failing source guards='+JSON.stringify(failedGuards.slice(0,8));
    throw error;
   }
  }
 } as any;
 for(let day=4;day<=56;day++){
  let result:{world:World};
  try{
   result=await executeLineupLifecycleV1(
    tracedDb,session,'advance',command(),'lineup-season-sport-day-'+day+'-0001',now
   );
  }catch(error){
   // This branch runs only when the real protected writer rejected a day.
   // Independently replay and plan that exact day for actionable diagnostics
   // WITHOUT mutating any persisted receipt or suppressing the failure.
   let diagnostic='planner succeeded, investigate atomic batch/SQL guards';
   try{
    const evidence=await loadSeasonSportingEvidence(db,world);
    const prefix=await replayLineupSeasonV1(db,world,evidence,world.day);
    await planLineupSportingDayV1(db,world,prefix.progression,
     evidence.calendar.calendar_hash,now);
   }catch(sourceError){diagnostic=String(sourceError)}
   throw new Error('V2 full-season day '+day+' failed: '+String(error)+'; '+diagnostic+'; D1 batch='+lastBatchError);
  }
  world=result.world;
  expect(world.day).toBe(day);
  if(day===28){
   const beforeReward=await readWorld(db);
   // Fault injection at the read boundary only: do not change official rows.
   const corruptConfirmationDb={
    prepare:(sql:string)=>{
     const statement=db.prepare(sql);
     if(!sql.includes("event_id IN ('domestic:entrants','international:entrants')"))return statement;
     return {bind:(...args:unknown[])=>({all:async()=>{
      const result=await statement.bind(...args).all();
      return {...result,results:result.results.map((row:any)=>row.event_id==='domestic:entrants'
       ?{...row,receipt_hash:'0'.repeat(64)}:row)};
     }})};
    },
    batch:(statements:any[])=>db.batch(statements)
   } as any;
   await expect(readRewardSettlementManifest(corruptConfirmationDb,rewardPin))
    .rejects.toMatchObject({code:'reward_evidence_invalid'});
   const first=await readRewardSettlementManifest(db,rewardPin);
   expect(first.manifest.plan).toMatchObject({day:28,totalArc:676800,endingHoldArc:1723200});
   expect(first.manifest.plan.rows).toHaveLength(304);
   expect(first.manifest.manifestHash).toMatch(/^[a-f0-9]{64}$/);
   expect(await buildRewardManifest(first.manifest.plan,rewardPin.configVersion)).toEqual(first.manifest);
   expect((await buildRewardManifest(first.manifest.plan,'another-synthetic-version')).manifestHash).not.toBe(first.manifest.manifestHash);
   expect(await readWorld(db)).toEqual(beforeReward);
   expect(await count('economic_transactions')).toBe(0);
   await expect(readRewardSettlementManifest(db,{...rewardPin,rewardVersion:'draft-4'})).rejects.toMatchObject({code:'reward_evidence_invalid'});
  }
  if([12,13,30,43,55,56].includes(day)){
   const receiptCount=await count('match_lineup_result_receipts');
   expect(receiptCount).toBeGreaterThanOrEqual(day===13?128:0);
   expect(await count('season_lineup_day_outcomes')).toBe(day);
  }
 }
 expect(world.phase).toBe('active');
 expect(await count('season_lineup_day_outcomes')).toBe(56);
 expect(await count('match_lineup_result_receipts')).toBe(4082);
 expect(await count('season_knockout_ties')).toBe(54);
 expect(await count('season_day_outcomes')).toBe(0);

 const proof=await verifyLineupSeasonArchiveV1(db,world);
 expect(proof.history.resultCount).toBe(4082);
 expect(proof.history.progression.results.size).toBe(4082);
 expect(proof.history.progression.ties.size).toBe(54);
 expect(proof.summaryHash).toMatch(/^[a-f0-9]{64}$/);
 // Exercise the actual Day56 server entrypoint, independently comparing its
 // evidence digest and allocations against the archive proof used below.
 const beforeFinalReward=await readWorld(db);
 const certifiedFinal=await readRewardSettlementManifest(db,rewardPin);
 const confirmationRows=(await db.prepare(
  "SELECT scope,receipt_hash FROM season_admin_events WHERE season_number=? AND event_id IN ('domestic:entrants','international:entrants') ORDER BY event_id"
 ).bind(world.seasonNumber).all()).results as {scope:string;receipt_hash:string}[];
 const expectedEvidenceHash=await canonicalHash({
  schemaVersion:1,generation:world.generation,season:world.seasonNumber,day:56,
  participantsHash:proof.evidence.snapshot.participantsHash,rulesHash:proof.evidence.snapshot.rulesHash,
  calendarHash:proof.evidence.calendar.calendar_hash,
  entrantReceipts:confirmationRows.map(row=>({scope:row.scope,receiptHash:row.receipt_hash})),
  dayHashes:proof.history.days.map(day=>day.hash),resultCount:proof.history.resultCount,
  archiveHash:proof.archiveHash
 });
 expect(certifiedFinal.worldRevision).toBe(world.revision);
 expect(certifiedFinal.manifest.plan.evidenceHash).toBe(expectedEvidenceHash);
 expect(await readWorld(db)).toEqual(beforeFinalReward);
 const finalProjection=await projectFinalRewardEvidence(proof);
 const finalPlan=planRewardSettlement({generation:world.generation,season:world.seasonNumber,day:56,
  rewardVersion:rewardPin.rewardVersion,evidenceHash:expectedEvidenceHash,competitions:finalProjection});
 const finalManifest=await buildRewardManifest(finalPlan,rewardPin.configVersion);
 expect(certifiedFinal.manifest).toEqual(finalManifest);
 expect(finalManifest.plan).toMatchObject({totalArc:1723200,startingHoldArc:1723200,endingHoldArc:0});
 expect(finalManifest.plan.rows).toHaveLength(912);
 expect(finalProjection.filter(c=>c.competitionId.startsWith('int-')).every(c=>c.outcomes?.length===24)).toBe(true);
 expect(await count('economic_transactions')).toBe(0);
 const sourceSummary=JSON.parse(proof.summaryJson);
 expect(sourceSummary.sourceSeason).toBe(1);
 expect(sourceSummary.divisions).toHaveLength(16);
 expect(sourceSummary.cupWinners).toHaveLength(2);
 expect(sourceSummary.statisticsAvailability).toBe('frozen-player-receipts-v1');
 expect(sourceSummary.playerStatistics).toEqual([]); // all clubs use team fallback

 // Closing cannot skip the independent archive milestone.
 await expect(closeSeasonLineupV1(db,session,command(),
  'lineup-season-too-early-close-0001',now)).rejects.toMatchObject({status:409});
 expect(await count('season_archives')).toBe(0);
 const before=world,archiveCommand=command();
 await db.prepare(
  "CREATE TRIGGER fail_v2_archive_late BEFORE INSERT ON admin_operations WHEN NEW.command='archive-season-v2' BEGIN SELECT RAISE(ABORT,'archive fault'); END"
 ).run();
 try{
  await expect(archiveSeasonLineupV1(db,session,archiveCommand,
   'lineup-season-archive-0001',now)).rejects.toMatchObject({status:503});
 }finally{await db.prepare('DROP TRIGGER fail_v2_archive_late').run()}
 expect(await readWorld(db)).toEqual(before);
 expect(await count('season_archives')).toBe(0);
 expect(await count('season_archive_summaries')).toBe(0);

 const archived=await archiveSeasonLineupV1(db,session,archiveCommand,
  'lineup-season-archive-0001',now);
 world=archived.world;
 expect(world.day).toBe(56);
 expect(world.phase).toBe('active');
 expect(await archiveSeasonLineupV1(db,session,archiveCommand,
  'lineup-season-archive-0001',now)).toEqual(archived);
 expect(await count('season_archives')).toBe(1);
 expect(await count('season_archive_summaries')).toBe(1);
 await expect(readClosedSeasonHistory(db,1)).rejects.toMatchObject({status:409});
 const archivedRow=await db.prepare(
  'SELECT archive_hash,results_count,days_count,ties_count FROM season_archives WHERE season_number=1'
 ).first() as {archive_hash:string;results_count:number;days_count:number;ties_count:number}|null;
 expect(archivedRow).toMatchObject({
  archive_hash:proof.archiveHash,results_count:4082,days_count:56,ties_count:54
 });
 const closeCommand=command();
 const closed=await closeSeasonLineupV1(db,session,closeCommand,
  'lineup-season-close-0001',now);
 world=closed.world;
 expect(world.phase).toBe('closed');
 expect(world.day).toBe(56);
 await expect(readRewardSettlementManifest(db,rewardPin)).rejects.toMatchObject({code:'reward_payday_required'});
 expect(await closeSeasonLineupV1(db,session,closeCommand,
  'lineup-season-close-0001',now)).toEqual(closed);
 const history=await readClosedSeasonHistory(db,1);
 expect(history.archiveHash).toBe(proof.archiveHash);
 expect(history.summary).toEqual(sourceSummary);
 const sport=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
 expect(sport.status).toBe('available');
 expect(sport.data.fixtures.every((fixture:any)=>fixture.result!==null)).toBe(true);
 expect(sport.data.fixtures).toHaveLength(242); // 240 league + 2 Tier-1 playout legs
 expect(sport.data.statistics.matchesPlayed).toBe(242);
 expect(sport.data.statistics.players,'fallback-only archive has no attributed players').toEqual([]);
 expect(sport.data.history.statistics).toEqual(sport.data.statistics);
 expect(await count('season_day_outcomes')).toBe(0);
 expect(await count('match_lineup_result_receipts')).toBe(4082);
 // V2 cutover includes the qualification authority feeding the *next* season.
 // The Season 2 candidate MUST be derived from frozen results, never rescore
 // the previous season with temporary-score-v1.
 const candidate=await readSeasonTwoCandidate(db);
 expect(candidate.sourceArchiveHash).toBe(proof.archiveHash);
 expect(candidate.snapshot.season).toBe(2);
 expect(candidate.snapshot.readyForActivation).toBe(false);
 const approved=await approveSeasonTwoSnapshot(db,session,{
  ...command(),snapshotHash:candidate.snapshot.snapshotHash
 },'lineup-season2-approval-0001',now);
 world=approved.world;
 const prepared=await prepareSeasonTwo(db,session,command(),
  'lineup-season2-prepare-0001',now);
 world=prepared.world;
 expect(world).toMatchObject({seasonNumber:2,day:0,phase:'preparing'});
 const finals=await readMatchDirectory(db,1,54);
 expect(finals.publication).toBe('published');
 expect(finals.fixtures).toContainEqual(expect.objectContaining({competitionId:'int-1',phaseId:'final',status:'completed'}));
 const historical=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
 expect(historical.data.statistics.matchesPlayed).toBe(242);
 expect(await count('season_day_outcomes')).toBe(0);
 expect(await count('season_lineup_day_outcomes')).toBe(56);
 // After owner approval and Season 2 preparation, the same replacement V2
 // commands must publish and finalize real Season 2 matches. No Season 1
 // re-simulation or history mutation is permitted during this transition.
 await advance(initializeAdministrativeEvents(db,session,command(),
  'lineup-season2-events-0001',now));
 await advance(advanceAdministrativeClockLineupV1(db,session,'start',command(),
  'lineup-season2-admin-start-0001',now));
 for(const eventId of ['domestic:entrants','international:entrants']){
  await advance(completeConfirmationEvent(db,session,{...command(),eventId},
   'lineup-season2-confirm-'+eventId,now));
 }
 await advance(advanceAdministrativeClockLineupV1(db,session,'advance',command(),
  'lineup-season2-admin-day2-0001',now));
 await advance(stageDomesticCalendar(db,session,command(),
  'lineup-season2-domestic-0001',now));
 await advance(advanceAdministrativeClockLineupV1(db,session,'advance',command(),
  'lineup-season2-admin-day3-0001',now));
 await advance(executeInternationalDraw(db,session,command(),
  'lineup-season2-draw-0001',now));
 await advance(publishInternationalCalendarLineupV1(db,session,command(),
  'lineup-season2-publish-0001',now));
 expect(world).toMatchObject({seasonNumber:2,phase:'active',day:3});
 for(let day=4;day<=13;day++){
  world=(await executeLineupLifecycleV1(db,session,'advance',command(),
   'lineup-season2-sport-day-'+day+'-0001',now)).world;
  expect(world.day).toBe(day);
 }
 const seasonTwo=await readPublicSportingSeasonLineupV1(db,'IT-1',2) as any;
 expect(seasonTwo.data.statistics.matchesPlayed).toBe(8);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM season_lineup_day_outcomes WHERE season_number=2')
  .first() as {n:number}).n).toBe(13);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM match_lineup_result_receipts WHERE season_number=2')
  .first() as {n:number}).n).toBe(128);
 const oldSeason=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
 expect(oldSeason.data.statistics.matchesPlayed).toBe(242);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM match_lineup_result_receipts WHERE season_number=1')
  .first() as {n:number}).n).toBe(4082);
},600000);
