/** #613 — official V2-only authenticated archive command.
 * Exactly 56 verified days and 4,082 frozen match receipts are required;
 * current player affiliations never alter archived statistics.
 */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parsePrepareRequest,parseIdempotencyKey,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {verifyLineupSeasonArchiveV1} from './lineup-season-archive-proof.ts';
import {canArchiveAtTerminalMilestone} from './domain/calendar/terminal-milestone-policy.ts';

export async function archiveSeasonLineupV1(
 db:Database,session:AdminSession,input:PrepareRequest,keyInput:string,now:number
):Promise<Outcome>{
 const command=parsePrepareRequest(input),key=parseIdempotencyKey(keyInput);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'archive_unavailable');
 const requestHash=await hashText(JSON.stringify({
  command:'archive-season-v2',actor:session.actor.id,...command
 }));
 const previous=await replay(db,session,command,key,requestHash,now);
 if(previous)return previous;
 const world=await readWorld(db);
 if(world.generation!==command.expectedGeneration||
  world.revision!==command.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.phase!=='active'||world.day!==56||![1,2].includes(world.seasonNumber)||
  world.revision===Number.MAX_SAFE_INTEGER)
  throw new ApiError(409,'archive_prerequisites');
 const proof=await verifyLineupSeasonArchiveV1(db,world);
 const pending=(await db.prepare(
  "SELECT count(*) AS n FROM season_admin_events WHERE season_number=? AND status='scheduled' AND scope<>'season'"
 ).bind(world.seasonNumber).first<{n:number}>())?.n;
 const milestone=await db.prepare(
  "SELECT event_order,status FROM season_admin_events WHERE season_number=? AND event_id='season:archive' AND kind='archive-season' AND scope='season' AND scheduled_day=56"
 ).bind(world.seasonNumber).first<{event_order:number;status:string}>();
 if(pending!==0||!canArchiveAtTerminalMilestone(milestone))
  throw new ApiError(409,'archive_prerequisites');
 const result:Outcome={
  operationId:crypto.randomUUID(),world:{...world,revision:world.revision+1}
 };
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,
    'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=? AND phase=? AND day=56',
    [world.generation,world.revision,world.seasonNumber,'active']),
   ...proof.guards,
   abortUnless(db,
    "SELECT 1 WHERE (SELECT COUNT(*) FROM season_admin_events WHERE season_number=? AND status='scheduled' AND scope<>'season')=0",
    [world.seasonNumber]),
   abortUnless(db,
    "SELECT 1 FROM season_admin_events WHERE season_number=? AND event_id='season:archive' AND kind='archive-season' AND scope='season' AND scheduled_day=56 AND event_order=? AND status='scheduled' AND receipt_hash IS NULL",
    [world.seasonNumber,milestone.event_order]),
   abortUnless(db,
    'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM season_archives WHERE season_number=?)',
    [world.seasonNumber]),
   abortUnless(db,
    'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM season_archive_summaries WHERE season_number=?)',
    [world.seasonNumber]),
   db.prepare('INSERT INTO season_archives VALUES(?,?,?,?,?,?,?,?,?,?)').bind(
    world.seasonNumber,world.generation,proof.evidence.calendar.calendar_hash,
    proof.resultsHash,proof.knockoutHash,proof.archiveHash,4082,56,54,now),
   db.prepare('INSERT INTO season_archive_summaries(season_number,generation,archive_hash,summary_hash,summary_json,created_at) VALUES(?,?,?,?,?,?)')
    .bind(world.seasonNumber,world.generation,proof.archiveHash,
     proof.summaryHash,proof.summaryJson,now),
   db.prepare("UPDATE season_admin_events SET status='completed',completed_at=?,receipt_hash=? WHERE season_number=? AND event_id='season:archive' AND status='scheduled'")
    .bind(now,proof.archiveHash,world.seasonNumber),
   db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?')
    .bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(result.operationId,world.generation,key,requestHash,session.actor.id,
     'archive-season-v2',world.revision,result.world.revision,JSON.stringify(result),now)
  ]);
  return result;
 }catch{
  const winner=await replay(db,session,command,key,requestHash,now);
  if(winner)return winner;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)
   throw new ApiError(409,'stale_world');
  throw new ApiError(503,'archive_unavailable');
 }
}
