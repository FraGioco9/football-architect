import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database,Statement} from './database.ts';
import {parsePrepareRequest,parseIdempotencyKey,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {loadSeasonSportingEvidence} from './season-sporting-evidence.ts';
import {createProgression,processSportingDay,tieKey} from './knockout-progression.ts';
import type {TemporaryResult} from './temporary-simulation.ts';
import {proposeLifecycleTransition} from './lifecycle-policy.ts';
type Evidence=Awaited<ReturnType<typeof loadSeasonSportingEvidence>>;
interface Receipt {day:number;generation:string;calendar_hash:string;simulation_version:string;outcome_hash:string;outcome_json:string}
interface TieRow {generation:string;competition_id:string;phase_id:string;tie_id:string;plan_hash:string;plan_json:string}
function dayOutcome(evidence:Evidence,generation:string,day:number,results:TemporaryResult[]){
 return {schemaVersion:1,season:1,generation,day,calendarHash:evidence.calendar.calendar_hash,simulationVersion:'temporary-score-v1',results};
}
function sourceGuards(db:Database,e:Evidence):Statement[]{
 return [
  abortUnless(db,'SELECT 1 FROM seasons WHERE season_number=1 AND generation=? AND participants_hash=? AND rules_hash=? AND snapshot_json=?',[e.season.generation,e.snapshot.participantsHash,e.snapshot.rulesHash,e.season.snapshot_json]),
  abortUnless(db,'SELECT 1 FROM season_calendars WHERE season_number=1 AND calendar_version=? AND calendar_hash=? AND calendar_json=?',[e.calendar.calendar_version,e.calendar.calendar_hash,e.calendar.calendar_json]),
  abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_draws WHERE season_number=1)=2',[]),
  ...e.draws.map(d=>abortUnless(db,'SELECT 1 FROM season_draws WHERE season_number=1 AND competition_id=? AND stage_id=? AND algorithm_version=? AND seed=? AND outcome_hash=? AND outcome_json=?',[d.competition_id,d.stage_id,d.algorithm_version,d.seed,d.outcome_hash,d.outcome_json])),
 ];
}
/** Each successful destination-day command finalizes its due scores in the same
 * guarded transaction as time and audit. Rank-derived immutable knockout plans
 * extend sporting processing through day56; archive/closure remain separate. */
