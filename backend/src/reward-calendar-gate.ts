/** #776 calendar enrollment and guarded consumer prerequisite.
 * Existing event rows are the only scheduling/completion authority. */
import type {Database,Statement} from './database.ts';
import type {WorldV1} from './types.ts';
import {ApiError} from './errors.ts';
import {abortUnless} from './atomic-guard.ts';
import {economicReconciliationGuard} from './economic-ledger.ts';
import {rewardCalendarBudget} from './reward-settlement-plan.mjs';
const budget=rewardCalendarBudget();
export function annualRewardHoldId(generation:string,season:number){
 return ['reward-budget',generation,season,budget.version].join(':');
}
const annualHold="SELECT 1 FROM economic_holds WHERE id=? AND source_id=? AND account_id='reserve' AND purpose='REWARD_BUDGET' AND amount_arc=? AND actor_id='reward-settlement-v1'";
/** Explicit annual earmark enrolls the calendar at preparation; no auto funding. */
export async function rewardCalendarEnrollment(db:Database,world:WorldV1){
 const id=annualRewardHoldId(world.generation,world.seasonNumber);
 const existing=await db.prepare('SELECT id FROM economic_holds WHERE id=?').bind(id).first();
 const guards:Statement[]=[];
 if(existing){
  const valid=await db.prepare(annualHold+" AND config_version IN (SELECT p.version FROM economic_policy_versions p JOIN economic_control c ON c.active_version=p.version WHERE c.id=1 AND c.posting_enabled=1 AND json_extract(p.rules_json,'$.rewardVersion')=?) AND EXISTS(SELECT 1 FROM economic_open_holds WHERE id=? AND remaining_arc=?)").bind(id,id,budget.annual,budget.version,id,budget.annual).first();
  if(!valid)throw new ApiError(409,'reward_budget_invalid');
  guards.push(abortUnless(db,annualHold+" AND config_version IN (SELECT p.version FROM economic_policy_versions p JOIN economic_control c ON c.active_version=p.version WHERE c.id=1 AND c.posting_enabled=1 AND json_extract(p.rules_json,'$.rewardVersion')=?) AND EXISTS(SELECT 1 FROM economic_open_holds WHERE id=? AND remaining_arc=?)",[id,id,budget.annual,budget.version,id,budget.annual]));
 }else guards.push(abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM economic_holds WHERE id=?)',[id]));
 return {enrolled:!!existing,guards};
}
/** Reusable payroll/advance guard. No caller-supplied money or calendar clock.
 * For enrolled seasons the immutable completed event plus ledger scope, hold,
 * absence of reversals and global reconciliation must still be valid. */
export function rewardCalendarCompletionGuards(db:Database,world:WorldV1,day:28|56,required=true):Statement[]{
 if(world.day!==day||world.phase!=='active')throw new ApiError(409,'reward_payday_required');
 const holdId=annualRewardHoldId(world.generation,world.seasonNumber);
 const eventId='rewards:'+day;
 const enrolled="EXISTS(SELECT 1 FROM season_admin_events WHERE season_number=? AND kind='settle-rewards') OR EXISTS(SELECT 1 FROM economic_holds WHERE id=?)";
 const complete=`EXISTS(SELECT 1 FROM season_admin_events WHERE season_number=? AND event_id=? AND kind='settle-rewards' AND scope=? AND scheduled_day=? AND event_order=7000 AND status='completed' AND completed_at>0 AND receipt_hash IS NOT NULL)
 AND EXISTS(SELECT 1 FROM economic_open_holds WHERE id=? AND account_id='reserve' AND purpose='REWARD_BUDGET' AND amount_arc=? AND remaining_arc=?)
 AND NOT EXISTS(SELECT 1 FROM economic_transactions t JOIN economic_transactions r ON r.reversal_of=t.id WHERE t.hold_id=?)
 AND NOT EXISTS(SELECT 1 FROM economic_hold_releases WHERE hold_id=? AND transaction_id IS NULL)
 AND (SELECT COALESCE(SUM(-e.amount_arc),0) FROM economic_transactions t JOIN economic_entries e ON e.transaction_id=t.id AND e.account_id='reserve' WHERE t.hold_id=? AND t.purpose='REWARD' AND t.generation=? AND t.season=? AND t.day=?)=?`;
 const args=[world.seasonNumber,eventId,'rewards-'+day,day,holdId,budget.annual,day===28?budget.day56:0,holdId,holdId,holdId,world.generation,world.seasonNumber,day,day===28?budget.day28:budget.day56];
 return [abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND season_number=? AND day=? AND revision=? AND phase='active'",[world.generation,world.seasonNumber,day,world.revision]),abortUnless(db,'SELECT 1 WHERE '+(required?'':`NOT (${enrolled}) OR `)+`(${complete})`,required?args:[world.seasonNumber,holdId,...args]),
  economicReconciliationGuard(db,required?undefined:{condition:enrolled,values:[world.seasonNumber,holdId]})];
}
/** Existing sporting-only seasons are unchanged. A hold without enrollment
 * fails closed, so late funding cannot bypass the calendar. */
export async function assertRewardCalendarCompletion(db:Database,world:WorldV1,day:28|56){
 const guards=rewardCalendarCompletionGuards(db,world,day,false);
 try{await db.batch(guards)}catch{throw new ApiError(409,'reward_calendar_pending')}
 return guards;
}
