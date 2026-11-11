/** Anonymous page of persisted player identities, projected server-side. No generator metadata. */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {projectPublicFootballerProfile,type InternalFootballer} from './footballer-public-projection.ts';

export const PUBLIC_PLAYER_PAGE_SIZE=50;
interface StoredPlayer extends InternalFootballer {age?:number}
interface StoredRow {id:number;payload_json:string}

export async function readPublicPlayers(db:Database,page:number){
 if(!Number.isSafeInteger(page)||page<1||page>9999)throw new ApiError(422,'invalid_public_request');
 const before=await readWorld(db);
 const countRow=await db.prepare('SELECT COUNT(*) AS n FROM generated_players WHERE world_generation=?')
  .bind(before.generation).first<{n:number}>();
 const count=countRow?.n??0;
 const totalPages=Math.max(1,Math.ceil(count/PUBLIC_PLAYER_PAGE_SIZE));
 const rows=page<=totalPages
  ?(await db.prepare('SELECT id,payload_json FROM generated_players WHERE world_generation=? ORDER BY created_at DESC,id ASC LIMIT ? OFFSET ?')
    .bind(before.generation,PUBLIC_PLAYER_PAGE_SIZE,(page-1)*PUBLIC_PLAYER_PAGE_SIZE).all<StoredRow>()).results
  :[];
 const after=await readWorld(db);
 if(after.generation!==before.generation)throw new ApiError(409,'stale_world');
 return {
  count,page,pageSize:PUBLIC_PLAYER_PAGE_SIZE,totalPages,
  players:rows.map(row=>{
   const payload=JSON.parse(row.payload_json) as StoredPlayer;
   return projectPublicFootballerProfile(payload,{publicId:row.id,currentAge:payload.age});
  })
 };
}