export async function executeLifecycle(db:Database,session:AdminSession,action:'start'|'advance',input:PrepareRequest,idempotencyKey:string,now:number):Promise<Outcome>{
 const command=parsePrepareRequest(input),key=parseIdempotencyKey(idempotencyKey);
 if(!['start','advance'].includes(action))throw new ApiError(422,'invalid_lifecycle_command');
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'lifecycle_unavailable');
 const commandName=action==='start'?'start-season-v1':'advance-season-v1';
 const requestHash=await hashText(JSON.stringify({command:commandName,actor:session.actor.id,...command}));
 try{
  const previous=await replay(db,session,command,key,requestHash,now);if(previous)return previous;
  const world=await readWorld(db);
  if(world.generation!==command.expectedGeneration||world.revision!==command.expectedRevision)throw new ApiError(409,'stale_world');
  if((action==='start'&&(world.phase!=='preparing'||world.day!==0))||(action==='advance'&&(world.phase!=='active'||world.day>=56)))throw new ApiError(409,'prerequisites_incomplete');
  const evidence=await loadSeasonSportingEvidence(db,world);
  const receipts=(await db.prepare('SELECT day,generation,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_day_outcomes WHERE season_number=1 ORDER BY day').all<Receipt>()).results;
  if(receipts.length!==world.day)throw new ApiError(422,'daily_evidence_invalid');
  const progression=createProgression(evidence.snapshot,evidence.schedule);
  // Bound to at most55 rows. Reconstruct each persisted receipt; neither a
  // completion count nor a recomputed stored hash can certify forged results.
  for(let i=0;i<receipts.length;i++){
   const row=receipts[i];
   const day=await processSportingDay(progression,i+1),expected=dayOutcome(evidence,world.generation,i+1,day.results),expectedHash=await canonicalHash(expected);
   try{if(row.day!==i+1||row.generation!==world.generation||row.calendar_hash!==evidence.calendar.calendar_hash||row.simulation_version!=='temporary-score-v1'||row.outcome_hash!==expectedHash||await canonicalHash(JSON.parse(row.outcome_json))!==expectedHash)throw Error('invalid receipt')}catch{throw new ApiError(422,'daily_evidence_invalid')}
  }
  const tieRows=(await db.prepare('SELECT generation,competition_id,phase_id,tie_id,plan_hash,plan_json FROM season_knockout_ties WHERE season_number=1').all<TieRow>()).results;
  if(tieRows.length!==progression.ties.size)throw new ApiError(422,'knockout_evidence_invalid');
  for(const row of tieRows){
   const expected=progression.ties.get(tieKey({competitionId:row.competition_id,phaseId:row.phase_id,tieId:row.tie_id}));
   try{if(!expected||row.generation!==world.generation||row.plan_hash!==await canonicalHash(expected)||await canonicalHash(JSON.parse(row.plan_json))!==row.plan_hash)throw Error('invalid tie')}catch{throw new ApiError(422,'knockout_evidence_invalid')}
  }
  const proposal=proposeLifecycleTransition(world,action,{calendarComplete:true,drawsComplete:true,dueActivitiesComplete:true,resultsComplete:false,archiveComplete:false,nextSeasonSnapshotApproved:false});
  const day=await processSportingDay(progression,proposal.after.day);
  const payload=dayOutcome(evidence,world.generation,proposal.after.day,day.results),payloadJson=JSON.stringify(payload),payloadHash=await canonicalHash(payload);
  const newTies=await Promise.all(day.newTies.map(async plan=>({plan,json:JSON.stringify(plan),hash:await canonicalHash(plan)})));
  if(proposal.after.day===56&&(progression.results.size!==4082||progression.ties.size!==54))throw new ApiError(422,'sporting_season_incomplete');
  const operationId=crypto.randomUUID(),result:Outcome={world:proposal.after,operationId};
  try{
   await db.batch([
    sessionGuard(db,session,now),
    abortUnless(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=1 AND phase=? AND day=?',[world.generation,world.revision,world.phase,world.day]),
    ...sourceGuards(db,evidence),
    abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_day_outcomes WHERE season_number=1)=?',[world.day]),
    ...receipts.map(r=>abortUnless(db,'SELECT 1 FROM season_day_outcomes WHERE season_number=1 AND day=? AND generation=? AND calendar_hash=? AND simulation_version=? AND outcome_hash=? AND outcome_json=?',[r.day,world.generation,r.calendar_hash,r.simulation_version,r.outcome_hash,r.outcome_json])),
    abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_knockout_ties WHERE season_number=1)=?',[tieRows.length]),
    ...tieRows.map(r=>abortUnless(db,'SELECT 1 FROM season_knockout_ties WHERE season_number=1 AND generation=? AND competition_id=? AND phase_id=? AND tie_id=? AND plan_hash=? AND plan_json=?',[r.generation,r.competition_id,r.phase_id,r.tie_id,r.plan_hash,r.plan_json])),
    ...newTies.map(t=>db.prepare('INSERT INTO season_knockout_ties VALUES(?,?,?,?,?,?,?,?)').bind(1,world.generation,t.plan.competitionId,t.plan.phaseId,t.plan.tieId,t.hash,t.json,now)),
    db.prepare('INSERT INTO season_day_outcomes VALUES(?,?,?,?,?,?,?,?)').bind(1,world.generation,proposal.after.day,evidence.calendar.calendar_hash,'temporary-score-v1',payloadHash,payloadJson,now),
    db.prepare('UPDATE world_state SET revision=revision+1,phase=?,day=? WHERE id=1 AND generation=? AND revision=?').bind(proposal.after.phase,proposal.after.day,world.generation,world.revision),
    db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
     .bind(operationId,world.generation,key,requestHash,session.actor.id,commandName,world.revision,result.world.revision,JSON.stringify(result),now),
   ]);
   return result;
  }catch{
   const winner=await replay(db,session,command,key,requestHash,now);if(winner)return winner;
   const current=await readWorld(db);if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
   throw new ApiError(503,'lifecycle_unavailable');
  }
 }catch(error){if(error instanceof ApiError){if(error.code==='prepare_unavailable'||error.code==='world_unavailable')throw new ApiError(503,'lifecycle_unavailable');throw error}throw new ApiError(503,'lifecycle_unavailable')}
}
