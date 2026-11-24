/** Anonymous page of persisted player identities, projected server-side. No generator metadata. */
import {ApiError} from './errors.ts';
import clubs from '../../data/clubs.json' with {type:'json'};
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {projectPublicFootballerDirectoryRecord,type InternalFootballer} from './footballer-public-projection.ts';
import type {PublicPlayerFilters} from './public-players-filters.mjs';

export const PUBLIC_PLAYER_PAGE_SIZE=50;
// Experimental bounded path; performance/scale gate before release. Never return a truncated ranking.
export const MARKET_VALUE_SCAN_LIMIT=8000;
const clubNames=new Map(clubs.map(c=>[c.countryId+'-'+c.clubId,c.primaryName] as const));
if(clubNames.size!==320)throw Error('Invalid canonical club catalogue');
const FILTER_ATTRIBUTE_KEYS=new Set('passing technique dribbling shooting crossing tackling marking heading vision positioning decisions composure speed strength stamina agility gk_reflexes gk_handling gk_positioning gk_aerial'.split(' '));
interface StoredPlayer extends InternalFootballer {age?:number}
interface StoredRow {id:number;payload_json:string;club_key:string|null}
interface StoredDetailRow extends StoredRow {club_key:string|null;portrait_approved:number}

/** Count and page over the exact same server-side predicate, never a client-side 50-row filter. */
export async function readPublicPlayers(db:Database,page:number,filters:PublicPlayerFilters={}){
 if(!Number.isSafeInteger(page)||page<1||page>9999)throw new ApiError(422,'invalid_public_request');
 const before=await readWorld(db);
 // Persisted player identities survive sporting world resets; the generation
 // is a concurrency guard, not a filter on player ownership or visibility.
 const predicates:string[]=[],values:(string|number)[]=[];
 // Dynamic values are bound; SQL expressions are fixed and cannot be supplied by clients.
 if(filters.name!==undefined){
  // Names are a validated literal substring: escape LIKE metacharacters defensively.
  const needle=filters.name.replace(/[\\%_]/g,ch=>'\\'+ch);
  predicates.push("(COALESCE(json_extract(payload_json,'$.display_name'),json_extract(payload_json,'$.first_name')||' '||json_extract(payload_json,'$.last_name')) LIKE ? ESCAPE '\\' COLLATE NOCASE)");
  values.push('%'+needle+'%');
 }
 if(filters.attributes?.length){
  for(const attribute of filters.attributes){
   if(!FILTER_ATTRIBUTE_KEYS.has(attribute.key))throw new ApiError(422,'invalid_public_request');
   const path='$.attributes.'+attribute.key;
   if(attribute.min!==undefined){
    predicates.push("json_extract(payload_json,'"+path+"')>=?");
    values.push(attribute.min);
   }
   if(attribute.max!==undefined){
    predicates.push("json_extract(payload_json,'"+path+"')<=?");
    values.push(attribute.max);
   }
  }
 }

 if(filters.nationality?.length){
  const inList=filters.nationality.map(()=>'?').join(',');
  const primary="json_extract(payload_json,'$.nationality') IN ("+inList+")";
  if(filters.nationalityScope==='any'){
   predicates.push("("+primary+" OR json_extract(payload_json,'$.secondary_nationality') IN ("+inList+"))");
   values.push(...filters.nationality,...filters.nationality);
  }else{predicates.push(primary);values.push(...filters.nationality);}
 }
 if(filters.position?.length){
  const inList=filters.position.map(()=>'?').join(',');
  const primary="json_extract(payload_json,'$.primary_position') IN ("+inList+")";
  if(filters.positionScope==='any'){
   predicates.push("("+primary+" OR EXISTS (SELECT 1 FROM json_each(payload_json,'$.secondary_positions') AS secondary WHERE secondary.value IN ("+inList+")))");
   values.push(...filters.position,...filters.position);
  }else{predicates.push(primary);values.push(...filters.position);}
 }
 if(filters.ageMin!==undefined){
  predicates.push("json_extract(payload_json,'$.age')>=?");values.push(filters.ageMin);
 }
 if(filters.ageMax!==undefined){
  predicates.push("json_extract(payload_json,'$.age')<=?");values.push(filters.ageMax);
 }
 if(filters.heightMin!==undefined){
  predicates.push("json_extract(payload_json,'$.height_cm')>=?");values.push(filters.heightMin);
 }
 if(filters.heightMax!==undefined){
  predicates.push("json_extract(payload_json,'$.height_cm')<=?");values.push(filters.heightMax);
 }
 if(filters.foot!==undefined){
  predicates.push("json_extract(payload_json,'$.preferred_foot')=?");values.push(filters.foot);
 }
 // The ORDER BY expression is chosen exclusively from fixed, server-approved SQL.
 // Highest rank appears first in DESC (first click): GK, then right-to-left, rear-to-front.
 const pitchPositions=['GK','RB','RWB','CB','LWB','LB','DM','RM','CM','LM','RW','AM','LW','ST'] as const;
 const positionRank="CASE json_extract(payload_json,'$.primary_position') "+pitchPositions.map((code,index)=>"WHEN '"+code+"' THEN "+(pitchPositions.length-index)).join(' ')+" ELSE 0 END";
 const sortSql=new Map<string,string>([
  ['nationality',"json_extract(payload_json,'$.nationality')"],
  ['name',"COALESCE(json_extract(payload_json,'$.display_name'),json_extract(payload_json,'$.first_name')||' '||json_extract(payload_json,'$.last_name'))"],
  ['age',"json_extract(payload_json,'$.age')"],
  ['positions',positionRank],
  ['height',"json_extract(payload_json,'$.height_cm')"],
  ['foot',"json_extract(payload_json,'$.preferred_foot')"],
  ...[...FILTER_ATTRIBUTE_KEYS].map(key=>[key,"json_extract(payload_json,'$.attributes."+key+"')"] as [string,string])
 ]);
 if(filters.order!==undefined&&!filters.sort)throw new ApiError(422,'invalid_public_request');
 const valueSort=filters.sort==='market_value_arc';
 const valueRange=filters.valueMin!==undefined||filters.valueMax!==undefined;
 if([filters.valueMin,filters.valueMax].some(v=>v!==undefined&&(!Number.isSafeInteger(v)||v<0))||
    (filters.valueMin!==undefined&&filters.valueMax!==undefined&&filters.valueMin>filters.valueMax))throw new ApiError(422,'invalid_public_request');
 if(filters.sort!==undefined&&!valueSort&&!sortSql.has(filters.sort))throw new ApiError(422,'invalid_public_request');
 if(filters.order!==undefined&&filters.order!=='asc'&&filters.order!=='desc')throw new ApiError(422,'invalid_public_request');
 const sortExpression=filters.sort&&!valueSort?sortSql.get(filters.sort)!:null;
 const orderBy=sortExpression
  ?sortExpression+' COLLATE NOCASE '+(filters.order==='desc'?'DESC':'ASC')+', id ASC'
  :'id DESC';
 const where=predicates.length?' WHERE '+predicates.join(' AND '):'';
 const countSql='SELECT COUNT(*) AS n FROM generated_players'+where;
 const pageSql='SELECT p.id,p.payload_json,a.club_key FROM generated_players p LEFT JOIN player_club_affiliations a ON a.player_id=p.id'+where+' ORDER BY '+orderBy+' LIMIT ? OFFSET ?';
 const project=(row:StoredRow)=>{
   const payload=JSON.parse(row.payload_json) as StoredPlayer;
   const clubKey=row.club_key??null;
   if(clubKey!==null&&!clubNames.has(clubKey))throw new ApiError(503,'players_unavailable');
   return {...projectPublicFootballerDirectoryRecord(payload,{publicId:row.id,currentAge:payload.age}),
    clubKey,clubName:clubKey===null?null:clubNames.get(clubKey)!};
 };
 if(valueSort||valueRange){
  // One SQL snapshot of candidates matching ordinary filters, with explicit overflow guard.
  const candidates=(await db.prepare('SELECT p.id,p.payload_json,a.club_key FROM generated_players p LEFT JOIN player_club_affiliations a ON a.player_id=p.id'+where+' ORDER BY '+orderBy+' LIMIT ?').bind(...values,MARKET_VALUE_SCAN_LIMIT+1).all<StoredRow>()).results;
  if(candidates.length>MARKET_VALUE_SCAN_LIMIT)throw new ApiError(503,'players_unavailable');
  const matching=candidates.map(project).filter(player=>!valueRange||(player.market_value_arc!==null&&
   (filters.valueMin===undefined||player.market_value_arc>=filters.valueMin)&&
   (filters.valueMax===undefined||player.market_value_arc<=filters.valueMax)));
  if(valueSort)matching.sort((a,b)=>{
   const x=a.market_value_arc,y=b.market_value_arc;
   if(x===null||y===null)return x===y?a.id-b.id:x===null?1:-1;
   return (filters.order==='asc'?x-y:y-x)||a.id-b.id;
  });
  const after=await readWorld(db);
  if(after.generation!==before.generation||after.revision!==before.revision)throw new ApiError(409,'stale_world');
  return {count:matching.length,page,pageSize:PUBLIC_PLAYER_PAGE_SIZE,totalPages:Math.max(1,Math.ceil(matching.length/PUBLIC_PLAYER_PAGE_SIZE)),players:matching.slice((page-1)*PUBLIC_PLAYER_PAGE_SIZE,page*PUBLIC_PLAYER_PAGE_SIZE)};
 }
 let count:number,rows:StoredRow[];
 if(page===1){
  // The first page always needs both results, even when the directory is
  // empty. D1 batch executes them in one transaction/round trip, without
  // changing the exact count, selected public fields or 50-row contract.
  const [countResult,pageResult]=await db.batch([
   db.prepare(countSql).bind(...values),
   db.prepare(pageSql).bind(...values,PUBLIC_PLAYER_PAGE_SIZE,0)
  ]);
  const value=(countResult?.results?.[0] as {n?:number}|undefined)?.n;
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||!pageResult?.results)
   throw new ApiError(503,'players_unavailable');
  count=value;
  rows=pageResult.results as unknown as StoredRow[];
 }else{
  // Preserve the current no-page-SELECT behavior for expired deep links.
  // OFFSET pages must recount: generation alone cannot detect new players
  // or affiliation writes, so reusing a client-supplied count is unsafe.
  const countRow=await db.prepare(countSql).bind(...values).first<{n:number}>();
  count=countRow?.n??0;
  const totalPages=Math.max(1,Math.ceil(count/PUBLIC_PLAYER_PAGE_SIZE));
  rows=page<=totalPages
   ?(await db.prepare(pageSql).bind(...values,PUBLIC_PLAYER_PAGE_SIZE,(page-1)*PUBLIC_PLAYER_PAGE_SIZE).all<StoredRow>()).results
   :[];
 }
 const totalPages=Math.max(1,Math.ceil(count/PUBLIC_PLAYER_PAGE_SIZE));
 const after=await readWorld(db);
 if(after.generation!==before.generation)throw new ApiError(409,'stale_world');
 return {
  count,page,pageSize:PUBLIC_PLAYER_PAGE_SIZE,totalPages,
  players:rows.map(project)
 };
}

