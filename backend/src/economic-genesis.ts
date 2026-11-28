/** #775 internal bootstrap and consumer interface. No route, scheduler or remote caller.
 * Mutation callers must be trusted local operators with live fund/reserve guards.
 * Persisted policy is the sole immutable root; first annual hold seals completion.
 */
import type {Database,Statement} from './database.ts';
import {ApiError} from './errors.ts';
import {economicAssert,provisionClubAccounts,provisionWallet,postEconomicOperation,reserveEconomicFunds,reconcileEconomy,economicReconciliationGuard,clubTreasuryId,readEconomicBalance} from './economic-ledger.ts';
import {planEconomicGenesis,inspectGenesisReceipts,planGenesisRewardHold,type GenesisInput,type GenesisPlan} from './economic-genesis-plan.mjs';
import {readWorld} from './world-repository.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {annualRewardHoldId} from './reward-calendar-gate.ts';
import {rewardCalendarBudget} from './reward-settlement-plan.mjs';

type Root={version:string;generation:string;reward_version:string;annual_rewards_arc:number;free_reserve_arc:number;posting_enabled:number;funded_clubs:number;expected_funded_clubs:number;completed:number};
type Policy={version:string;approved_by:string;genesis_reserve_arc:number;issuance_limit_arc:number;club_opening_json:string;rules_json:string};
const fail=()=>new ApiError(409,'economic_genesis_not_ready');
function authorized(access:readonly Statement[]){if(!access.length)throw new ApiError(403,'economic_authority_required');}
const freshWorld="SELECT 1 FROM world_state WHERE id=1 AND generation=? AND phase='unstarted' AND season_number=0 AND day=0 AND revision=0";
const rootSql='SELECT * FROM economic_genesis_status';
/** Approved #801 input metadata only, not cash or a computed wage. */
export type OpeningContractForecast=Readonly<{
 schema:'opening-contract-forecast-v1';worldGeneration:string;participantsHash:string;rulesHash:string;
 formulaVersion:string;expectedRewardsByClub:Readonly<Record<string,number>>;
}>;
export type GenesisPreparationInput=GenesisInput&{openingContracts?:OpeningContractForecast};
export async function normalizeOpeningForecast(value:OpeningContractForecast|undefined,generation:string):Promise<OpeningContractForecast|undefined>{
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='expectedRewardsByClub,formulaVersion,participantsHash,rulesHash,schema,worldGeneration'||
 value.schema!=='opening-contract-forecast-v1'||value.worldGeneration!==generation||
 typeof value.formulaVersion!=='string'||!/^[A-Za-z0-9._-]{1,100}$/.test(value.formulaVersion))throw fail();
 const snapshot=await loadApprovedSnapshot();
 if(value.participantsHash!==snapshot.participantsHash||value.rulesHash!==snapshot.rulesHash)throw fail();
 const active=snapshot.bindings.filter(b=>!b.competitionId.startsWith('int-')).flatMap(b=>[...b.clubIds]).sort();
 const estimates=value.expectedRewardsByClub;
 if(!estimates||typeof estimates!=='object'||Array.isArray(estimates)||active.length!==256||new Set(active).size!==256||Object.keys(estimates).length!==256||
 active.some(k=>!Object.hasOwn(estimates,k)||!Number.isFinite(estimates[k])||estimates[k]<=0||estimates[k]>1_000_000_000_000))throw fail();
 return {schema:value.schema,worldGeneration:generation,participantsHash:value.participantsHash,rulesHash:value.rulesHash,formulaVersion:value.formulaVersion,
 expectedRewardsByClub:Object.fromEntries(active.map(k=>[k,estimates[k]]))};
}
const budget=rewardCalendarBudget();
async function readRoot(db:Database,access:readonly Statement[]){
 authorized(access);
 const r=await db.batch([...access,db.prepare(rootSql)]);
 return (r.at(-1)!.results[0]??null) as Root|null;
}
export function requireEconomicGenesisGuard(db:Database,generation:string):Statement{
 return economicAssert(db,"SELECT 1 FROM economic_genesis_status g JOIN world_state w ON w.id=1 AND w.generation=g.generation WHERE g.generation=? AND g.completed=1 AND g.funded_clubs=g.expected_funded_clubs AND g.posting_enabled=1 AND g.reward_version=? AND g.annual_rewards_arc=? AND (w.season_number<>0 OR EXISTS(SELECT 1 FROM economic_open_holds h WHERE h.id=? AND h.remaining_arc=g.annual_rewards_arc))",[generation,budget.version,budget.annual,annualRewardHoldId(generation,1)]);
}
/** For #801/#797: no wage calculation, no optimistic Rewards counted as spendable. */
export async function readGenesisClubFunding(db:Database,clubKey:string,generation:string,access:readonly Statement[]){
 authorized(access);
 const balance=await readEconomicBalance(db,clubTreasuryId(clubKey),[...access,requireEconomicGenesisGuard(db,generation),economicReconciliationGuard(db)]);
 if(!balance)throw fail();
 return balance;
}
export async function readEconomicGenesis(db:Database,access:readonly Statement[]){
 const root=await readRoot(db,access);
 return root?{...root,status:root.completed===1?'funded':root.funded_clubs?'funding':'prepared'}:null;
}
const pinnedRules=(plan:GenesisPlan,generation:string,openingContracts?:OpeningContractForecast)=>JSON.stringify({...JSON.parse(plan.policy.rulesJson),genesisGeneration:generation,...(openingContracts===undefined?{}:{openingContracts})});
function canonicalHold(plan:GenesisPlan,generation:string,season:number){
 const hold=planGenesisRewardHold(plan,generation,season);
 if(hold.id!==annualRewardHoldId(generation,season)||hold.amountArc!==budget.annual||plan.rewardVersion!==budget.version)throw fail();
 return hold;
}
async function loadPlan(db:Database,access:readonly Statement[]){
 const root=await readRoot(db,access);if(!root)throw fail();
 const r=await db.batch([...access,db.prepare('SELECT * FROM economic_policy_versions WHERE version=?').bind(root.version)]);
 const p=r.at(-1)!.results[0] as Policy|undefined;if(!p)throw fail();
 const plan=planEconomicGenesis({version:p.version,clubs:Object.entries(JSON.parse(p.club_opening_json)).map(([clubKey,amountArc])=>({clubKey,amountArc:amountArc as number})),freeReserveArc:root.free_reserve_arc,issuanceLimitArc:p.issuance_limit_arc});
 const openingContracts=JSON.parse(p.rules_json).openingContracts as OpeningContractForecast|undefined;
 if(p.genesis_reserve_arc!==plan.grossGenesisArc||p.club_opening_json!==plan.policy.clubOpeningJson||p.rules_json!==pinnedRules(plan,root.generation,openingContracts))throw fail();
 return {root,plan,policy:p};
}
/** Explicit prepare, replay only with identical immutable policy and approving actor.
 * All wallet provisioning is zero-balance and idempotent; no journal entries here. */
