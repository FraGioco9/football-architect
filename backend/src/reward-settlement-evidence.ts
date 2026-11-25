/** #776 server-only, read-only manifest preparation. No HTTP, D1 write, reserve
 * authorization or calendar/ledger side effect. A returned hash is not an
 * activation receipt; later commands must revalidate authority atomically. */
import type {Database,Statement} from './database.ts';
import {abortUnless} from './atomic-guard.ts';
import type {WorldV1} from './types.ts';
import {ApiError} from './errors.ts';
import {readWorld} from './world-repository.ts';
import {canonicalHash,type ApprovedSnapshot} from './catalogue-snapshot.ts';
import {loadSeasonSportingEvidence} from './season-sporting-evidence.ts';
import {replayLineupSeasonV1} from './lineup-season-replay.ts';
import {verifyLineupSeasonArchiveV1,type LineupSeasonArchiveProofV1} from './lineup-season-archive-proof.ts';
import type {Progression,FinalizedSportingMatch} from './knockout-progression.ts';
import {rankLeagueTable,type LeagueRow} from './league-standings.ts';
import {planRewardSettlement,type RewardProjection,type RewardPlan} from './reward-settlement-plan.mjs';

const invalid=():never=>{throw new ApiError(422,'reward_evidence_invalid')};
const stale=():never=>{throw new ApiError(409,'reward_world_stale')};
const sameWorld=(a:WorldV1,b:WorldV1)=>a.generation===b.generation&&a.seasonNumber===b.seasonNumber&&
 a.day===b.day&&a.phase===b.phase&&a.revision===b.revision;

type Confirmation={event_id:string;kind:string;scope:string;scheduled_day:number;status:string;
 completed_at:number|null;receipt_hash:string|null};

async function verifiedEntrantReceipts(db:Database,world:WorldV1,snapshot:ApprovedSnapshot){
 const rows=(await db.prepare("SELECT event_id,kind,scope,scheduled_day,status,completed_at,receipt_hash FROM season_admin_events WHERE season_number=? AND event_id IN ('domestic:entrants','international:entrants') ORDER BY event_id").bind(world.seasonNumber).all<Confirmation>()).results;
 if(rows.length!==2)return invalid();
 const verified:Array<{scope:string;receiptHash:string}>=[];
 for(const scope of ['domestic','international']){
  const eventId=scope+':entrants',kind='confirm-'+scope+'-entrants';
  const event=rows.find(r=>r.event_id===eventId);
  if(!event||event.kind!==kind||event.scope!==scope||event.status!=='completed'||
     !Number.isSafeInteger(event.scheduled_day)||event.scheduled_day<1||event.scheduled_day>12||
     !Number.isSafeInteger(event.completed_at)||Number(event.completed_at)<=0)return invalid();
  // Same receipt envelope used by completeConfirmationEvent and automatic admin advance.
  const receiptHash=await canonicalHash({schemaVersion:1,season:world.seasonNumber,generation:world.generation,
   eventId,kind,participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash});
  if(event.receipt_hash!==receiptHash)return invalid();
  verified.push({scope,receiptHash});
 }
 return verified;
}

/** Internal projection only, never accepts an external sporting table as proof.
 * Use the final leg's resolved winner (aggregate/extra time/penalties), not
 * the score of an individual leg. The caller supplies verified progression. */
function cupOutcomes(state:Progression<FinalizedSportingMatch>,competitionId:string,table:readonly Readonly<LeagueRow>[]){
 const outcomes=new Map(table.slice(12).map(r=>[r.clubId,'leagueEliminated']));
 const phases=[['playoffs','playoffLoser',4],['quarterfinals','quarterfinalLoser',4],
  ['semifinals','semifinalLoser',2],['final','runnerUp',1]] as const;
 for(const [phase,loserOutcome,count] of phases){
  const ties=[...state.ties.values()].filter(t=>t.competitionId===competitionId&&t.phaseId===phase);
  if(ties.length!==count)return invalid();
  for(const tie of ties){
   if(tie.fixtures.length!==(phase==='final'?1:2))return invalid();
   const last=tie.fixtures[tie.fixtures.length-1].fixture,result=state.results.get(last.id),winner=result?.winnerClubId;
   if(!winner||![last.homeClubId,last.awayClubId].includes(winner)||
      tie.fixtures.some(f=>!state.results.has(f.fixture.id)))return invalid();
   const loser=winner===last.homeClubId?last.awayClubId:last.homeClubId;
   if(outcomes.has(loser)||outcomes.has(winner))return invalid();
   outcomes.set(loser,loserOutcome);
   if(phase==='final')outcomes.set(winner,'champion');
  }
 }
 if(outcomes.size!==24)return invalid();
 return [...outcomes].map(([clubId,outcome])=>({clubId,outcome}));
}

