/** #822: public, read-only contract facts. No negotiation or recipient data. */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {assertOpeningPublished} from './opening-world-publication.ts';
import {CURRENT_PLAYER_CONTRACTS_SQL} from './effective-player-contracts.mjs';
import {CONTRACT_POLICY,accruedSalary} from './player-contract-policy.ts';

const DAYS=CONTRACT_POLICY.earningDays;
interface ContractRow {
 career_status:string;contract_id:number|null;club_key:string|null;
 signed_at_ms:number|null;start_tick:number|null;end_tick:number|null;
 duration_seasons:number|null;signed_salary_arc:number|null;effective_salary_arc:number|null;
 mandate_id:number|null;agent_username:string|null;paid_arc:number;
}
const unavailable=()=>new ApiError(503,'player_contract_unavailable');
const valid=(n:unknown,min=0):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min;

/** Current contract uses the same sporting resolver as the public roster.
 * A genuine future signed term may be displayed separately from current affiliation.
 * Payment totals are for this contract and earning season, not recipient allocations.
 */
export async function readPublicPlayerContract(db:Database,playerId:number){
 if(!valid(playerId,1))throw new ApiError(422,'invalid_public_request');
 const before=await readWorld(db);await assertOpeningPublished(db);
 const first=Math.max(0,(before.seasonNumber-1)*DAYS);
 const completed=first+before.day;
 const tick=first+Math.max(before.day,1)-1;
 const row=await db.prepare(`SELECT json_extract(p.payload_json,'$.career_status') AS career_status,
 c.id AS contract_id,c.club_key,c.signed_at_ms,c.start_tick,
 MIN(c.scheduled_end_tick,COALESCE(c.closed_tick,c.scheduled_end_tick)) AS end_tick,
 c.duration_seasons,c.annual_salary_arc AS signed_salary_arc,
 CASE WHEN w.season_number>=2 THEN COALESCE(
 (SELECT annual_salary_arc FROM player_contract_promotion_salary WHERE contract_id=c.id),c.annual_salary_arc)
 ELSE c.annual_salary_arc END AS effective_salary_arc,
 m.id AS mandate_id,a.username AS agent_username,
 COALESCE((SELECT SUM(pc.due_arc-pc.outstanding_arc)
 FROM payroll_claim_outstanding pc JOIN payroll_runs pr ON pr.id=pc.run_id
 WHERE pc.contract_id=c.id AND pr.generation=w.generation AND pr.season=w.season_number),0) AS paid_arc
 FROM generated_players p CROSS JOIN world_state w
 LEFT JOIN ${CURRENT_PLAYER_CONTRACTS_SQL} effective ON effective.player_id=p.id
 LEFT JOIN player_signed_contracts c ON c.id=COALESCE(effective.contract_id,(
 SELECT pending.id FROM player_signed_contracts pending WHERE pending.player_id=p.id
 AND pending.world_generation=w.generation AND pending.closed_tick IS NULL
 AND pending.start_tick>? AND json_extract(p.payload_json,'$.career_status')='active'))
 LEFT JOIN player_agent_mandates m ON m.player_id=p.id AND m.world_generation=w.generation
 AND m.start_tick<=? AND (m.end_tick IS NULL OR m.end_tick>?)
 LEFT JOIN player_accounts a ON a.id=m.account_id AND a.status='active'
 WHERE w.id=1 AND p.id=?`).bind(tick,tick,tick,playerId).first<ContractRow>();
 await assertOpeningPublished(db);const after=await readWorld(db);
 if(after.generation!==before.generation||after.revision!==before.revision)throw new ApiError(409,'stale_world');
 if(!row)throw new ApiError(404,'player_not_found');
 const base={schemaVersion:1,playerId,season:before.seasonNumber,day:before.day};
 if(row.career_status==='retired')return {...base,status:'retired',contract:null,representation:null};
 if(row.career_status!=='active')return {...base,status:'unavailable',contract:null,representation:null};
 const representation=row.mandate_id===null?{kind:'ai',username:null}:
 {kind:'human',username:typeof row.agent_username==='string'&&/^[A-Za-z0-9_]{3,24}$/.test(row.agent_username)?row.agent_username:null};
 if(row.contract_id===null)return {...base,status:'free_agent',contract:null,representation};
 const {contract_id,club_key,signed_at_ms,start_tick,end_tick,duration_seasons,signed_salary_arc,effective_salary_arc,paid_arc}=row;
 if(!valid(contract_id,1)||typeof club_key!=='string'||!/^(?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40)$/.test(club_key)
 ||!valid(signed_at_ms,1)||!valid(start_tick)||!valid(end_tick)||end_tick<=start_tick
 ||!valid(duration_seasons,1)||duration_seasons>3||!valid(signed_salary_arc,1)||!valid(effective_salary_arc,1)||!valid(paid_arc))throw unavailable();
 const pending=before.seasonNumber===0||before.day===0||start_tick>tick;
 const origin=Math.max(first,start_tick);
 const elapsed=pending?0:Math.max(0,Math.min(completed,end_tick)-origin);
 const earnedArc=accruedSalary(effective_salary_arc,elapsed);
 if(paid_arc>earnedArc)throw unavailable();
 return {...base,status:pending?'signed_pending':'under_contract',representation,contract:{
  clubKey:club_key,signedAt:new Date(signed_at_ms).toISOString(),startTick:start_tick,endTick:end_tick,
  durationSeasons:duration_seasons,remainingDays:Math.max(0,end_tick-Math.max(completed,start_tick)),
  signedSalaryArc:signed_salary_arc,currentSeasonalSalaryArc:effective_salary_arc,
  earnedThisSeasonArc:earnedArc,paidThisSeasonArc:paid_arc
 }};
}
