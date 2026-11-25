/** #777: protected inspection of current signed terms. No legacy assignment; protected signing preparation. */
import clubs from '../../data/clubs.json' with {type:'json'};
import {ApiError} from './errors.ts';
import type {Database,Statement} from './database.ts';
import {hashText,type AdminSession} from './auth.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {preparePayrollAffordability} from './payroll-affordability.ts';
import {requireEconomicGenesisGuard} from './economic-genesis.ts';
import {MARKET_VALUE_CONFIG,rawDestinationSalaryReferenceArc,type MarketValueInput} from './player-market-value.mjs';
import type {WorldV1} from './types.ts';
import {readWorld} from './world-repository.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {loadSeasonSnapshotAuthority} from './season-snapshot-authority.ts';
import {CONTRACT_POLICY,salaryBounds} from './player-contract-policy.ts';
import {parsePrepareRequest,parseIdempotencyKey} from './command-contract.ts';
import {CURRENT_PLAYER_CONTRACTS_SQL} from './effective-player-contracts.mjs';

const canonical=new Map(clubs.map(c=>[c.countryId+'-'+c.clubId,c.primaryName] as const));
if(canonical.size!==320)throw Error('Invalid canonical club catalogue');
const catalogue=Object.freeze([...canonical].map(([clubKey,name])=>({clubKey,name}))
 .sort((a,b)=>a.clubKey.localeCompare(b.clubKey)));
const invalid=()=>new ApiError(422,'invalid_player_contract');
const validId=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
interface Row {
 id:number;first_name:string|null;last_name:string|null;club_key:string|null;
 can_prepare:number;contract_id:number|null;annual_salary_arc:number|null;duration_seasons:number|null;start_tick:number|null;end_tick:number|null;signed_at_ms:number|null;
 nationality:string|null;age:number|null;height_cm:number|null;
 preferred_foot:string|null;primary_position:string|null;secondary_positions:string|null;
}
const presentation=(r:Row)=>{
 // Public-facing portion of a protected Admin record: no generator JSON, draft,
 // aptitude, development details or private account data leave this module.
 const first=typeof r.first_name==='string'?r.first_name.trim():'';
 const last=typeof r.last_name==='string'?r.last_name.trim():'';
 const secondary=typeof r.secondary_positions==='string'?(()=>{
  try{const v:unknown=JSON.parse(r.secondary_positions!);return Array.isArray(v)?v.filter((p):p is string=>typeof p==='string').slice(0,4):[]}
  catch{return [] as string[]}
 })():[];
 return {id:r.id,canPrepareContract:r.can_prepare===1,name:(first+' '+last).trim()||'#'+r.id,clubKey:r.club_key??null,
  ...(typeof r.nationality==='string'?{nationality:r.nationality}:{}),
  ...(Number.isSafeInteger(r.age)?{age:r.age}:{}),
  ...(Number.isSafeInteger(r.height_cm)?{height_cm:r.height_cm}:{}),
  ...(r.preferred_foot==='left'||r.preferred_foot==='right'?{preferred_foot:r.preferred_foot}:{}),
  ...(typeof r.primary_position==='string'?{primary_position:r.primary_position}:{}),
  secondary_positions:secondary,
  contract:r.contract_id===null?null:{id:r.contract_id,annualSalaryArc:r.annual_salary_arc,durationSeasons:r.duration_seasons,startTick:r.start_tick,endTick:r.end_tick,signedAt:new Date(r.signed_at_ms!).toISOString()}};

};
/** Report a missing forward-only local/DEV schema without leaking SQL or D1 details. */
async function withContractSchema<T>(work:()=>Promise<T>):Promise<T>{
 try{return await work()}
 catch(error){
  if(/\bno such table:\s*(?:main\.)?player_signed_contracts\b/i.test(String(error instanceof Error?error.message:error)))
   throw new ApiError(503,'contracts_schema_unavailable');
  throw error;
 }
}
const listSql=`SELECT p.id,
 json_extract(p.payload_json,'$.first_name') AS first_name,
 json_extract(p.payload_json,'$.last_name') AS last_name,
 json_extract(p.payload_json,'$.nationality') AS nationality,
 json_extract(p.payload_json,'$.age') AS age,
 json_extract(p.payload_json,'$.height_cm') AS height_cm,
 json_extract(p.payload_json,'$.preferred_foot') AS preferred_foot,
 json_extract(p.payload_json,'$.primary_position') AS primary_position,
 json_extract(p.payload_json,'$.secondary_positions') AS secondary_positions,
 CASE WHEN json_extract(p.payload_json,'$.career_status')='active' AND NOT EXISTS(SELECT 1 FROM player_signed_contracts pending WHERE pending.player_id=p.id AND pending.closed_tick IS NULL) THEN 1 ELSE 0 END AS can_prepare,
 a.club_key,a.contract_id,c.annual_salary_arc,c.duration_seasons,c.start_tick,
 MIN(c.scheduled_end_tick,COALESCE(c.closed_tick,c.scheduled_end_tick)) AS end_tick,c.signed_at_ms
 FROM generated_players p
 LEFT JOIN ${CURRENT_PLAYER_CONTRACTS_SQL} a ON a.player_id=p.id
 LEFT JOIN player_signed_contracts c ON c.id=a.contract_id`;

