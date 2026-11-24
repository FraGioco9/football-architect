/** #778 next-payday affordability: one trusted DB snapshot and same-batch signing guards.
 * No quote, signing, hold creation or money movement here. */
import type {Database,Statement} from './database.ts';
import type {WorldV1} from './types.ts';
import {ApiError} from './errors.ts';
import {economicAssert,clubTreasuryId,economicReconciliationGuard} from './economic-ledger.ts';
import {earnedBetween,canAffordNextPayday,type Affordability} from './player-contract-policy.ts';
import {annualRewardHoldId} from './reward-calendar-gate.ts';
import {rewardCalendarBudget} from './reward-settlement-plan.mjs';
import {loadSeasonSnapshotAuthority} from './season-snapshot-authority.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {guaranteedParticipationForClub} from './payroll-plan.mjs';

export type PayrollAffordabilityProof={inputs:Affordability;financeVersion:string;guards:readonly Statement[]};
const fail=(code='payroll_affordability_unavailable'):never=>{throw new ApiError(409,code)};
type Contract=[number,number,number,number];
const snapshot=(value:unknown):Contract[]=>{
 if(typeof value!=='string')return fail();
 return JSON.parse(value) as Contract[];
};

/** Trusted signing adapter supplies server-validated annual wage and the current world.
 * Returned predicates MUST run atomically with signing; not a request-supplied proof.
 * Opening relies on the caller's separate Genesis/source authorization. */