/** Public single-player read, sharing the directory projection and lifetime rules. */
export async function readPublicPlayer(db:Database,id:number){
 if(!Number.isSafeInteger(id)||id<1)throw new ApiError(422,'invalid_public_request');
 const before=await readWorld(db);
 // Affiliation is a single authoritative LEFT JOIN; an absent row means Free Agent.
 const row=await db.prepare(`SELECT p.id,p.payload_json,a.club_key,
  CASE WHEN portrait.status='approved'
    AND portrait.schema_version='player-portraits-v5'
    AND portrait.prompt_version='player-portrait-v4.2'
    AND portrait.asset_key=('assets/players/portraits/' || p.id || '.webp')
    THEN 1 ELSE 0 END AS portrait_approved
  FROM generated_players p
  LEFT JOIN player_club_affiliations a ON a.player_id=p.id
  LEFT JOIN player_portrait_profiles portrait ON portrait.player_id=p.id
  WHERE p.id=?`)
  .bind(id).first<StoredDetailRow>();
 const after=await readWorld(db);
 if(after.generation!==before.generation)throw new ApiError(409,'stale_world');
 if(!row)throw new ApiError(404,'player_not_found');
 const payload=JSON.parse(row.payload_json) as StoredPlayer;
 // Keep the approved public player projection; add only current, nullable club identity.
 const clubKey=row.club_key;
 if(clubKey!==null&&(!/^(?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40)$/.test(clubKey)))
  throw new ApiError(503,'players_unavailable');
 return {player:{...projectPublicFootballerDirectoryRecord(payload,{publicId:row.id,currentAge:payload.age}),
  clubKey,portraitApproved:row.portrait_approved===1}};
}