export function parseContractListQuery(search:string):{page:number;playerId:number|null}{
 const params=new URLSearchParams(search);
 if([...params.keys()].some(k=>k!=='page'&&k!=='playerId')||
   [...params.keys()].some(k=>params.getAll(k).length!==1)||
   (params.has('page')&&params.has('playerId')))throw invalid();
 let page=1,playerId:number|null=null;
 if(params.has('page')){
  const raw=params.get('page')!;
  if(!/^[1-9][0-9]{0,3}$/.test(raw))throw invalid();
  page=Number(raw);
 }
 if(params.has('playerId')){
  const raw=params.get('playerId')!;
  if(!/^[1-9][0-9]*$/.test(raw)||!validId(Number(raw)))throw invalid();
  playerId=Number(raw);
 }
 return {page,playerId};
}
export async function readPlayerContracts(db:Database,query:{page:number;playerId:number|null}){
 if(!Number.isSafeInteger(query.page)||query.page<1||query.page>9999||
  (query.playerId!==null&&!validId(query.playerId)))throw invalid();
 const before=await readWorld(db);
 const pageSize=50;
 let count=0,rows:Row[];
 if(query.playerId!==null){
  const item=await withContractSchema(()=>db.prepare(listSql+' WHERE p.id=?').bind(query.playerId!).first<Row>());
  if(!item)throw new ApiError(404,'player_not_found');
  count=1;rows=[item];
 }else{
  count=(await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>())?.n??0;
  rows=(await withContractSchema(()=>db.prepare(listSql+' ORDER BY p.id ASC LIMIT ? OFFSET ?')
   .bind(pageSize,(query.page-1)*pageSize).all<Row>())).results;
 }
 const after=await readWorld(db);
 if(before.generation!==after.generation||before.revision!==after.revision)
  throw new ApiError(409,'stale_world');
 return {count,page:query.playerId===null?query.page:1,pageSize,
  totalPages:query.playerId===null?Math.max(1,Math.ceil(count/pageSize)):1,
  worldGeneration:before.generation,worldRevision:before.revision,
  players:rows.map(presentation),clubs:catalogue};
}

/** Read-only quote; exact evidence is recalculated and guarded at signing.
 * Unsupported financial/authority states remain fail-closed. */
