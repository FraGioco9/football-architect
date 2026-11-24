/** #788/#792 inspection primitives. No reset, financial writes or schema changes. */
import {ApiError} from './errors.ts';
import type {Database,Statement} from './database.ts';
import {parseWorldV1} from './types.ts';
import {reconcileEconomy} from './economic-ledger.ts';

export const resetScopes=['sporting','players','contracts','economy'] as const;
export type ResetScope=typeof resetScopes[number];
const sportingTables=['seasons','season_calendars','season_draws','season_day_outcomes','season_knockout_ties','season_admin_events','season_domestic_stages','season_archives','season_archive_summaries','season_match_slots','season_knockout_match_slots','season_lineup_day_outcomes','season_zero_approvals','season_two_approvals','match_lineup_result_receipts','public_match_numbers'] as const;
const playerTables=['generated_players','player_club_affiliations','player_portrait_profiles','player_market_values','player_generation_drafts'] as const;
const economyTables=['economic_accounts','economic_control','economic_transactions','economic_entries','economic_holds','economic_hold_releases'] as const;
const contractTables=['player_signed_contracts','player_agent_mandates'] as const;
export function parseResetScopes(value:unknown):ResetScope[]{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).join(',')!=='scopes')throw new ApiError(422,'invalid_reset_scope');
 const scopes=(value as {scopes:unknown}).scopes;
 if(!Array.isArray(scopes)||!scopes.length||scopes.length>resetScopes.length||new Set(scopes).size!==scopes.length||scopes.some(s=>!resetScopes.includes(s)))throw new ApiError(422,'invalid_reset_scope');
 return resetScopes.filter(s=>scopes.includes(s));
}
const worldSql='SELECT schema_version AS schemaVersion,generation,revision,season_number AS seasonNumber,day,phase FROM world_state WHERE id=1';
const count=(table:string)=>'SELECT COUNT(*) AS n FROM '+table;
const integer=(value:unknown)=>{
 if(typeof value!=='number'||!Number.isSafeInteger(value))throw new ApiError(503,'admin_inspection_unavailable');
 return value;
};
function assertAccess(access:readonly Statement[]){
 if(!access.length)throw new ApiError(403,'permission_denied');
}
/** Preview-only. Optional 0040 tables are inspected, not assumed deployed. */
export async function previewAdminReset(db:Database,access:readonly Statement[],scopes:readonly ResetScope[]){
 assertAccess(access);
 const schema=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('player_signed_contracts','player_agent_mandates')").all<{name:string}>();
 const present=contractTables.filter(t=>schema.results.some(r=>r.name===t));
 const tables=[...sportingTables,...playerTables,...economyTables,...present];
 const results=await db.batch([...access,db.prepare(worldSql),...tables.map(t=>db.prepare(count(t))),db.prepare("SELECT COUNT(*) AS n FROM player_generation_drafts WHERE status='preview'"),db.prepare("SELECT COUNT(*) AS n FROM world_reset_permits")]);
 const rows=results.slice(access.length);
 const world=parseWorldV1(rows[0].results[0]);
 const counts:Record<string,number|null>=Object.fromEntries(tables.map((t,i)=>[t,integer(rows[i+1].results[0]?.n)]));
 for(const t of contractTables)if(!present.includes(t))counts[t]=null;
 const blockers:string[]=['preview_only'];
 if(scopes.includes('sporting')){
  if(counts.economic_control||counts.economic_transactions)blockers.push('economic_generation_guard');
  if(present.length!==0&&present.length!==2)blockers.push('contract_schema_incomplete');
  if(counts.player_signed_contracts||counts.player_agent_mandates)blockers.push('contract_generation_guard');
  if(counts.season_archives||counts.season_archive_summaries)blockers.push('sporting_history_protected');
  if(world.seasonNumber===0&&!counts.season_zero_approvals)blockers.push('reset_prerequisites');
  if(integer(rows[rows.length-1].results[0]?.n)>0)blockers.push('reset_in_progress');
 }
 if(scopes.includes('players'))blockers.push('population_rebuild_not_implemented');
 if(scopes.includes('contracts'))blockers.push('contract_history_protected');
 if(scopes.includes('economy'))blockers.push('economic_history_protected');
 return {world,scopes,counts,abandonedPreviewDrafts:scopes.includes('sporting')?integer(rows[rows.length-2].results[0]?.n):0,
  contractSchema:present.length===2?'present':present.length===0?'not_implemented':'incomplete',
  blockers,executable:false as const,protected:['accounts','permissions','licenses','audit','ledger','signed_history','source_assets'],confirmation:null};
}
const amount=(v:unknown)=>v===null?null:String(integer(v));
/** Balances are derived from canonical views; no user IDs or private policy JSON leave this adapter. */
export async function readAdminEconomySummary(db:Database,access:readonly Statement[]){
 assertAccess(access);
 const result=await db.batch([...access,db.prepare(worldSql),
  db.prepare('SELECT active_version,posting_enabled FROM economic_control WHERE id=1'),
  db.prepare('SELECT kind,COUNT(*) AS n,SUM(balance_arc) AS balance,SUM(reserved_arc) AS held,SUM(available_arc) AS available FROM economic_available_balances GROUP BY kind'),
  db.prepare('SELECT COUNT(*) AS n FROM economic_transactions')]);
 const [w,c,b,t]=result.slice(access.length);
 const control=c.results[0];
 const accounts=['PLATFORM_RESERVE','CLUB_TREASURY','USER_WALLET','ISSUANCE_CONTROL'].map(kind=>{
  const row=b.results.find(r=>r.kind===kind);
  return {kind,count:row?integer(row.n):0,balanceArc:row?amount(row.balance):null,heldArc:row?amount(row.held):null,availableArc:row?amount(row.available):null};
 });
 return {world:parseWorldV1(w.results[0]),status:!control?'uninitialized':control.posting_enabled===1?'active':'frozen',
  policyVersion:control?.active_version??null,accounts,transactionCount:integer(t.results[0]?.n),
  rewards:{status:'not_implemented'},payroll:{status:'not_implemented'}};
}
export async function readAdminEconomyReconciliation(db:Database,access:readonly Statement[]){
 assertAccess(access);
 // Read-only existing core audit. A clean empty ledger is not a funded world.
 const report=await reconcileEconomy(db,access);
 const [control]=await db.batch([...access,db.prepare('SELECT active_version FROM economic_control WHERE id=1')]).then(r=>r.slice(access.length));
 return {status:control.results.length?'core_checked':'uninitialized',report,domainStatus:'not_implemented'};
}