export async function preparePayrollAffordability(db:Database,world:WorldV1,club:string,wage:number):Promise<PayrollAffordabilityProof>{
 const opening=world.phase==='unstarted'&&world.seasonNumber===0&&world.day===0;
 if(!opening&&(world.phase!=='active'||world.seasonNumber<1||world.day<1||world.day===28||world.day>=56))return fail();
 const season=opening?1:world.seasonNumber,day:28|56=world.day<28?28:56,base=(season-1)*56,lo=base+day-28,hi=base+day;
 const newStart=base+world.day,treasury=clubTreasuryId(club),generation=world.generation;
 const worldSql="SELECT 1 FROM world_state WHERE id=1 AND generation=? AND season_number=? AND day=? AND phase=? AND revision=?";
 const worldArgs=[generation,world.seasonNumber,world.day,world.phase,world.revision];
 const contractsSql=`SELECT COALESCE(json_group_array(json_array(id,start_tick,end_tick,annual_salary_arc)),'[]') AS snapshot
 FROM (SELECT id,start_tick,COALESCE(closed_tick,scheduled_end_tick) AS end_tick,annual_salary_arc
 FROM player_signed_contracts WHERE world_generation=? AND club_key=? AND start_tick<? AND COALESCE(closed_tick,scheduled_end_tick)>? ORDER BY id)`;
 const ca=[generation,club,hi,lo];
 const balanceSql="SELECT b.available_arc,b.reserved_arc,c.active_version FROM economic_available_balances b JOIN economic_control c ON c.id=1 AND c.posting_enabled=1 WHERE b.id=? AND b.kind='CLUB_TREASURY'";
 const arrearsSql=`SELECT COALESCE(SUM(c.outstanding_arc),0) FROM payroll_claim_outstanding c JOIN payroll_runs r ON r.id=c.run_id WHERE r.generation=? AND r.club_key=?`;
 // Every earlier payday for this generation must be completed, even when no
 // wages were due. Missing history cannot be treated as zero arrears.
 const historySql=`SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM seasons s CROSS JOIN (SELECT 28 AS payday UNION ALL SELECT 56) d
 WHERE s.generation=? AND s.season_number*56+d.payday<? AND NOT EXISTS(
 SELECT 1 FROM payroll_runs r JOIN payroll_run_milestones m ON m.run_id=r.id AND m.kind='completed'
 WHERE r.generation=s.generation AND r.season=s.season_number AND r.day=d.payday AND r.club_key=?))
 AND NOT EXISTS(SELECT 1 FROM payroll_runs r WHERE r.generation=? AND r.club_key=? AND NOT EXISTS(
 SELECT 1 FROM payroll_run_milestones m WHERE m.run_id=r.id AND m.kind='completed'))
 AND NOT EXISTS(SELECT 1 FROM payroll_allocation_paid a JOIN payroll_runs r ON r.id=a.run_id WHERE r.generation=? AND r.club_key=? AND a.reversed<>0)
 AND NOT EXISTS(SELECT 1 FROM economic_transactions t JOIN economic_entries e ON e.transaction_id=t.id
 WHERE e.account_id=? AND e.amount_arc<0 AND t.purpose IN ('PAYROLL_HUMAN','PAYROLL_AI') AND NOT EXISTS(SELECT 1 FROM payroll_payment_receipts p WHERE p.transaction_id=t.id))`;
 const ha=[generation,season*56+day,club,generation,club,generation,club,treasury];
 const openingSql="SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM player_signed_contracts WHERE club_key=? AND (world_generation<>? OR start_tick<>0 OR closed_tick IS NOT NULL))";
 const baseGuards=[economicAssert(db,worldSql,worldArgs),economicAssert(db,historySql,ha),economicReconciliationGuard(db),
  ...(opening?[economicAssert(db,openingSql,[club,generation])]:[])];
 // Do not mutate the world revision during either settlement day.
 const read=await db.batch([...baseGuards,db.prepare(contractsSql).bind(...ca),db.prepare(balanceSql).bind(treasury),
  db.prepare('SELECT ('+arrearsSql+') AS arrears').bind(generation,club)]);
 const [cs,bs,ar]=read.slice(-3),bytes=cs.results[0]?.snapshot,rows=snapshot(bytes),balance=bs.results[0],arrears=ar.results[0]?.arrears;
 if(!balance||typeof balance.available_arc!=='number'||typeof balance.active_version!=='string'||typeof arrears!=='number'||arrears<0)return fail();
 // Until #801 and #802 pin a common hold ownership convention, fail closed on
 // existing reserves instead of counting an unidentified hold as wage funding.
 if(balance.reserved_arc!==0)return fail('payroll_commitment_hold_unavailable');
 const committed=rows.reduce((sum,[,start,end,rate])=>{
  const origin=Math.max(base,start),from=Math.max(lo,origin),to=Math.min(hi,end);
  return sum+(from<to?earnedBetween(rate,from-origin,to-origin):0);
 },0);
 const newDue=earnedBetween(wage,0,hi-newStart);
 const guards:Statement[]=[...baseGuards,
  economicAssert(db,'SELECT 1 WHERE ('+contractsSql.replace(' AS snapshot','')+')=?',[...ca,bytes]),
  economicAssert(db,'SELECT 1 WHERE ('+arrearsSql+')=?',[generation,club,arrears]),
  economicAssert(db,'SELECT 1 FROM ('+balanceSql+') WHERE available_arc=? AND reserved_arc=0 AND active_version=?',[treasury,balance.available_arc,balance.active_version])];
 let guaranteed=0;
 // No projected performance income. Count participation only after official
 // entrant confirmations and only if the whole upcoming installment is funded
 // and has not started posting. Otherwise cash-only is conservative.
 if(!opening){
  const eventSql="SELECT event_id,kind,scope,scheduled_day,completed_at,receipt_hash FROM season_admin_events WHERE season_number=? AND event_id IN ('domestic:entrants','international:entrants') AND status='completed' ORDER BY event_id";
  const confirmed=(await db.prepare(eventSql).bind(season).all()).results;
  if(confirmed.length===2){
   const authority=await loadSeasonSnapshotAuthority(db,world),approved=authority.snapshot;
   const source=await db.prepare('SELECT generation,participants_hash,rules_hash,snapshot_json FROM seasons WHERE season_number=?').bind(season).first<{generation:string;participants_hash:string;rules_hash:string;snapshot_json:string}>();
   if(!source||source.generation!==generation||source.participants_hash!==approved.participantsHash||source.rules_hash!==approved.rulesHash||await canonicalHash(JSON.parse(source.snapshot_json))!==await canonicalHash(approved))return fail();
   const confirmationGuards:Statement[]=[];
   for(const scope of ['domestic','international']){
    const eventId=scope+':entrants',kind='confirm-'+scope+'-entrants';
    const row=confirmed.find(x=>x.event_id===eventId);
    const hash=await canonicalHash({schemaVersion:1,season,generation,eventId,kind,participantsHash:approved.participantsHash,rulesHash:approved.rulesHash});
    if(!row||row.kind!==kind||row.scope!==scope||typeof row.scheduled_day!=='number'||row.scheduled_day<1||row.scheduled_day>12||typeof row.completed_at!=='number'||row.completed_at<=0||row.receipt_hash!==hash)return fail();
    confirmationGuards.push(economicAssert(db,"SELECT 1 FROM season_admin_events WHERE season_number=? AND event_id=? AND kind=? AND scope=? AND status='completed' AND scheduled_day=? AND completed_at=? AND receipt_hash=?",[season,eventId,kind,scope,row.scheduled_day,row.completed_at,hash]));
   }
   const budget=rewardCalendarBudget(),holdId=annualRewardHoldId(generation,season),remaining=day===28?budget.annual:budget.day56;
   const fundedSql=`SELECT 1 FROM economic_open_holds h JOIN economic_policy_versions p ON p.version=h.config_version
   WHERE h.id=? AND h.source_id=h.id AND h.account_id='reserve' AND h.actor_id='reward-settlement-v1' AND h.purpose='REWARD_BUDGET'
   AND h.config_version=? AND h.amount_arc=? AND h.remaining_arc=? AND json_extract(p.rules_json,'$.rewardVersion')=?
   AND EXISTS(SELECT 1 FROM season_admin_events e WHERE e.season_number=? AND e.event_id=? AND e.kind='settle-rewards' AND e.scheduled_day=? AND e.status='scheduled')
   AND NOT EXISTS(SELECT 1 FROM economic_transactions t WHERE t.purpose='REWARD' AND t.generation=? AND t.season=? AND t.day>=?)
   AND NOT EXISTS(SELECT 1 FROM economic_hold_releases WHERE hold_id=h.id AND transaction_id IS NULL)
   AND NOT EXISTS(SELECT 1 FROM economic_transactions t JOIN economic_transactions v ON v.reversal_of=t.id WHERE t.hold_id=h.id)`;
   const fa=[holdId,balance.active_version,budget.annual,remaining,budget.version,season,'rewards:'+day,day,generation,season,day];
   if(await db.prepare(fundedSql).bind(...fa).first()){
    guaranteed=guaranteedParticipationForClub(approved.bindings,club,day);
    guards.push(...authority.guards,...confirmationGuards,economicAssert(db,fundedSql,fa),
     economicAssert(db,'SELECT 1 FROM seasons WHERE season_number=? AND generation=? AND participants_hash=? AND rules_hash=? AND snapshot_json=?',[season,generation,source.participants_hash,source.rules_hash,source.snapshot_json]));
   }
  }
 }
 const inputs:Affordability={uncommittedCash:balance.available_arc,uncreditedGuaranteedParticipation:guaranteed,committedUncoveredWages:committed,arrears,newDue};
 if(!canAffordNextPayday(inputs))return fail('contract_insufficient_cash_proof');
 return {inputs,financeVersion:balance.active_version,guards};
}
