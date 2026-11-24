/** Test-only synthetic signed terms. Do not use as a production signing adapter. */
import type {Database} from '../../src/database.ts';
export async function seedSignedTestTerm(db:Database,generation:string,id:number,club:string,startTick:number,nowSeconds:number,key:string){
 await db.prepare(`INSERT INTO player_signed_contracts
  (player_id,world_generation,club_key,signed_at_ms,start_tick,duration_seasons,scheduled_end_tick,annual_salary_arc,minimum_arc,reference_arc,maximum_arc,policy_version,ai_demand_arc,signing_key)
  VALUES(?,?,?,?,?,1,?,125,40,100,200,'contract-draft-v1',125,?)`)
  .bind(id,generation,club,nowSeconds*1000,startTick,(Math.floor(startTick/56)+1)*56,key).run();
}
export async function closeSignedTestTerm(db:Database,id:number,tick:number){
 await db.prepare("UPDATE player_signed_contracts SET closed_tick=?,close_reason='release' WHERE player_id=? AND closed_tick IS NULL").bind(tick,id).run();
}