/** Derive the projection from the already independently verified archive proof.
 * Exposed for existing local E2E evidence reuse; not a certification command. */
export async function projectFinalRewardEvidence(proof:LineupSeasonArchiveProofV1):Promise<RewardProjection[]>{
 const {evidence,history}=proof,state=history.progression;
 if(state.lastDay!==56||history.resultCount!==4082||state.ties.size!==54)return invalid();
 return Promise.all(evidence.snapshot.bindings.map(async b=>{
  const table=await rankLeagueTable(b.competitionId,b.clubIds,
   evidence.schedule.fixtures.filter(f=>f.competitionId===b.competitionId),state.results,evidence.schedule.seed);
  return {competitionId:b.competitionId,entrants:b.clubIds,table,
   ...(b.competitionId.startsWith('int-')?{outcomes:cupOutcomes(state,b.competitionId,table)}:{})};
 }));
}

type RewardVersionPin={rewardVersion:string;configVersion:string};
export type RewardManifest=Readonly<{schemaVersion:1;configVersion:string;plan:RewardPlan;manifestHash:string}>;

/** Content-addressed manifest; revision is intentionally not hashed because
 * retries may run after unrelated revisions. The caller must separately pin
 * the real economic policy and persist/reconstruct these exact bytes. */
export async function buildRewardManifest(plan:RewardPlan,configVersion:string):Promise<RewardManifest>{
 if(typeof configVersion!=='string'||!configVersion||configVersion.length>100||configVersion.trim()!==configVersion||
    /[\u0000-\u001f]/.test(configVersion))return invalid();
 const body={schemaVersion:1 as const,configVersion,plan};
 return Object.freeze({...body,manifestHash:await canonicalHash(body)});
}

/** Exact current official payday only: no debug, backfill, closed or skipped day.
 * Explicit pin is a preview input from server code, not evidence of activation.
 * Day28 validates full persisted sporting prefix as well as entrant receipts;
 * Day56 uses the existing independent archive proof BEFORE archive/close.
 * The final world re-read detects concurrent official advancement; it is NOT
 * a transactional guard and cannot authorize future writes. */
