/** #777: protected inspection of current signed terms. No legacy assignment; protected signing preparation. */
import clubs from '../../data/clubs.json' with {type:'json'};
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {loadSeasonSnapshotAuthority} from './season-snapshot-authority.ts';
import {CONTRACT_POLICY} from './player-contract-policy.ts';
import {parsePrepareRequest} from './command-contract.ts';
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

/** Read-only preparation. Financial reference and payroll adapters are not yet authoritative.
 * Never turn this preview into a signed receipt or substitute a fake salary. */
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
 return {playerId:v.playerId,clubKey:v.clubKey,durationSeasons:v.durationSeasons,startTick,
  endTick:(Math.floor(startTick/56)+Number(v.durationSeasons))*56,representation:mandate?'human':'ai',
  minimumArc:CONTRACT_POLICY.floors[division],annualSalaryArc:null,signable:false as const,
  blockers:['salary_reference_unavailable','payroll_affordability_unavailable'],worldGeneration:world.generation,worldRevision:world.revision};
}
