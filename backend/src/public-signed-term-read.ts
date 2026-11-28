/** Shared public signed-term projection for #822/#823. SQL fragments are static and use aliases c and w. */
import {ApiError} from './errors.ts';
import {CONTRACT_POLICY} from './player-contract-policy.ts';
export const PUBLIC_EFFECTIVE_SALARY_SQL = `CASE WHEN w.season_number>=2 THEN COALESCE(
 (SELECT annual_salary_arc FROM player_contract_promotion_salary WHERE contract_id=c.id),c.annual_salary_arc)
 ELSE c.annual_salary_arc END`;
export const PUBLIC_EFFECTIVE_END_SQL = 'MIN(c.scheduled_end_tick,COALESCE(c.closed_tick,c.scheduled_end_tick))';
export function publicRosterContractFacts(startTick:unknown,endTick:unknown,salary:unknown){
 if(typeof startTick!=='number'||!Number.isSafeInteger(startTick)||startTick<0||
  typeof endTick!=='number'||!Number.isSafeInteger(endTick)||endTick<=startTick||
  typeof salary!=='number'||!Number.isSafeInteger(salary)||salary<1||salary>1_000_000_000_000)
  throw new ApiError(503,'roster_unavailable');
 return {expiresSeason:Math.ceil(endTick/CONTRACT_POLICY.earningDays),currentSeasonalSalaryArc:salary};
}
