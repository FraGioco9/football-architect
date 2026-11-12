/** #509 V1: current player-to-club affiliation; no contract term, salary or transfer history. */
import clubs from '../../data/clubs.json' with {type:'json'};
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import type {AdminSession} from './auth.ts';
import {readWorld} from './world-repository.ts';
import {sessionGuard} from './command-guards.ts';
import {abortUnless} from './atomic-guard.ts';

const canonical=new Map(clubs.map(c=>[c.countryId+'-'+c.clubId,c.primaryName] as const));
if(canonical.size!==320)throw Error('Invalid canonical club catalogue');
const catalogue=Object.freeze([...canonical].map(([clubKey,name])=>({clubKey,name}))
 .sort((a,b)=>a.clubKey.localeCompare(b.clubKey)));
const invalid=()=>new ApiError(422,'invalid_player_contract');
const validId=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const validKey=(v:unknown):v is string=>typeof v==='string'&&canonical.has(v);
interface Row {id:number;first_name:string|null;last_name:string|null;club_key:string|null}
const presentation=(r:Row)=>{
 // Public-facing portion of a protected Admin record: no generator JSON, draft,
 // aptitude, development details or private account data leave this module.
 const first=typeof r.first_name==='string'?r.first_name.trim():'';
 const last=typeof r.last_name==='string'?r.last_name.trim():'';
 return {id:r.id,name:(first+' '+last).trim()||'#'+r.id,clubKey:r.club_key??null};
};
const listSql=`SELECT p.id,
 json_extract(p.payload_json,'$.first_name') AS first_name,
 json_extract(p.payload_json,'$.last_name') AS last_name,
 a.club_key FROM generated_players p
 LEFT JOIN player_club_affiliations a ON a.player_id=p.id`;

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
  const item=await db.prepare(listSql+' WHERE p.id=?').bind(query.playerId).first<Row>();
  if(!item)throw new ApiError(404,'player_not_found');
  count=1;rows=[item];
 }else{
  count=(await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>())?.n??0;
  rows=(await db.prepare(listSql+' ORDER BY p.id ASC LIMIT ? OFFSET ?')
   .bind(pageSize,(query.page-1)*pageSize).all<Row>()).results;
 }
 const after=await readWorld(db);
 if(before.generation!==after.generation||before.revision!==after.revision)
  throw new ApiError(409,'stale_world');
 return {count,page:query.playerId===null?query.page:1,pageSize,
  totalPages:query.playerId===null?Math.max(1,Math.ceil(count/pageSize)):1,
  worldGeneration:before.generation,worldRevision:before.revision,
  players:rows.map(presentation),clubs:catalogue};
}
export interface ContractChange {
 playerId:number;clubKey:string|null;expectedClubKey:string|null;
 expectedGeneration:string;expectedRevision:number;
}
function parseChange(input:unknown):ContractChange{
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid();
 const o=input as Record<string,unknown>;
 if(Object.keys(o).sort().join(',')!=='clubKey,expectedClubKey,expectedGeneration,expectedRevision,playerId'||
  !validId(o.playerId)||
  !(o.clubKey===null||validKey(o.clubKey))||
  !(o.expectedClubKey===null||validKey(o.expectedClubKey))||
  typeof o.expectedGeneration!=='string'||
  !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(o.expectedGeneration)||
  !Number.isSafeInteger(o.expectedRevision)||Number(o.expectedRevision)<0)throw invalid();
 return o as unknown as ContractChange;
}
async function currentLink(db:Database,playerId:number){
 return db.prepare(`SELECT p.id,a.club_key FROM generated_players p
 LEFT JOIN player_club_affiliations a ON a.player_id=p.id WHERE p.id=?`)
 .bind(playerId).first<{id:number;club_key:string|null}>();
}
export async function changePlayerContract(db:Database,session:AdminSession,input:unknown,now:number){
 const change=parseChange(input),world=await readWorld(db);
 if(world.generation!==change.expectedGeneration||world.revision!==change.expectedRevision)
  throw new ApiError(409,'stale_world');
 const stored=await currentLink(db,change.playerId);
 if(!stored)throw new ApiError(404,'player_not_found');
 if((stored.club_key??null)!==change.expectedClubKey)
  throw new ApiError(409,'stale_player_contract');
 // A single batched transaction rechecks the live Admin grants and world token,
 // then atomically compares existing affiliation before assignment/unassignment.
 const expectedSql=change.expectedClubKey===null
  ?'SELECT 1 FROM generated_players p WHERE p.id=? AND NOT EXISTS (SELECT 1 FROM player_club_affiliations a WHERE a.player_id=p.id)'
  :'SELECT 1 FROM generated_players p WHERE p.id=? AND EXISTS (SELECT 1 FROM player_club_affiliations a WHERE a.player_id=p.id AND a.club_key=?)';
 const expectedArgs=change.expectedClubKey===null?[change.playerId]:[change.playerId,change.expectedClubKey];
 const mutation=change.clubKey===null
  ?db.prepare('DELETE FROM player_club_affiliations WHERE player_id=?').bind(change.playerId)
  :db.prepare(`INSERT INTO player_club_affiliations(player_id,club_key) VALUES(?,?)
   ON CONFLICT(player_id) DO UPDATE SET club_key=excluded.club_key`).bind(change.playerId,change.clubKey);
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=?',
    [change.expectedGeneration,change.expectedRevision]),
   abortUnless(db,expectedSql,expectedArgs),
   mutation
  ]);
 }catch{
  const fresh=await readWorld(db);
  if(fresh.generation!==change.expectedGeneration||fresh.revision!==change.expectedRevision)
   throw new ApiError(409,'stale_world');
  const current=await currentLink(db,change.playerId);
  if(!current)throw new ApiError(404,'player_not_found');
  if((current.club_key??null)!==change.expectedClubKey)
   throw new ApiError(409,'stale_player_contract');
  throw new ApiError(503,'player_contract_unavailable');
 }
 return {playerId:change.playerId,clubKey:change.clubKey,
  worldGeneration:world.generation,worldRevision:world.revision};
}
