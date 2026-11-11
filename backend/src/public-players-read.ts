/** Anonymous page of persisted player identities, projected server-side. No generator metadata. */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {projectPublicFootballerDirectoryRecord,type InternalFootballer} from './footballer-public-projection.ts';

export const PUBLIC_PLAYER_PAGE_SIZE=50;
interface StoredPlayer extends InternalFootballer {age?:number}
interface StoredRow {id:number;payload_json:string}

const positions=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
export interface PublicPlayerFilters {nationality?:string;position?:string}
export async function readPublicPlayers(db:Database,page:number,filters:PublicPlayerFilters={}){
 if(!Number.isSafeInteger(page)||page<1||page>9999)throw new ApiError(422,'invalid_public_request');
 if(filters.nationality!==undefined&&!/^[A-Z]{3}$/.test(filters.nationality))throw new ApiError(422,'invalid_public_request');
 if(filters.position!==undefined&&!positions.has(filters.position))throw new ApiError(422,'invalid_public_request');
 const before=await readWorld(db);
 const clauses=['world_generation=?'],params:string[]=[before.generation];
 if(filters.nationality){clauses.push("json_extract(payload_json, '$.nationality')=?");params.push(filters.nationality)}
 if(filters.position){clauses.push("json_extract(payload_json, '$.primary_position')=?");params.push(filters.position)}
 const where=clauses.join(' AND ');
 const countRow=await db.prepare('SELECT COUNT(*) AS n FROM generated_players WHERE '+where)
  .bind(...params).first<{n:number}>();
 const count=countRow?.n??0;
 const totalPages=Math.max(1,Math.ceil(count/PUBLIC_PLAYER_PAGE_SIZE));
 const rows=page<=totalPages
  ?(await db.prepare('SELECT id,payload_json FROM generated_players WHERE '+where+' ORDER BY created_at DESC,id ASC LIMIT ? OFFSET ?')
    .bind(...params,PUBLIC_PLAYER_PAGE_SIZE,(page-1)*PUBLIC_PLAYER_PAGE_SIZE).all<StoredRow>()).results
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
