/** Close an audited complete season; never fabricate next-season entrants. */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parsePrepareRequest,parseIdempotencyKey,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {loadSeasonSportingEvidence} from './season-sporting-evidence.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
interface Day {day:number;outcome_hash:string;outcome_json:string;calendar_hash:string}
interface Tie {plan_hash:string;plan_json:string}
export async function closeSeason(db:Database,session:AdminSession,input:PrepareRequest,keyInput:string,now:number):Promise<Outcome>{
 const cmd=parsePrepareRequest(input),key=parseIdempotencyKey(keyInput);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'archive_unavailable');
 const requestHash=await hashText(JSON.stringify({command:'close-season-v1',actor:session.actor.id,...cmd}));
 const previous=await replay(db,session,cmd,key,requestHash,now);if(previous)return previous;
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.phase!=='active'||world.day!==56||world.seasonNumber!==1||world.revision===Number.MAX_SAFE_INTEGER)throw new ApiError(409,'archive_prerequisites');
 const evidence=await loadSeasonSportingEvidence(db,world);
 const rows=(await db.prepare('SELECT day,outcome_hash,outcome_json,calendar_hash FROM season_day_outcomes WHERE season_number=1 ORDER BY day').all<Day>()).results;
 const ties=(await db.prepare('SELECT plan_hash,plan_json FROM season_knockout_ties WHERE season_number=1 ORDER BY competition_id,phase_id,tie_id').all<Tie>()).results;
 if(rows.length!==56||ties.length!==54)throw new ApiError(409,'archive_prerequisites');
 let count=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i];
  let payload:{day:number;results:unknown[];calendarHash:string};
  try{payload=JSON.parse(r.outcome_json)}catch{throw new ApiError(422,'archive_invalid')}
  if(r.day!==i+1||r.calendar_hash!==evidence.calendar.calendar_hash||payload.day!==r.day||payload.calendarHash!==r.calendar_hash||!Array.isArray(payload.results)||await canonicalHash(payload)!==r.outcome_hash)throw new ApiError(422,'archive_invalid');
  count+=payload.results.length;
 }
 if(count!==4082)throw new ApiError(422,'archive_invalid');
 for(const t of ties)if(await canonicalHash(JSON.parse(t.plan_json))!==t.plan_hash)throw new ApiError(422,'archive_invalid');
 const pending=(await db.prepare("SELECT count(*) n FROM season_admin_events WHERE season_number=1 AND status='scheduled'").first<{n:number}>())?.n??0;
 if(pending!==0)throw new ApiError(409,'archive_prerequisites');
 const resultsHash=await canonicalHash(rows.map(r=>r.outcome_hash)),knockoutHash=await canonicalHash(ties.map(t=>t.plan_hash));
 const archiveHash=await canonicalHash({schemaVersion:1,season:1,generation:world.generation,calendarHash:evidence.calendar.calendar_hash,resultsHash,knockoutHash,resultsCount:count,daysCount:56,tiesCount:54});
 const result:Outcome={operationId:crypto.randomUUID(),world:{...world,phase:'closed',revision:world.revision+1}};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=1 AND phase='active' AND day=56",[world.generation,world.revision]),
   abortUnless(db,'SELECT 1 FROM season_calendars WHERE season_number=1 AND calendar_hash=?',[evidence.calendar.calendar_hash]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_day_outcomes WHERE season_number=1)=56',[]),
   ...rows.map(r=>abortUnless(db,'SELECT 1 FROM season_day_outcomes WHERE season_number=1 AND day=? AND outcome_hash=? AND outcome_json=? AND calendar_hash=?',[r.day,r.outcome_hash,r.outcome_json,r.calendar_hash])),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_knockout_ties WHERE season_number=1)=54',[]),
   abortUnless(db,"SELECT 1 WHERE (SELECT count(*) FROM season_admin_events WHERE season_number=1 AND status='scheduled')=0",[]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_archives WHERE season_number=1)=0',[]),
   db.prepare('INSERT INTO season_archives VALUES(?,?,?,?,?,?,?,?,?,?)').bind(1,world.generation,evidence.calendar.calendar_hash,resultsHash,knockoutHash,archiveHash,count,56,54,now),
   db.prepare("UPDATE world_state SET phase='closed',revision=revision+1 WHERE id=1 AND generation=? AND revision=?").bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(result.operationId,world.generation,key,requestHash,session.actor.id,'close-season-v1',world.revision,result.world.revision,JSON.stringify(result),now),
  ]);
  return result;
 }catch{
  const winner=await replay(db,session,cmd,key,requestHash,now);if(winner)return winner;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'archive_unavailable');
 }
}
