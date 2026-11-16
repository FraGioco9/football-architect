/** #613 — replacement-only authenticated world-day command.
 * Routed by the Draft/HOLD branch's Admin dispatcher as the sole official
 * due-match finalizer. No temporary-score-v1 scoring or fallback.
 * Deployment and D1 cutover remain separately authorization-gated.
 */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database,Statement} from './database.ts';
import type {WorldV1} from './types.ts';
import {parsePrepareRequest,parseIdempotencyKey,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {loadSeasonSportingEvidence} from './season-sporting-evidence.ts';
import {proposeLifecycleTransition,type LifecycleProposal} from './domain/lifecycle/lifecycle-policy.ts';
import {replayLineupSeasonV1,type LineupSeasonReplayV1} from './lineup-season-replay.ts';
import {planLineupSportingDayV1,type StagedLineupDayV1} from './lineup-sporting-day-plan.ts';
import {tieKey} from './knockout-progression.ts';

type Evidence=Awaited<ReturnType<typeof loadSeasonSportingEvidence>>;
interface DayRow {
 day:number;generation:string;calendar_hash:string;simulation_version:string;
 outcome_hash:string;outcome_json:string;
}
interface TieRow {
 generation:string;competition_id:string;phase_id:string;tie_id:string;
 plan_hash:string;plan_json:string;
}
interface CountRow {n:number}

const invalid=(code:string):never=>{throw new ApiError(422,code)};
function sourceGuards(db:Database,e:Evidence):Statement[]{
 return [
  ...e.authorityGuards,
  abortUnless(db,'SELECT 1 FROM seasons WHERE season_number=? AND generation=? AND participants_hash=? AND rules_hash=? AND snapshot_json=?',
   [e.schedule.season,e.season.generation,e.snapshot.participantsHash,e.snapshot.rulesHash,e.season.snapshot_json]),
  abortUnless(db,'SELECT 1 FROM season_calendars WHERE season_number=? AND calendar_version=? AND calendar_hash=? AND calendar_json=?',
   [e.schedule.season,e.calendar.calendar_version,e.calendar.calendar_hash,e.calendar.calendar_json]),
  abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_draws WHERE season_number=?)=2',[e.schedule.season]),
  ...e.draws.map(d=>abortUnless(db,
   'SELECT 1 FROM season_draws WHERE season_number=? AND competition_id=? AND stage_id=? AND algorithm_version=? AND seed=? AND outcome_hash=? AND outcome_json=?',
   [e.schedule.season,d.competition_id,d.stage_id,d.algorithm_version,d.seed,d.outcome_hash,d.outcome_json]))
 ];
}
async function storedPrefixGuards(
 db:Database,world:WorldV1,evidence:Evidence,history:LineupSeasonReplayV1
):Promise<Statement[]>{
 const rows=(await db.prepare('SELECT day,generation,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_lineup_day_outcomes WHERE season_number=? ORDER BY day')
  .bind(world.seasonNumber).all<DayRow>()).results;
 if(rows.length!==world.day||rows.length!==history.days.length)
  invalid('lineup_daily_evidence_invalid');
 const guards:Statement[]=[
  abortUnless(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM season_lineup_day_outcomes WHERE season_number=?)=?',
   [world.seasonNumber,world.day]),
  abortUnless(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM match_lineup_result_receipts WHERE generation=? AND season_number=?)=?',
   [world.generation,world.seasonNumber,history.resultCount])
 ];
 for(let i=0;i<rows.length;i++){
  const row=rows[i],day=history.days[i];
  if(row.day!==i+1||row.generation!==world.generation||
   row.calendar_hash!==evidence.calendar.calendar_hash||
   row.simulation_version!=='temporary-lineup-v1'||
   row.outcome_hash!==day.hash||
   JSON.stringify(day.payload)!==row.outcome_json)invalid('lineup_daily_evidence_invalid');
  guards.push(abortUnless(db,
   'SELECT 1 FROM season_lineup_day_outcomes WHERE season_number=? AND day=? AND generation=? AND calendar_hash=? AND simulation_version=? AND outcome_hash=? AND outcome_json=?',
   [world.seasonNumber,row.day,world.generation,row.calendar_hash,
    row.simulation_version,row.outcome_hash,row.outcome_json]));
 }
 const ties=(await db.prepare(
  'SELECT generation,competition_id,phase_id,tie_id,plan_hash,plan_json FROM season_knockout_ties WHERE season_number=?'
 ).bind(world.seasonNumber).all<TieRow>()).results;
 if(ties.length!==history.progression.ties.size)invalid('lineup_knockout_evidence_invalid');
 guards.push(abortUnless(db,
  'SELECT 1 WHERE (SELECT COUNT(*) FROM season_knockout_ties WHERE season_number=?)=?',
  [world.seasonNumber,ties.length]));
 for(const row of ties){
  const canonical=history.progression.ties.get(tieKey({
   competitionId:row.competition_id,phaseId:row.phase_id,tieId:row.tie_id
  }));
  if(!canonical||row.generation!==world.generation||
   row.plan_hash!==await canonicalHash(canonical)||
   row.plan_json!==JSON.stringify(canonical))invalid('lineup_knockout_evidence_invalid');
  guards.push(abortUnless(db,
   'SELECT 1 FROM season_knockout_ties WHERE season_number=? AND generation=? AND competition_id=? AND phase_id=? AND tie_id=? AND plan_hash=? AND plan_json=?',
   [world.seasonNumber,row.generation,row.competition_id,row.phase_id,
    row.tie_id,row.plan_hash,row.plan_json]));
 }
 return guards;
}
/** Pure statement assembly for one verified day. Only the privileged caller
 * executes the returned single batch. Retains the same world CAS and audit.
 */
