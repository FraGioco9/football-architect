/** #777: protected inspection of current signed terms. No assignment or signing command. */
import clubs from '../../data/clubs.json' with {type:'json'};
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {CURRENT_PLAYER_CONTRACTS_SQL} from './effective-player-contracts.mjs';

const canonical=new Map(clubs.map(c=>[c.countryId+'-'+c.clubId,c.primaryName] as const));
if(canonical.size!==320)throw Error('Invalid canonical club catalogue');
const catalogue=Object.freeze([...canonical].map(([clubKey,name])=>({clubKey,name}))
 .sort((a,b)=>a.clubKey.localeCompare(b.clubKey)));
const invalid=()=>new ApiError(422,'invalid_player_contract');
const validId=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
interface Row {
 id:number;first_name:string|null;last_name:string|null;club_key:string|null;
 contract_id:number|null;annual_salary_arc:number|null;duration_seasons:number|null;start_tick:number|null;end_tick:number|null;signed_at_ms:number|null;
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
 return {id:r.id,name:(first+' '+last).trim()||'#'+r.id,clubKey:r.club_key??null,
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