export async function prepareRewardSettlement(db:Database,pin:RewardVersionPin){
 const world=await readWorld(db);
 if(world.phase!=='active'||(world.day!==28&&world.day!==56)||world.seasonNumber<1)
  throw new ApiError(409,'reward_payday_required');
 if(!pin||pin.rewardVersion!=='draft-5')return invalid();
 const day=world.day;
 const proof=day===56?await verifyLineupSeasonArchiveV1(db,world):null;
 const evidence=proof?.evidence??await loadSeasonSportingEvidence(db,world);
 const entrantReceipts=await verifiedEntrantReceipts(db,world,evidence.snapshot);
 const history=proof?.history??await replayLineupSeasonV1(db,world,evidence,day);
 const digest=async(payday:28|56)=>canonicalHash({
  schemaVersion:1,generation:world.generation,season:world.seasonNumber,day:payday,
  participantsHash:evidence.snapshot.participantsHash,rulesHash:evidence.snapshot.rulesHash,
  calendarHash:evidence.calendar.calendar_hash,entrantReceipts,
  dayHashes:history.days.slice(0,payday).map(d=>d.hash),
  resultCount:history.days.slice(0,payday).reduce((n,d)=>n+d.payload.results.length,0),
  archiveHash:payday===56?proof?.archiveHash??null:null
 });
 const evidenceHash=await digest(day);
 const competitions=proof?await projectFinalRewardEvidence(proof):
  evidence.snapshot.bindings.map(b=>({competitionId:b.competitionId,entrants:b.clubIds}));
 let plan:RewardPlan;
 try{plan=planRewardSettlement({generation:world.generation,season:world.seasonNumber,day,
  rewardVersion:pin.rewardVersion,evidenceHash,competitions});}catch{return invalid()}
 const manifest=await buildRewardManifest(plan,pin.configVersion);
 // Day56 must independently reconstruct the identical Day28 entitlement
 // from the immutable prefix, rather than accepting a claimed prior total.
 const previousManifest=day===56?await buildRewardManifest(planRewardSettlement({
  generation:world.generation,season:world.seasonNumber,day:28,rewardVersion:pin.rewardVersion,
  evidenceHash:await digest(28),competitions:evidence.snapshot.bindings.map(b=>({competitionId:b.competitionId,entrants:b.clubIds}))
 }),pin.configVersion):null;
 const tieProof=await Promise.all([...history.progression.ties.values()].map(async t=>({
  competition:t.competitionId,phase:t.phaseId,id:t.tieId,hash:await canonicalHash(t),json:JSON.stringify(t)
 })));
 const guards:Statement[]=[
  ...evidence.authorityGuards,
  abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND season_number=? AND day=? AND phase='active' AND revision=?",
   [world.generation,world.seasonNumber,day,world.revision]),
  abortUnless(db,'SELECT 1 FROM seasons WHERE season_number=? AND generation=? AND participants_hash=? AND rules_hash=? AND snapshot_json=?',
   [world.seasonNumber,world.generation,evidence.snapshot.participantsHash,evidence.snapshot.rulesHash,evidence.season.snapshot_json]),
  abortUnless(db,'SELECT 1 FROM season_calendars WHERE season_number=? AND calendar_version=? AND calendar_hash=? AND calendar_json=?',
   [world.seasonNumber,evidence.calendar.calendar_version,evidence.calendar.calendar_hash,evidence.calendar.calendar_json]),
  abortUnless(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM season_draws WHERE season_number=?)=2',[world.seasonNumber]),
  ...evidence.draws.map(d=>abortUnless(db,'SELECT 1 FROM season_draws WHERE season_number=? AND competition_id=? AND stage_id=? AND algorithm_version=? AND seed=? AND outcome_hash=? AND outcome_json=?',
   [world.seasonNumber,d.competition_id,d.stage_id,d.algorithm_version,d.seed,d.outcome_hash,d.outcome_json])),
  ...entrantReceipts.map(e=>abortUnless(db,"SELECT 1 FROM season_admin_events WHERE season_number=? AND event_id=? AND kind=? AND scope=? AND status='completed' AND scheduled_day BETWEEN 1 AND 12 AND completed_at>0 AND receipt_hash=?",
   [world.seasonNumber,e.scope+':entrants','confirm-'+e.scope+'-entrants',e.scope,e.receiptHash])),
  // Day and match rows are append-only under the existing V2 schema. Exact
  // prefix hashes and count prevent later inserts from changing this proof.
  abortUnless(db,`SELECT 1 WHERE (SELECT COUNT(*) FROM season_lineup_day_outcomes WHERE season_number=?)=?
   AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(
    SELECT 1 FROM season_lineup_day_outcomes d WHERE d.season_number=? AND d.generation=?
    AND d.calendar_hash=? AND d.simulation_version='temporary-lineup-v1' AND d.day=j.key+1 AND d.outcome_hash=j.value))`,
   [world.seasonNumber,day,JSON.stringify(history.days.map(d=>d.hash)),world.seasonNumber,world.generation,evidence.calendar.calendar_hash]),
  abortUnless(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM match_lineup_result_receipts WHERE generation=? AND season_number=?)=?',
   [world.generation,world.seasonNumber,history.resultCount]),
  abortUnless(db,`SELECT 1 WHERE (SELECT COUNT(*) FROM season_knockout_ties WHERE season_number=?)=?
   AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(
    SELECT 1 FROM season_knockout_ties t WHERE t.season_number=? AND t.generation=?
    AND t.competition_id=json_extract(j.value,'$.competition') AND t.phase_id=json_extract(j.value,'$.phase')
    AND t.tie_id=json_extract(j.value,'$.id') AND t.plan_hash=json_extract(j.value,'$.hash')
    AND t.plan_json=json_extract(j.value,'$.json')))`,
   [world.seasonNumber,tieProof.length,JSON.stringify(tieProof),world.seasonNumber,world.generation])
 ];
 if(!sameWorld(world,await readWorld(db)))return stale();
 const prepared=Object.freeze({worldRevision:world.revision,manifest,previousManifest,guards:Object.freeze(guards)});
 preparedDatabases.set(prepared,db);
 return prepared;
}
const preparedDatabases=new WeakMap<object,Database>();
export type PreparedRewardSettlement=Awaited<ReturnType<typeof prepareRewardSettlement>>;
/** Only the trusted verifier can produce a batch capability; never deserialize it. */
export function assertPreparedRewardSettlement(db:Database,prepared:PreparedRewardSettlement){
 if(!prepared||preparedDatabases.get(prepared)!==db)return invalid();
}
export async function readRewardSettlementManifest(db:Database,pin:RewardVersionPin){
 const {worldRevision,manifest}=await prepareRewardSettlement(db,pin);
 return Object.freeze({worldRevision,manifest});
}
