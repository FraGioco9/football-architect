/** Anonymous page of persisted player identities, projected server-side. No generator metadata. */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {projectPublicFootballerDirectoryRecord,type InternalFootballer} from './footballer-public-projection.ts';
import type {PublicPlayerFilters} from './public-players-filters.mjs';

export const PUBLIC_PLAYER_PAGE_SIZE=50;
interface StoredPlayer extends InternalFootballer {age?:number}
interface StoredRow {id:number;payload_json:string}

/** Count and page over the exact same server-side predicate, never a client-side 50-row filter. */
export async function readPublicPlayers(db:Database,page:number,filters:PublicPlayerFilters={}){
 if(!Number.isSafeInteger(page)||page<1||page>9999)throw new ApiError(422,'invalid_public_request');
 const before=await readWorld(db);
 const predicates=['world_generation=?'],values:(string|number)[]=[before.generation];
 // Dynamic values are bound; SQL expressions are fixed and cannot be supplied by clients.
 if(filters.nationality!==undefined){
  predicates.push("json_extract(payload_json,'$.nationality')=?");values.push(filters.nationality);
 }
 if(filters.position!==undefined){
  predicates.push("json_extract(payload_json,'$.primary_position')=?");values.push(filters.position);
 }
 if(filters.ageMin!==undefined){
  predicates.push("json_extract(payload_json,'$.age')>=?");values.push(filters.ageMin);
 }
 if(filters.ageMax!==undefined){
  predicates.push("json_extract(payload_json,'$.age')<=?");values.push(filters.ageMax);
 }
 if(filters.foot!==undefined){
  predicates.push("json_extract(payload_json,'$.preferred_foot')=?");values.push(filters.foot);
 }
 const where=predicates.join(' AND ');
 const countRow=await db.prepare('SELECT COUNT(*) AS n FROM generated_players WHERE '+where)
  .bind(...values).first<{n:number}>();
 const count=countRow?.n??0;
 const totalPages=Math.max(1,Math.ceil(count/PUBLIC_PLAYER_PAGE_SIZE));
 const rows=page<=totalPages
  ?(await db.prepare('SELECT id,payload_json FROM generated_players WHERE '+where+' ORDER BY created_at DESC,id ASC LIMIT ? OFFSET ?')
    .bind(...values,PUBLIC_PLAYER_PAGE_SIZE,(page-1)*PUBLIC_PLAYER_PAGE_SIZE).all<StoredRow>()).results
  :[];
 const after=await readWorld(db);
 if(after.generation!==before.generation)throw new ApiError(409,'stale_world');
 return {
  count,page,pageSize:PUBLIC_PLAYER_PAGE_SIZE,totalPages,
  players:rows.map(row=>{
   const payload=JSON.parse(row.payload_json) as StoredPlayer;
   return projectPublicFootballerDirectoryRecord(payload,{publicId:row.id,currentAge:payload.age});
  })
 };
}