export async function prepareEconomicGenesis(db:Database,input:GenesisPreparationInput,approvedBy:string,access:readonly Statement[],now:number){
 authorized(access);
 if(!approvedBy||approvedBy.length>160||!Number.isSafeInteger(now)||now<1)throw fail();
 const plan=planEconomicGenesis(input),world=await readWorld(db);
 const openingContracts=await normalizeOpeningForecast(input.openingContracts,world.generation);
 const existing=await readRoot(db,access);
 if(existing){
  const old=await loadPlan(db,access);
  if(old.policy.approved_by!==approvedBy||old.root.generation!==world.generation||old.policy.rules_json!==pinnedRules(plan,world.generation,openingContracts)||old.policy.club_opening_json!==plan.policy.clubOpeningJson||old.policy.issuance_limit_arc!==plan.issuanceLimitArc||old.policy.version!==plan.version)throw fail();
  return readEconomicGenesis(db,access);
 }
 const fresh=[...access,economicAssert(db,freshWorld,[world.generation]),economicAssert(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM economic_control) AND NOT EXISTS(SELECT 1 FROM economic_transactions) AND NOT EXISTS(SELECT 1 FROM economic_holds)')];
 await provisionClubAccounts(db,now,fresh);
 // Snapshot in bounded pages; later verified accounts use the same provisionWallet primitive.
 let cursor='';
 for(;;){
  const page=await db.batch([...fresh,db.prepare("SELECT id FROM player_accounts WHERE status='active' AND email_verified_at IS NOT NULL AND id>? ORDER BY id LIMIT 32").bind(cursor)]);
  const rows=page.at(-1)!.results as {id:string}[];
  if(!rows.length)break;
  for(const row of rows)await provisionWallet(db,row.id,now,fresh);
  cursor=rows.at(-1)!.id;
 }
 await db.batch([...fresh,db.prepare('INSERT INTO economic_policy_versions VALUES(?,?,?,?,?,?,?)').bind(plan.version,now,approvedBy,plan.grossGenesisArc,plan.issuanceLimitArc,plan.policy.clubOpeningJson,pinnedRules(plan,world.generation,openingContracts)),
 db.prepare('INSERT INTO economic_control VALUES(1,?,1)').bind(plan.version)]);
 return readEconomicGenesis(db,access);
}
/** Bounded resume derived from sealed receipts; never takes a caller cursor. */
export async function stepEconomicGenesis(db:Database,access:readonly Statement[],now:number){
 const {root,plan}=await loadPlan(db,access);
 if(root.completed===1)return readEconomicGenesis(db,access);
 const guard=economicAssert(db,'SELECT 1 FROM economic_genesis_status WHERE version=? AND generation=? AND completed=0 AND posting_enabled=1',[root.version,root.generation]);
 const rows=await db.batch([...access,guard,db.prepare('SELECT * FROM economic_transactions ORDER BY business_key LIMIT 322')]);
 const progress=inspectGenesisReceipts(plan,rows.at(-1)!.results);
 for(const intent of progress.pending.slice(0,16))await postEconomicOperation(db,intent,{access,preconditions:[guard,economicAssert(db,freshWorld,[root.generation])]},now);
 return readEconomicGenesis(db,access);
}
/** Completion is the first fully funded hold, guarded atomically by 0045.
 * Readiness persists through subsequent legitimate payroll/rewards activity. */
export async function completeEconomicGenesis(db:Database,access:readonly Statement[],now:number){
 const {root,plan}=await loadPlan(db,access);
 if(root.completed===1)return readEconomicGenesis(db,access);
 const rows=await db.batch([...access,db.prepare('SELECT * FROM economic_transactions ORDER BY business_key LIMIT 322')]);
 if(inspectGenesisReceipts(plan,rows.at(-1)!.results).pending.length!==0||!(await reconcileEconomy(db,access)).ok)throw fail();
 await reserveEconomicFunds(db,canonicalHold(plan,root.generation,1),{access,preconditions:[economicAssert(db,freshWorld,[root.generation]),economicReconciliationGuard(db)]},now);
 return readEconomicGenesis(db,access);
}
/** Explicit next-season earmark; no issuance, no arbitrary amount, no clock mutation. */
export async function earmarkNextRewardBudget(db:Database,access:readonly Statement[],now:number){
 const {root,plan}=await loadPlan(db,access),world=await readWorld(db);
 if(root.completed!==1||world.generation!==root.generation||!['unstarted','closed'].includes(world.phase))throw fail();
 return reserveEconomicFunds(db,canonicalHold(plan,root.generation,world.seasonNumber+1),{access,preconditions:[requireEconomicGenesisGuard(db,root.generation),economicReconciliationGuard(db),economicAssert(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=? AND phase=?',[world.generation,world.revision,world.seasonNumber,world.phase])]},now);
}
