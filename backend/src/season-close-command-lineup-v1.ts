/** #613: official V2-only protected season closure.
 * Independently verifies all 56 immutable sporting days and the archive hash
 * before advancing world_state to closed.
 */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parsePrepareRequest,parseIdempotencyKey,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {preparePayrollCalendarGuards} from './payroll-settlement-command.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {verifyLineupSeasonArchiveV1} from './lineup-season-archive-proof.ts';
import {canCloseArchivedSeason,type TerminalMilestoneRow} from './domain/calendar/terminal-milestone-policy.ts';
interface Archive {generation:string;archive_hash:string;calendar_hash:string;results_hash:string;knockout_hash:string;results_count:number;days_count:number;ties_count:number}
interface Summary {generation:string;archive_hash:string;summary_hash:string;summary_json:string}
export async function closeSeasonLineupV1(db:Database,session:AdminSession,input:PrepareRequest,keyInput:string,now:number):Promise<Outcome>{
 const cmd=parsePrepareRequest(input),key=parseIdempotencyKey(keyInput);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'close_unavailable');
 const requestHash=await hashText(JSON.stringify({command:'close-season-v2',actor:session.actor.id,...cmd}));
 const previous=await replay(db,session,cmd,key,requestHash,now);if(previous)return previous;
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.phase!=='active'||world.day!==56||world.revision===Number.MAX_SAFE_INTEGER)throw new ApiError(409,'close_prerequisites');
 // Independently replay the full immutable V2 chain, including the
 // final knockout plan, BEFORE trusting any row in season_archives.
 const rewardGuards=await preparePayrollCalendarGuards(db,world,56,true);
 const proof=await verifyLineupSeasonArchiveV1(db,world);
 const archive=await db.prepare('SELECT generation,archive_hash,calendar_hash,results_hash,knockout_hash,results_count,days_count,ties_count FROM season_archives WHERE season_number=?').bind(world.seasonNumber).first<Archive>();
 const summary=await db.prepare('SELECT generation,archive_hash,summary_hash,summary_json FROM season_archive_summaries WHERE season_number=?').bind(world.seasonNumber).first<Summary>();
 if(!archive||!summary||archive.generation!==world.generation||summary.generation!==world.generation||summary.archive_hash!==archive.archive_hash||
    archive.days_count!==56||archive.results_count!==4082||archive.ties_count!==54)throw new ApiError(409,'close_prerequisites');
 const digest=await canonicalHash({schemaVersion:1,season:world.seasonNumber,generation:world.generation,calendarHash:archive.calendar_hash,resultsHash:archive.results_hash,knockoutHash:archive.knockout_hash,resultsCount:4082,daysCount:56,tiesCount:54});
 let parsed:unknown;try{parsed=JSON.parse(summary.summary_json)}catch{throw new ApiError(422,'archive_invalid')}
 if(digest!==archive.archive_hash||archive.archive_hash!==proof.archiveHash||
  archive.results_hash!==proof.resultsHash||archive.knockout_hash!==proof.knockoutHash||
  archive.calendar_hash!==proof.evidence.calendar.calendar_hash||
  await canonicalHash(parsed)!==summary.summary_hash||
  summary.summary_hash!==proof.summaryHash||summary.summary_json!==proof.summaryJson)
  throw new ApiError(422,'archive_invalid');
 const events=(await db.prepare('SELECT event_id,kind,scope,scheduled_day,event_order,status,receipt_hash FROM season_admin_events WHERE season_number=? ORDER BY scheduled_day,event_order').bind(world.seasonNumber).all<TerminalMilestoneRow>()).results;
 if(!canCloseArchivedSeason(events,archive.archive_hash))throw new ApiError(409,'close_prerequisites');
 const result:Outcome={operationId:crypto.randomUUID(),world:{...world,phase:'closed',revision:world.revision+1}};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=? AND phase=\'active\' AND day=56',[world.generation,world.revision,world.seasonNumber]),
   ...rewardGuards,...proof.guards,
   abortUnless(db,'SELECT 1 FROM season_archives WHERE season_number=? AND generation=? AND archive_hash=? AND calendar_hash=? AND results_hash=? AND knockout_hash=? AND results_count=4082 AND days_count=56 AND ties_count=54',
    [world.seasonNumber,world.generation,archive.archive_hash,archive.calendar_hash,
     archive.results_hash,archive.knockout_hash]),
   abortUnless(db,'SELECT 1 FROM season_archive_summaries WHERE season_number=? AND generation=? AND archive_hash=? AND summary_hash=? AND summary_json=?',[world.seasonNumber,world.generation,archive.archive_hash,summary.summary_hash,summary.summary_json]),
   ...events.map(e=>abortUnless(db,'SELECT 1 FROM season_admin_events WHERE season_number=? AND event_id=? AND kind=? AND scope=? AND scheduled_day=? AND event_order=? AND status=? AND receipt_hash IS ?',[world.seasonNumber,e.event_id,e.kind,e.scope,e.scheduled_day,e.event_order,e.status,e.receipt_hash])),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_admin_events WHERE season_number=? AND status=\'scheduled\' AND event_id NOT IN (\'season:close\',\'season:next-prepare\'))=0',[world.seasonNumber]),
   db.prepare("UPDATE season_admin_events SET status='completed',completed_at=?,receipt_hash=? WHERE season_number=? AND event_id='season:close' AND status='scheduled'").bind(now,archive.archive_hash,world.seasonNumber),
   db.prepare("UPDATE world_state SET phase='closed',revision=revision+1 WHERE id=1 AND generation=? AND revision=?").bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(result.operationId,world.generation,key,requestHash,session.actor.id,'close-season-v2',world.revision,result.world.revision,JSON.stringify(result),now),
  ]);
  return result;
 }catch{
  const winner=await replay(db,session,cmd,key,requestHash,now);if(winner)return winner;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'close_unavailable');
 }
}