export async function previewAdminContract(db:Database,input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid();
 const v=input as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='clubKey,durationSeasons,expectedGeneration,expectedRevision,playerId'||
  !validId(v.playerId)||typeof v.clubKey!=='string'||!canonical.has(v.clubKey)||
  !Number.isSafeInteger(v.durationSeasons)||Number(v.durationSeasons)<1||Number(v.durationSeasons)>3)throw invalid();
 const cmd=parsePrepareRequest({expectedGeneration:v.expectedGeneration,expectedRevision:v.expectedRevision});
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.phase==='closed'||world.day===56)throw new ApiError(409,'contract_sporting_day_unavailable');
 const snapshot=world.seasonNumber===0?await loadApprovedSnapshot():(await loadSeasonSnapshotAuthority(db,world)).snapshot;
 const domestic=snapshot.bindings.find(x=>!x.competitionId.startsWith('int-')&&x.clubIds.includes(v.clubKey as string));
 if(!domestic)throw new ApiError(422,'contract_club_ineligible');
 const division=domestic.competitionId.endsWith('-1')?1:2;
 const startTick=world.seasonNumber===0?0:(world.seasonNumber-1)*56+world.day;
 const player=await db.prepare("SELECT id FROM generated_players WHERE id=? AND json_extract(payload_json,'$.career_status')='active' AND NOT EXISTS(SELECT 1 FROM player_signed_contracts c WHERE c.player_id=generated_players.id AND (c.closed_tick IS NULL OR c.closed_tick>?))").bind(v.playerId,startTick).first();
 if(!player)throw new ApiError(409,'contract_player_ineligible');
 const mandate=await db.prepare("SELECT id FROM player_agent_mandates WHERE player_id=? AND world_generation=? AND start_tick<=? AND (end_tick IS NULL OR end_tick>?)").bind(v.playerId,world.generation,startTick,startTick).first();
 const after=await readWorld(db);
 if(after.generation!==world.generation||after.revision!==world.revision)throw new ApiError(409,'stale_world');
 const base={playerId:v.playerId,clubKey:v.clubKey,durationSeasons:v.durationSeasons,startTick,
  endTick:(Math.floor(startTick/56)+Number(v.durationSeasons))*56,representation:mandate?'human':'ai',
  minimumArc:CONTRACT_POLICY.floors[division],worldGeneration:world.generation,worldRevision:world.revision};
 try{
  const prepared=await prepareInitialAiContract(db,parseInitialContract(input),readOpeningSalaryAuthority);
  // Execute the read-only assertion statements together; there are no domain
  // effects here. The signing command repeats the complete preflight and CAS.
  await db.batch([prepared.stageGuard,...prepared.forecast.guards,...prepared.funding.guards,abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=?",[world.generation,world.revision])]);
  return {...base,annualSalaryArc:prepared.wage,referenceArc:prepared.bounds.reference,maximumArc:prepared.bounds.maximum,quoteHash:prepared.quoteHash,signable:true,blockers:[]};
 }catch(error){
  if(error instanceof ApiError&&error.code==='stale_world')throw error;
  const blocker=error instanceof ApiError?error.code:'contract_signing_preconditions_changed';
  return {...base,annualSalaryArc:null,signable:false,blockers:[blocker]};
 }
}


/** Internal-only Phase C signing boundary. The adapter is server code, never JSON.
 * It must certify a destination-specific forecast and supply atomic source guards.
 * The hosted adapter reads only an explicitly configured immutable policy version.
 * Scope: initial AI-represented players at AI-managed clubs, Season 0 only.
 * Cash-only proof is sufficient, never assumes an unpaid guaranteed reward.
 * No human consent, active-season arrears, payroll settlement or opening release bypass. */
export type OpeningSalaryAuthority=(db:Database,world:WorldV1,clubKey:string)=>Promise<{
 expectedAnnualRewardsArc:number;sourceVersion:string;guards:readonly Statement[];
}>;
/** Trusted immutable policy input, not a default forecast. All 256 active club
 * estimates must belong to the exact approved opening snapshot and generation.
 * No policy row is created here; absent approval/configuration means unavailable. */
export const readOpeningSalaryAuthority:OpeningSalaryAuthority=async(db,world,club)=>{
 const snapshot=await loadApprovedSnapshot();
 const row=await db.prepare("SELECT p.version,p.rules_json FROM economic_control c JOIN economic_policy_versions p ON p.version=c.active_version WHERE c.id=1 AND c.posting_enabled=1").first<{version:string;rules_json:string}>();
 if(!row)throw new ApiError(503,'salary_reference_unavailable');
 let value:unknown;try{value=JSON.parse(row.rules_json).openingContracts}catch{throw new ApiError(503,'salary_reference_unavailable')}
 const fail=()=>new ApiError(503,'salary_reference_unavailable');
 if(!value||typeof value!=='object'||Array.isArray(value))throw fail();
 const policy=value as Record<string,unknown>;
 if(Object.keys(policy).sort().join(',')!=='expectedRewardsByClub,formulaVersion,participantsHash,rulesHash,schema,worldGeneration'||
 policy.schema!=='opening-contract-forecast-v1'||policy.worldGeneration!==world.generation||policy.participantsHash!==snapshot.participantsHash||policy.rulesHash!==snapshot.rulesHash||policy.formulaVersion!==MARKET_VALUE_CONFIG.version)throw fail();
 const entries=policy.expectedRewardsByClub;
 if(!entries||typeof entries!=='object'||Array.isArray(entries))throw fail();
 const estimates=entries as Record<string,unknown>;
 const active=snapshot.bindings.filter(x=>!x.competitionId.startsWith('int-')).flatMap(x=>[...x.clubIds]);
 if(active.length!==256||Object.keys(estimates).length!==active.length||active.some(k=>!Object.hasOwn(estimates,k)||typeof estimates[k]!=='number'||!Number.isFinite(estimates[k])||Number(estimates[k])<=0||Number(estimates[k])>1_000_000_000_000)||!Object.hasOwn(estimates,club))throw fail();
 return {expectedAnnualRewardsArc:Number(estimates[club]),sourceVersion:'opening-forecast:'+await hashText(row.rules_json),guards:[abortUnless(db,"SELECT 1 FROM economic_control c JOIN economic_policy_versions p ON p.version=c.active_version WHERE c.id=1 AND c.posting_enabled=1 AND p.version=? AND p.rules_json=?",[row.version,row.rules_json])]};
};
async function openingStageGuard(db:Database,generation:string){
 // #797's root is intentionally not a release receipt. If present, ordinary
 // signing is blocked even before its immutable insert/update triggers run.
 const exists=await db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='opening_world_runs'").first();
 if(!exists)return abortUnless(db,"SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM sqlite_schema WHERE type='table' AND name='opening_world_runs')",[]);
 const condition="SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM opening_world_runs WHERE world_generation=? AND batch_index=-1)";
 if(!await db.prepare(condition).bind(generation).first())throw new ApiError(409,'contract_opening_staged');
 return abortUnless(db,condition,[generation]);
}
function parseInitialContract(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid();
 const v=input as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='clubKey,durationSeasons,expectedGeneration,expectedRevision,playerId'||
 !validId(v.playerId)||typeof v.clubKey!=='string'||!canonical.has(v.clubKey)||
 !Number.isSafeInteger(v.durationSeasons)||Number(v.durationSeasons)<1||Number(v.durationSeasons)>3)throw invalid();
 const club=v.clubKey,id=v.playerId,duration=Number(v.durationSeasons);
 const cmd=parsePrepareRequest({expectedGeneration:v.expectedGeneration,expectedRevision:v.expectedRevision});

 return {club,id,duration,cmd};
}
async function prepareInitialAiContract(db:Database,parsed:ReturnType<typeof parseInitialContract>,authority:OpeningSalaryAuthority){
 const {club,id,duration,cmd}=parsed;
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.seasonNumber!==0||world.phase!=='unstarted'||world.day!==0||world.revision>=Number.MAX_SAFE_INTEGER)throw new ApiError(409,'contract_opening_only');
 const snapshot=await loadApprovedSnapshot();
 const stageGuard=await openingStageGuard(db,world.generation);
 const domestic=snapshot.bindings.find(x=>!x.competitionId.startsWith('int-')&&x.clubIds.includes(club));
 if(!domestic)throw new ApiError(422,'contract_club_ineligible');
 const division=domestic.competitionId.endsWith('-1')?1:2;
 const aiClubSql="SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM club_license_state WHERE club_key=? AND account_id IS NOT NULL)";
 const eligibleSql="SELECT payload_json FROM generated_players WHERE id=? AND world_generation=? AND entry_season=0 AND json_extract(payload_json,'$.career_status')='active' AND NOT EXISTS(SELECT 1 FROM player_signed_contracts WHERE player_id=?) AND NOT EXISTS(SELECT 1 FROM player_agent_mandates WHERE player_id=?)";
 if(!await db.prepare(aiClubSql).bind(club).first())throw new ApiError(409,'contract_human_consent_required');
 const player=await db.prepare(eligibleSql).bind(id,world.generation,id,id).first<{payload_json:string}>();
 if(!player)throw new ApiError(409,'contract_player_ineligible');
 const forecast=await authority(db,world,club);
 if(!forecast||typeof forecast.sourceVersion!=='string'||!forecast.sourceVersion.trim()||forecast.sourceVersion.length>100||
 !Array.isArray(forecast.guards)||!forecast.guards.length)throw new ApiError(503,'salary_reference_unavailable');
 const payload=JSON.parse(player.payload_json) as MarketValueInput&{initial_age?:number};
 const raw=rawDestinationSalaryReferenceArc({...payload,age:payload.age??payload.initial_age??0},forecast.expectedAnnualRewardsArc);
 if(raw===null)throw new ApiError(503,'salary_reference_unavailable');
 const bounds=salaryBounds(division,raw),wage=bounds.aiDemand;
 // Keep the explicit #802 readiness error at preflight. #803's returned guards
 // already include #802, reconciliation, the exact world and commitments.
 // Both preview and signing execute that same proof; no second commitment store.
 try{await db.batch([requireEconomicGenesisGuard(db,world.generation)])}catch{throw new ApiError(503,'contract_genesis_not_ready')}
 const funding=await preparePayrollAffordability(db,world,club,wage).catch(async(error:unknown)=>{
  if(error instanceof ApiError)throw error;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(409,'payroll_affordability_unavailable');
 });
 const {inputs,financeVersion}=funding;
 const {newDue,committedUncoveredWages:committed,uncommittedCash:availableArc}=inputs;
 const quoteHash=await hashText(JSON.stringify({kind:'opening-contract-quote-v1',generation:world.generation,revision:world.revision,club,id,duration,
  playerPayloadHash:await hashText(player.payload_json),salaryFormulaVersion:MARKET_VALUE_CONFIG.version,forecastVersion:forecast.sourceVersion,
  expectedAnnualRewardsArc:forecast.expectedAnnualRewardsArc,financeVersion,bounds,newDue,committed,availableArc}));
 return {world,club,id,duration,forecast,player,bounds,wage,funding,stageGuard,aiClubSql,quoteHash};
}
export async function signInitialAiContract(
 db:Database,session:AdminSession,input:unknown,keyInput:string|null,now:number,authority:OpeningSalaryAuthority,expectedQuoteHash?:string
):Promise<Outcome>{
 const parsed=parseInitialContract(input),{club,id,duration,cmd}=parsed;
 const key=parseIdempotencyKey(keyInput);
 if(!Number.isSafeInteger(now)||now<=0||now>Math.floor(Number.MAX_SAFE_INTEGER/1000))throw invalid();
 const hash=await hashText(JSON.stringify({command:'sign-initial-ai-contract-v1',...cmd,club,id,duration,expectedQuoteHash:expectedQuoteHash??null}));
 const saved=await replay(db,session,cmd,key,hash,now);if(saved)return saved;
 let prepared:Awaited<ReturnType<typeof prepareInitialAiContract>>;
 try{prepared=await prepareInitialAiContract(db,parsed,authority)}catch(error){
  const concurrent=await replay(db,session,cmd,key,hash,now);if(concurrent)return concurrent;
  throw error;
 }
 const {world,forecast,player,bounds,wage,funding,stageGuard,aiClubSql,quoteHash}=prepared;
 const {inputs,financeVersion}=funding;
 if(expectedQuoteHash!==undefined&&expectedQuoteHash!==quoteHash)throw new ApiError(409,'contract_quote_changed');
 const operationId=crypto.randomUUID(),result:Outcome={operationId,world:{...world,revision:world.revision+1}};
 const receipt={...result,contract:{playerId:id,clubKey:club,durationSeasons:duration,annualSalaryArc:wage,referenceArc:bounds.reference,
  salaryFormulaVersion:MARKET_VALUE_CONFIG.version,forecastVersion:forecast.sourceVersion,expectedAnnualRewardsArc:forecast.expectedAnnualRewardsArc,financeVersion,
  firstPaydayDueArc:inputs.newDue,existingDueArc:inputs.committedUncoveredWages,availableArc:inputs.uncommittedCash,quoteHash}};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=0 AND day=0 AND phase='unstarted'",[world.generation,world.revision]),
   ...forecast.guards,stageGuard,
   abortUnless(db,aiClubSql,[club]),
   abortUnless(db,"SELECT 1 FROM generated_players WHERE id=? AND world_generation=? AND entry_season=0 AND payload_json=? AND NOT EXISTS(SELECT 1 FROM player_signed_contracts WHERE player_id=?) AND NOT EXISTS(SELECT 1 FROM player_agent_mandates WHERE player_id=?)",[id,world.generation,player.payload_json,id,id]),
   ...funding.guards,
   db.prepare("INSERT INTO player_signed_contracts(player_id,world_generation,club_key,signed_at_ms,start_tick,duration_seasons,scheduled_end_tick,annual_salary_arc,minimum_arc,reference_arc,maximum_arc,policy_version,ai_demand_arc,signing_key) VALUES(?,?,?,?,0,?,?,?,?,?,?,?,?,?)")
    .bind(id,world.generation,club,now*1000,duration,duration*56,wage,bounds.minimum,bounds.reference,bounds.maximum,CONTRACT_POLICY.version,wage,'initial:'+world.generation+':'+id),
   db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?').bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(operationId,world.generation,key,hash,session.actor.id,'sign-initial-ai-contract-v1',world.revision,result.world.revision,JSON.stringify(receipt),now),
  ]);
  return result;
 }catch{
  const retry=await replay(db,session,cmd,key,hash,now);if(retry)return retry;
  const fresh=await readWorld(db);
  if(fresh.generation!==world.generation||fresh.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(409,'contract_signing_preconditions_changed');
 }
}

/** Admin HTTP boundary: client confirms an exact server-prepared quote, never supplies wage/authority. */
export async function signAdminContract(db:Database,session:AdminSession,input:unknown,key:string|null,now:number){
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid();
 const {quoteHash,...terms}=input as Record<string,unknown>;
 if(typeof quoteHash!=='string'||!/^[a-f0-9]{64}$/.test(quoteHash))throw invalid();
 return signInitialAiContract(db,session,terms,key,now,readOpeningSalaryAuthority,quoteHash);
}
