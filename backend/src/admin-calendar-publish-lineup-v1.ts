/** Candidate replacement for the publication command. Not yet routed:
 * requires the V2-only Admin, read and archive cutover. No legacy score replay.
 */
/** Publish the complete immutable calendar only after independently persisted draws. */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parsePrepareRequest,parseIdempotencyKey,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {loadSeasonSnapshotAuthority} from './season-snapshot-authority.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {buildInitialSchedule,buildTrustedSeasonSchedule,isInitialScheduleVersion} from './initial-schedule.ts';
import {initialDrawOutcomes} from './initial-draws.ts';
import {planEmptyLineupPreseasonV1} from './lineup-preseason-evidence.ts';
import {dueAdministrativeMilestones,type MilestoneKind} from './domain/calendar/admin-calendar-policy.ts';
interface Stage {generation:string;algorithm_version:string;seed:string;participants_hash:string;rules_hash:string;fixtures_hash:string;fixtures_json:string}
interface Draw {competition_id:string;stage_id:string;algorithm_version:string;seed:string;outcome_hash:string;outcome_json:string}
interface Event {event_id:string;kind:MilestoneKind;scope:string;scheduled_day:number;event_order:number;status:'scheduled'|'completed';completed_at:number|null;receipt_hash:string|null}
export async function publishInternationalCalendarLineupV1(db:Database,session:AdminSession,input:PrepareRequest,keyInput:string,now:number):Promise<Outcome>{
 const cmd=parsePrepareRequest(input),key=parseIdempotencyKey(keyInput);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'calendar_event_unavailable');
 const hash=await hashText(JSON.stringify({command:'publish-international-calendar-v1',actor:session.actor.id,...cmd}));
 const saved=await replay(db,session,cmd,key,hash,now);if(saved)return saved;
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(![1,2].includes(world.seasonNumber)||world.phase!=='active'||world.day>=13||world.revision===Number.MAX_SAFE_INTEGER)throw new ApiError(409,'calendar_event_prerequisites');
 const rows=(await db.prepare(`SELECT * FROM season_admin_events WHERE season_number=${world.seasonNumber} ORDER BY scheduled_day,event_order`).all<Event>()).results;
 const events=rows.map(r=>({id:r.event_id,kind:r.kind,scope:r.scope,day:r.scheduled_day,order:r.event_order,status:r.status}));
 if(dueAdministrativeMilestones(events,world.day)[0]?.id!=='international:calendar'||events.some(e=>e.day<world.day&&e.status!=='completed'))throw new ApiError(409,'calendar_event_prerequisites');
 const stage=await db.prepare(`SELECT * FROM season_domestic_stages WHERE season_number=${world.seasonNumber}`).first<Stage>(),authority=await loadSeasonSnapshotAuthority(db,world),snapshot=authority.snapshot;
 if(!stage||stage.generation!==world.generation||stage.participants_hash!==snapshot.participantsHash||stage.rules_hash!==snapshot.rulesHash)throw new ApiError(422,'calendar_event_prerequisites');
 const stored=await db.prepare(`SELECT snapshot_json FROM seasons WHERE season_number=${world.seasonNumber}`).first<{snapshot_json:string}>();
 if(!stored||await canonicalHash(JSON.parse(stored.snapshot_json))!==await canonicalHash(snapshot))throw new ApiError(422,'calendar_event_prerequisites');
 if(!isInitialScheduleVersion(stage.algorithm_version))throw new ApiError(422,'calendar_event_prerequisites');
 const schedule=world.seasonNumber===1?await buildInitialSchedule(snapshot,stage.seed):await buildTrustedSeasonSchedule(snapshot,stage.seed,world.seasonNumber),domestic=schedule.fixtures.filter(f=>!f.competitionId.startsWith('int-'));
 if(stage.algorithm_version!==schedule.algorithmVersion||stage.fixtures_hash!==await canonicalHash(domestic)||await canonicalHash(JSON.parse(stage.fixtures_json))!==stage.fixtures_hash)throw new ApiError(422,'calendar_event_prerequisites');
 const expected=await initialDrawOutcomes(schedule,snapshot);
 const draws=(await db.prepare(`SELECT competition_id,stage_id,algorithm_version,seed,outcome_hash,outcome_json FROM season_draws WHERE season_number=${world.seasonNumber} ORDER BY competition_id`).all<Draw>()).results;
 if(draws.length!==2)throw new ApiError(422,'calendar_event_prerequisites');
 for(let i=0;i<2;i++){
  const row=draws[i],want=expected[i];
  if(row.competition_id!==want.competitionId||row.stage_id!=='league'||row.seed!==stage.seed||row.algorithm_version!==schedule.algorithmVersion||row.outcome_hash!==want.hash||
    await canonicalHash(JSON.parse(row.outcome_json))!==want.hash)throw new ApiError(422,'calendar_event_prerequisites');
 }
 // The domestic and international draw commands must already have published
 // all stable match IDs. Publishing a calendar without them is never allowed.
 // The counts are also guarded inside the same D1 batch below.
 const slotCounts=await Promise.all([
  db.prepare('SELECT COUNT(*) AS n FROM season_match_slots WHERE generation=? AND season_number=?')
   .bind(world.generation,world.seasonNumber).first<{n:number}>(),
  db.prepare('SELECT COUNT(*) AS n FROM season_knockout_match_slots WHERE generation=? AND season_number=?')
   .bind(world.generation,world.seasonNumber).first<{n:number}>(),
  db.prepare('SELECT COUNT(*) AS n FROM public_match_numbers WHERE generation=? AND season_number=?')
   .bind(world.generation,world.seasonNumber).first<{n:number}>()
 ]);
 if(slotCounts[0]?.n!==3984||slotCounts[1]?.n!==98||slotCounts[2]?.n!==4082)
  throw new ApiError(409,'calendar_event_prerequisites');
 const calendarJson=JSON.stringify(schedule),calendarHash=await canonicalHash(schedule);
 const receipt=await canonicalHash({schemaVersion:1,generation:world.generation,season:world.seasonNumber,eventId:'international:calendar',calendarHash,domesticHash:stage.fixtures_hash,drawHashes:draws.map(d=>d.outcome_hash)});
 // Calendar publication is NEVER allowed to simulate matches. The approved
 // world calendar has no official fixtures in days 1..12; record one empty V2
 // day per elapsed administrative day, then score real games after day 12.
 const elapsedDays=await planEmptyLineupPreseasonV1({
  snapshot,schedule,generation:world.generation,throughDay:world.day,calendarHash
 });
 if(world.day>=13)throw new ApiError(409,'calendar_event_prerequisites');
 const operationId=crypto.randomUUID(),result:Outcome={world:{...world,revision:world.revision+1},operationId};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   ...authority.guards,
   abortUnless(db,`SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=${world.seasonNumber} AND phase='active' AND day=?`,[world.generation,world.revision,world.day]),
   abortUnless(db,`SELECT 1 FROM season_domestic_stages WHERE season_number=${world.seasonNumber} AND generation=? AND seed=? AND fixtures_hash=? AND fixtures_json=?`,[stage.generation,stage.seed,stage.fixtures_hash,stage.fixtures_json]),
   abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM season_draws WHERE season_number=${world.seasonNumber})=2`,[]),
   ...draws.map(d=>abortUnless(db,`SELECT 1 FROM season_draws WHERE season_number=${world.seasonNumber} AND competition_id=? AND stage_id=? AND seed=? AND outcome_hash=? AND outcome_json=?`,[d.competition_id,d.stage_id,d.seed,d.outcome_hash,d.outcome_json])),
   ...([
    ['season_match_slots',3984],['season_knockout_match_slots',98],
    ['public_match_numbers',4082]
   ] as const).map(([table,count])=>abortUnless(db,
    'SELECT 1 WHERE (SELECT COUNT(*) FROM '+table+' WHERE generation=? AND season_number=?)=?',
    [world.generation,world.seasonNumber,count])),
   abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM season_calendars WHERE season_number=${world.seasonNumber})=0`,[]),
   abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM season_lineup_day_outcomes WHERE season_number=${world.seasonNumber})=0`,[]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM match_lineup_result_receipts WHERE generation=? AND season_number=?)=0',[world.generation,world.seasonNumber]),
   abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM season_knockout_ties WHERE season_number=${world.seasonNumber})=0`,[]),
   abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM season_admin_events WHERE season_number=${world.seasonNumber})=?`,[rows.length]),
   ...rows.map(r=>abortUnless(db,`SELECT 1 FROM season_admin_events WHERE season_number=${world.seasonNumber} AND event_id=? AND scheduled_day=? AND event_order=? AND status=? AND completed_at IS ? AND receipt_hash IS ?`,[r.event_id,r.scheduled_day,r.event_order,r.status,r.completed_at,r.receipt_hash])),
   db.prepare('INSERT INTO season_calendars VALUES(?,?,?,?,?,?)').bind(world.seasonNumber,schedule.algorithmVersion,calendarHash,calendarJson,'generated',now),
   ...elapsedDays.map(d=>db.prepare('INSERT INTO season_lineup_day_outcomes VALUES(?,?,?,?,?,?,?,?)').bind(world.seasonNumber,world.generation,d.day,calendarHash,'temporary-lineup-v1',d.hash,d.json,now)),
   db.prepare(`UPDATE season_admin_events SET status='completed',completed_at=?,receipt_hash=? WHERE season_number=${world.seasonNumber} AND event_id='international:calendar' AND status='scheduled' AND scheduled_day=?`).bind(now,receipt,world.day),
   db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?').bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(operationId,world.generation,key,hash,session.actor.id,'publish-international-calendar-v1',world.revision,result.world.revision,JSON.stringify(result),now)
  ]);
  return result;
 }catch{
  const winner=await replay(db,session,cmd,key,hash,now);if(winner)return winner;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'calendar_event_unavailable');
 }
}