export function buildLineupLifecycleBatchV1(
 db:Database,session:AdminSession,now:number,world:WorldV1,
 proposal:LifecycleProposal,evidence:Evidence,prefixGuards:Statement[],
 planned:StagedLineupDayV1,operationId:string,key:string,requestHash:string
):Statement[]{
 if(!Number.isSafeInteger(now)||now<=0||proposal.before.revision!==world.revision||
  proposal.after.day!==planned.day||planned.day!==world.day+1||
  planned.nextProgression.lastDay!==planned.day||
  planned.dayEvidence.payload.simulationVersion!=='temporary-lineup-v1'||
  planned.dayEvidence.payload.results.length!==planned.matchCount||
  !operationId||!key||!requestHash)invalid('lineup_lifecycle_plan_invalid');
 const outcome:Outcome={world:proposal.after,operationId};
 return [
  sessionGuard(db,session,now),
  abortUnless(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=? AND phase=? AND day=?',
   [world.generation,world.revision,world.seasonNumber,world.phase,world.day]),
  ...sourceGuards(db,evidence),
  abortUnless(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM season_admin_events WHERE season_number=? AND status=? AND scheduled_day<=?)=0',
   [world.seasonNumber,'scheduled',world.day]),
  ...prefixGuards,
  ...planned.guards,
  ...planned.writes,
  db.prepare('UPDATE world_state SET revision=revision+1,phase=?,day=? WHERE id=1 AND generation=? AND revision=?')
   .bind(proposal.after.phase,proposal.after.day,world.generation,world.revision),
  db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
   .bind(operationId,world.generation,key,requestHash,session.actor.id,
    proposal.command==='start'?'start-season-v1':'advance-season-v1',
    world.revision,outcome.world.revision,JSON.stringify(outcome),now)
 ];
}
/** Protected replacement scorer command, intentionally NOT routed yet.
 * This function is a real atomic write if and only if an authorized caller
 * invokes it, so keep it disconnected until the complete one-engine cutover.
 */
export async function executeLineupLifecycleV1(
 db:Database,session:AdminSession,action:'start'|'advance',
 input:PrepareRequest,idempotencyKey:string,now:number
):Promise<Outcome>{
 const command=parsePrepareRequest(input),key=parseIdempotencyKey(idempotencyKey);
 if(!['start','advance'].includes(action))throw new ApiError(422,'invalid_lifecycle_command');
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'lifecycle_unavailable');
 const commandName=action==='start'?'start-season-v1':'advance-season-v1';
 const requestHash=await hashText(JSON.stringify({command:commandName,actor:session.actor.id,...command}));
 try{
  const previous=await replay(db,session,command,key,requestHash,now);
  if(previous)return previous;
  const world=await readWorld(db);
  if(world.generation!==command.expectedGeneration||
   world.revision!==command.expectedRevision)throw new ApiError(409,'stale_world');
  if((action==='start'&&(world.phase!=='preparing'||world.day!==0))||
   (action==='advance'&&(world.phase!=='active'||world.day>=56)))
   throw new ApiError(409,'prerequisites_incomplete');
  const pending=(await db.prepare('SELECT COUNT(*) AS n FROM season_admin_events WHERE season_number=? AND status=? AND scheduled_day<=?')
   .bind(world.seasonNumber,'scheduled',world.day).first<CountRow>())?.n;
  if(!Number.isSafeInteger(pending)||pending!==0)
   throw new ApiError(409,'calendar_event_prerequisites');
  const evidence=await loadSeasonSportingEvidence(db,world);
  const history=await replayLineupSeasonV1(db,world,evidence,world.day);
  const prefixGuards=await storedPrefixGuards(db,world,evidence,history);
  const proposal=proposeLifecycleTransition(world,action,{
   calendarComplete:true,drawsComplete:true,dueActivitiesComplete:true,
   resultsComplete:false,archiveComplete:false,nextSeasonSnapshotApproved:false
  });
  const planned=await planLineupSportingDayV1(
   db,world,history.progression,evidence.calendar.calendar_hash,now
  );
  if(proposal.after.day===56&&(planned.nextProgression.results.size!==4082||
   planned.nextProgression.ties.size!==54))
   invalid('lineup_sporting_season_incomplete');
  const operationId=crypto.randomUUID(),result:Outcome={
   world:proposal.after,operationId
  };
  const statements=buildLineupLifecycleBatchV1(
   db,session,now,world,proposal,evidence,prefixGuards,planned,
   operationId,key,requestHash
  );
  try{
   await db.batch(statements);
   return result;
  }catch{
   const winner=await replay(db,session,command,key,requestHash,now);
   if(winner)return winner;
   const current=await readWorld(db);
   if(current.generation!==world.generation||current.revision!==world.revision)
    throw new ApiError(409,'stale_world');
   throw new ApiError(503,'lifecycle_unavailable');
  }
 }catch(error){
  if(error instanceof ApiError){
   if(error.code==='prepare_unavailable'||error.code==='world_unavailable')
    throw new ApiError(503,'lifecycle_unavailable');
   throw error;
  }
  throw new ApiError(503,'lifecycle_unavailable');
 }
}
