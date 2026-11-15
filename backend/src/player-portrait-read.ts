/** Private, authenticated Admin-only on-demand V3 portrait prompt.
 * This is not part of any public footballer projection.
 */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {renderPortraitPromptFromSnapshot,type PortraitSnapshot} from './player-portrait-core.mjs';

export async function readPlayerPortraitPrompt(db:Database,rawId:unknown){
 if(typeof rawId!=='string'||!/^[1-9][0-9]{0,14}$/.test(rawId)||
    !Number.isSafeInteger(Number(rawId)))throw new ApiError(422,'invalid_portrait_player_id');
 const id=Number(rawId);
 const row=await db.prepare(`SELECT player_id,schema_version,prompt_version,snapshot_json,status,asset_key
  FROM player_portrait_profiles WHERE player_id=?`).bind(id).first<{
   player_id:number;schema_version:string;prompt_version:string;snapshot_json:string;
   status:string;asset_key:string|null
  }>();
 if(!row)throw new ApiError(404,'portrait_not_found');
 let prompt:string;
 try{
  const snapshot=JSON.parse(row.snapshot_json) as PortraitSnapshot;
  if(snapshot.player_id!==id||snapshot.schema_version!==row.schema_version||
     snapshot.prompt_version!==row.prompt_version)throw Error('inconsistent portrait metadata');
  prompt=await renderPortraitPromptFromSnapshot(snapshot);
 }catch{throw new ApiError(503,'portrait_unavailable');}
 return {playerId:id,promptVersion:row.prompt_version,portraitPrompt:prompt,
  status:row.status,assetKey:row.asset_key};
}
