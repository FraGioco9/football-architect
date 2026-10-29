import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parseIdempotencyKey,parsePrepareRequest,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {buildInitialSchedule} from './initial-schedule.ts';
import {readWorld} from './world-repository.ts';
import {initialDrawOutcomes} from './initial-draws.ts';

/** Generate only initial league fixtures. Never starts the season or manufactures
 * postseason qualifiers, sporting results, standings or completed history. */
export async function generateSeasonCalendar(db:Database,session:AdminSession,input:PrepareRequest,idempotencyKey:string,now:number):Promise<Outcome>{
 const command=parsePrepareRequest(input),key=parseIdempotencyKey(idempotencyKey);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'calendar_unavailable');
 if(command.expectedRevision===Number.MAX_SAFE_INTEGER)throw new ApiError(422,'invalid_command');
 const requestHash=await hashText(JSON.stringify({command:'generate-calendar-v1',actor:session.actor.id,...command}));
 try{
  const previous=await replay(db,session,command,key,requestHash,now);if(previous)return previous;
  const world=await readWorld(db);
  if(world.generation!==command.expectedGeneration||world.revision!==command.expectedRevision)throw new ApiError(409,'stale_world');
  if(world.seasonNumber!==1||world.phase!=='preparing'||world.day!==0)throw new ApiError(422,'calendar_prerequisites');
  if((await db.prepare('SELECT count(*) AS n FROM season_admin_events WHERE season_number=1').first<{n:number}>())?.n!==0)throw new ApiError(409,'calendar_event_prerequisites');
  const snapshot=await loadApprovedSnapshot();
  const stored=await db.prepare('SELECT generation,participants_hash,rules_hash,snapshot_json FROM seasons WHERE season_number=1')
   .first<{generation:string;participants_hash:string;rules_hash:string;snapshot_json:string}>();
  if(!stored||stored.generation!==world.generation||stored.participants_hash!==snapshot.participantsHash||stored.rules_hash!==snapshot.rulesHash)throw new ApiError(422,'calendar_prerequisites');
  try{if(await canonicalHash(JSON.parse(stored.snapshot_json))!==await canonicalHash(snapshot))throw Error('invalid snapshot')}catch{throw new ApiError(422,'calendar_prerequisites')}
  if(await db.prepare('SELECT season_number FROM season_calendars WHERE season_number=1').first())throw new ApiError(409,'calendar_exists');
  const seed=crypto.randomUUID()+':'+crypto.randomUUID(),schedule=await buildInitialSchedule(snapshot,seed);
  const calendarJson=JSON.stringify(schedule),calendarHash=await canonicalHash(schedule);
  const operationId=crypto.randomUUID(),result:Outcome={world:{...world,revision:world.revision+1},operationId};
  const draws=await initialDrawOutcomes(schedule,snapshot);
  try{
   await db.batch([
    sessionGuard(db,session,now),
    abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_admin_events WHERE season_number=1)=0',[]),
    abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=1 AND phase='preparing' AND day=0",[command.expectedGeneration,command.expectedRevision]),
    abortUnless(db,'SELECT 1 FROM seasons WHERE season_number=1 AND generation=? AND participants_hash=? AND rules_hash=? AND snapshot_json=?',[world.generation,snapshot.participantsHash,snapshot.rulesHash,stored.snapshot_json]),
    db.prepare('INSERT INTO season_calendars VALUES(?,?,?,?,?,?)').bind(1,schedule.algorithmVersion,calendarHash,calendarJson,'generated',now),
    ...draws.map(d=>db.prepare('INSERT INTO season_draws VALUES(?,?,?,?,?,?,?,?,?)').bind(1,d.competitionId,'league',schedule.algorithmVersion,seed,d.hash,d.json,'generated',now)),
    db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?').bind(world.generation,world.revision),
    db.prepare(`INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at)
      VALUES(?,?,?,?,?,'generate-calendar-v1',?,?,?,?)`).bind(operationId,world.generation,key,requestHash,session.actor.id,world.revision,result.world.revision,JSON.stringify(result),now),
   ]);
   return result;
  }catch{
   const winner=await replay(db,session,command,key,requestHash,now);if(winner)return winner;
   const current=await readWorld(db);
   if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
   throw new ApiError(503,'calendar_unavailable');
  }
 }catch(error){
  if(error instanceof ApiError){if(error.code==='prepare_unavailable'||error.code==='world_unavailable')throw new ApiError(503,'calendar_unavailable');throw error}
  throw new ApiError(503,'calendar_unavailable');
 }
}
