/** #763: explicit write-side maintenance of a derived, versioned read model. */
import type {Database,Statement} from './database.ts';
import {MARKET_VALUE_CONFIG} from './player-market-value.mjs';
import {FORECAST_EXPOSURES} from './player-market-value-forecast-data.mjs';
import {projectPublicFootballerDirectoryRecord,type InternalFootballer} from './footballer-public-projection.ts';

// Hash coefficients AND aggregate forecast data automatically; bump the
// algorithm token if suitability or forecast algorithm semantics change.
let versionPromise:Promise<string>|undefined;
export function marketValueIndexVersion(){
 return versionPromise??=crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([MARKET_VALUE_CONFIG,FORECAST_EXPOSURES])))
  .then(bytes=>'market-value-index-v1:'+Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join(''));
}
export const MARKET_VALUE_INDEX_BATCH_SIZE=200;
type Source=InternalFootballer&{age?:number};
type Pending={player_id:number;input_revision:number;config_version:string|null;payload_json:string};
type Update={id:number;revision:number;previous:string|null;value:number|null};
export function marketValueIndexUpdate(id:number,revision:number,previous:string|null,source:Source):Update{
 return {id,revision,previous,value:projectPublicFootballerDirectoryRecord(source,{publicId:id,currentAge:source.age}).market_value_arc};
}
/** Compare-and-set on revision AND previous configuration; no stale write can
 * resurrect an invalidated value. Can be appended to an existing D1 batch. */
export function marketValueIndexWrite(db:Database,version:string,updates:readonly Update[]){
 return db.prepare(`UPDATE player_market_values AS v
  SET config_version=?,market_value_arc=json_extract(j.value,'$.value')
  FROM json_each(?) AS j
  WHERE v.player_id=json_extract(j.value,'$.id')
   AND v.input_revision=json_extract(j.value,'$.revision')
   AND v.config_version IS json_extract(j.value,'$.previous')`).bind(version,JSON.stringify(updates));
}
/** Readiness is checked in the SAME D1 batch as count and page, not in a
 * separate request. Null value with current version means genuinely unavailable;
 * null version means pending. Coverage also detects unexpected missing rows. */
export function marketValueIndexReadiness(db:Database,version:string){
 return db.prepare(`SELECT CASE WHEN
  (SELECT COUNT(*) FROM player_market_values)=(SELECT COUNT(*) FROM generated_players)
  AND NOT EXISTS (SELECT 1 FROM player_market_values WHERE config_version IS NULL)
  AND NOT EXISTS (SELECT 1 FROM player_market_values WHERE config_version<?)
  AND NOT EXISTS (SELECT 1 FROM player_market_values WHERE config_version>?)
  THEN 1 ELSE 0 END AS ready`).bind(version,version);
}
/** Explicit operator/authorized write path only. Never called from public GET.
 * Safe to retry; each bounded batch derives from the current persisted inputs. */
export async function refreshMarketValueIndexBatch(db:Database,limit=MARKET_VALUE_INDEX_BATCH_SIZE,access:Statement[]=[]){
 if(!Number.isSafeInteger(limit)||limit<1||limit>MARKET_VALUE_INDEX_BATCH_SIZE)throw Error('invalid_market_value_batch_size');
 if(access.length)await db.batch(access);
 const version=await marketValueIndexVersion();
 const pending=(await db.prepare(`SELECT v.player_id,v.input_revision,v.config_version,p.payload_json
  FROM player_market_values v JOIN generated_players p ON p.id=v.player_id
  WHERE v.config_version IS NULL OR v.config_version<? OR v.config_version>?
  ORDER BY v.player_id LIMIT ?`).bind(version,version,limit).all<Pending>()).results;
 if(!pending.length){
  const ready=await marketValueIndexReadiness(db,version).first<{ready:number}>();
  return {selected:0,updated:0,ready:ready?.ready===1};
 }
 const updates=pending.map(row=>marketValueIndexUpdate(row.player_id,row.input_revision,row.config_version,JSON.parse(row.payload_json) as Source));
 const write=marketValueIndexWrite(db,version,updates);
 const result=access.length?(await db.batch([...access,write])).at(-1)!:await write.run();
 return {selected:pending.length,updated:result.meta.changes,ready:false};
}
