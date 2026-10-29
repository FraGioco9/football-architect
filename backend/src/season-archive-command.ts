/** Archive validated sporting evidence without closing or advancing the active world. */
import {ApiError} from './errors.ts';
import {sportingDayPayload} from './sporting-day-payload.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parsePrepareRequest,parseIdempotencyKey,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {loadSeasonSportingEvidence} from './season-sporting-evidence.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {createProgression,processSportingDay} from './knockout-progression.ts';
import {seasonArchiveSportingSummary} from './season-archive-summary.ts';
interface Day {day:number;outcome_hash:string;outcome_json:string;calendar_hash:string}
interface Tie {plan_hash:string;plan_json:string}
export async function archiveSeason(db:Database,session:AdminSession,input:PrepareRequest,keyInput:string,now:number):Promise<Outcome>{
 const cmd=parsePrepareRequest(input),key=parseIdempotencyKey(keyInput);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'archive_unavailable');
 const requestHash=await hashText(JSON.stringify({command:'archive-season-v2',actor:session.actor.id,...cmd}));
 const previous=await replay(db,session,cmd,key,requestHash,now);if(previous)return previous;
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.phase!=='active'||world.day!==56||![1,2].includes(world.seasonNumber)||world.revision===Number.MAX_SAFE_INTEGER)throw new ApiError(409,'archive_prerequisites');
 const evidence=await loadSeasonSportingEvidence(db,world);
 const rows=(await db.prepare(`SELECT day,outcome_hash,outcome_json,calendar_hash FROM season_day_outcomes WHERE season_number=${world.seasonNumber} ORDER BY day`).all<Day>()).results;
 const ties=(await db.prepare(`SELECT plan_hash,plan_json FROM season_knockout_ties WHERE season_number=${world.seasonNumber} ORDER BY competition_id,phase_id,tie_id`).all<Tie>()).results;
 if(rows.length!==56||ties.length!==54)throw new ApiError(409,'archive_prerequisites');
 const progression=createProgression(evidence.snapshot,evidence.schedule);
 let count=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i];
  let payload:{day:number;results:unknown[];calendarHash:string};
  try{payload=JSON.parse(r.outcome_json)}catch{throw new ApiError(422,'archive_invalid')}
  if(r.day!==i+1||r.calendar_hash!==evidence.calendar.calendar_hash||payload.day!==r.day||payload.calendarHash!==r.calendar_hash||!Array.isArray(payload.results)||await canonicalHash(payload)!==r.outcome_hash)throw new ApiError(422,'archive_invalid');
  const expectedDay=await processSportingDay(progression,i+1);
  const expected=sportingDayPayload(world.seasonNumber,world.generation,i+1,evidence.calendar.calendar_hash,expectedDay.results);
  if(await canonicalHash(expected)!==r.outcome_hash)throw new ApiError(422,'archive_invalid');
  count+=payload.results.length;
 }
 if(count!==4082||progression.results.size!==4082||progression.ties.size!==54)throw new ApiError(422,'archive_invalid');
 const expectedTies=[...progression.ties.values()].map(x=>x);
 const expectedHashes=await Promise.all(expectedTies.map(canonicalHash));
 for(const t of ties)if(await canonicalHash(JSON.parse(t.plan_json))!==t.plan_hash||!expectedHashes.includes(t.plan_hash))throw new ApiError(422,'archive_invalid');
 if(new Set(ties.map(t=>t.plan_hash)).size!==54)throw new ApiError(422,'archive_invalid');
 const pending=(await db.prepare("SELECT count(*) n FROM season_admin_events WHERE season_number=? AND status='scheduled' AND scope<>'season'").bind(world.seasonNumber).first<{n:number}>())?.n??0;
 const archiveEvent=await db.prepare("SELECT event_order,status FROM season_admin_events WHERE season_number=? AND event_id='season:archive' AND kind='archive-season' AND scope='season' AND scheduled_day=56").bind(world.seasonNumber).first<{event_order:number;status:string}>();
 if(!archiveEvent||archiveEvent.status!=='scheduled'||archiveEvent.event_order<8000)throw new ApiError(409,'archive_prerequisites');
 if(pending!==0)throw new ApiError(409,'archive_prerequisites');
 const resultsHash=await canonicalHash(rows.map(r=>r.outcome_hash)),knockoutHash=await canonicalHash(ties.map(t=>t.plan_hash));
 const archiveHash=await canonicalHash({schemaVersion:1,season:world.seasonNumber,generation:world.generation,calendarHash:evidence.calendar.calendar_hash,resultsHash,knockoutHash,resultsCount:count,daysCount:56,tiesCount:54});
 const summary=seasonArchiveSportingSummary(progression),summaryJson=JSON.stringify(summary),summaryHash=await canonicalHash(summary);
 const result:Outcome={operationId:crypto.randomUUID(),world:{...world,revision:world.revision+1}};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   ...evidence.authorityGuards,
   abortUnless(db,`SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=${world.seasonNumber} AND phase='active' AND day=56`,[world.generation,world.revision]),
   abortUnless(db,`SELECT 1 FROM season_calendars WHERE season_number=${world.seasonNumber} AND calendar_hash=? AND calendar_json=?`,[evidence.calendar.calendar_hash,JSON.stringify(evidence.schedule)]),
   abortUnless(db,`SELECT 1 FROM seasons WHERE season_number=${world.seasonNumber} AND generation=? AND participants_hash=? AND rules_hash=? AND snapshot_json=?`,[world.generation,evidence.snapshot.participantsHash,evidence.snapshot.rulesHash,evidence.season.snapshot_json]),
   abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM season_draws WHERE season_number=${world.seasonNumber})=2`,[]),
   ...evidence.draws.map(d=>abortUnless(db,`SELECT 1 FROM season_draws WHERE season_number=${world.seasonNumber} AND competition_id=? AND outcome_hash=? AND outcome_json=?`,[d.competition_id,d.outcome_hash,d.outcome_json])),
   abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM season_day_outcomes WHERE season_number=${world.seasonNumber})=56`,[]),
   ...rows.map(r=>abortUnless(db,`SELECT 1 FROM season_day_outcomes WHERE season_number=${world.seasonNumber} AND day=? AND outcome_hash=? AND outcome_json=? AND calendar_hash=?`,[r.day,r.outcome_hash,r.outcome_json,r.calendar_hash])),
   abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM season_knockout_ties WHERE season_number=${world.seasonNumber})=54`,[]),
   ...ties.map(t=>abortUnless(db,`SELECT 1 FROM season_knockout_ties WHERE season_number=${world.seasonNumber} AND plan_hash=? AND plan_json=?`,[t.plan_hash,t.plan_json])),
   abortUnless(db,"SELECT 1 WHERE (SELECT count(*) FROM season_admin_events WHERE season_number=? AND status='scheduled' AND scope<>'season')=0",[world.seasonNumber]),
   abortUnless(db,"SELECT 1 FROM season_admin_events WHERE season_number=? AND event_id='season:archive' AND kind='archive-season' AND scope='season' AND scheduled_day=56 AND event_order=? AND status='scheduled' AND receipt_hash IS NULL",[world.seasonNumber,archiveEvent.event_order]),
   abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM season_archives WHERE season_number=${world.seasonNumber})=0`,[]),
   abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM season_archive_summaries WHERE season_number=?)',[world.seasonNumber]),
   db.prepare('INSERT INTO season_archives VALUES(?,?,?,?,?,?,?,?,?,?)').bind(world.seasonNumber,world.generation,evidence.calendar.calendar_hash,resultsHash,knockoutHash,archiveHash,count,56,54,now),
   db.prepare('INSERT INTO season_archive_summaries(season_number,generation,archive_hash,summary_hash,summary_json,created_at) VALUES(?,?,?,?,?,?)').bind(world.seasonNumber,world.generation,archiveHash,summaryHash,summaryJson,now),
   db.prepare("UPDATE season_admin_events SET status='completed',completed_at=?,receipt_hash=? WHERE season_number=? AND event_id='season:archive' AND status='scheduled'").bind(now,archiveHash,world.seasonNumber),
   db.prepare("UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?").bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(result.operationId,world.generation,key,requestHash,session.actor.id,'archive-season-v2',world.revision,result.world.revision,JSON.stringify(result),now),
  ]);
  return result;
 }catch{
  const winner=await replay(db,session,cmd,key,requestHash,now);if(winner)return winner;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'archive_unavailable');
 }
}
