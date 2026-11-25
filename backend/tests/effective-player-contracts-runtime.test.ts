import {test,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import type {Database} from '../src/database.ts';
import {readPublicPlayer,readPublicPlayers} from '../src/public-players-read.ts';
import {readPublicClubRoster} from '../src/public-club-roster-read.ts';
import {PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS} from '../src/footballer-public-projection.ts';
import {CURRENT_PLAYER_CONTRACTS_SQL,NEXT_MATCH_PLAYER_CONTRACTS_SQL} from '../src/effective-player-contracts.mjs';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';

test('#777 signed-term roster projections use effective dates, never affiliation fallback',async()=>{
 const bindings=env as unknown as {DB:Database;TEST_MIGRATIONS:Parameters<typeof applyD1Migrations>[1]};
 const db=bindings.DB;
 await applyD1Migrations(db as Parameters<typeof applyD1Migrations>[0],bindings.TEST_MIGRATIONS);
 const world=(await db.prepare('SELECT generation FROM world_state WHERE id=1').first<{generation:string}>())!;
 const gen=world.generation,batch=crypto.randomUUID(),now=1800000000;
 await db.prepare("INSERT INTO player_generation_drafts(id,world_generation,season_number,account_id,options_json,candidates_json,count,seed,status,created_at,expires_at,committed_at) VALUES(?,?,0,'fixture','{}','[]',6,'fixture','committed',?,?,?)").bind(batch,gen,now,now+3600,now).run();
 for(let i=1;i<=6;i++)await db.prepare('INSERT INTO generated_players(id,batch_id,world_generation,entry_season,payload_json,created_at) VALUES(?,?,?,0,?,?)').bind(i,batch,gen,JSON.stringify({id:i,first_name:'First'+i,last_name:'Last'+i,nationality:'ITA',age:22,retirement_age:40,career_status:i===4?'retired':'active',height_cm:180,preferred_foot:'right',primary_position:'CM',secondary_positions:[],attributes:Object.fromEntries(PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS.map(k=>[k,50]))}),now).run();
 // Full migration chain has removed the legacy storage; unsigned players remain free.
 expect(await db.prepare("SELECT name FROM sqlite_schema WHERE name='player_club_affiliations'").first()).toBeNull();
 async function sign(id:number,club:string,start:number,key:string){
  await db.prepare(`INSERT INTO player_signed_contracts(player_id,world_generation,club_key,signed_at_ms,start_tick,duration_seasons,scheduled_end_tick,annual_salary_arc,minimum_arc,reference_arc,maximum_arc,policy_version,ai_demand_arc,signing_key)
   VALUES(?,?,?,?,?,1,?,125,40,100,200,'contract-draft-v1',125,?)`).bind(id,gen,club,now*1000,start,(Math.floor(start/56)+1)*56,key).run();
 }
 await sign(1,'IT-1',0,'fixture-1');
 await sign(2,'IT-2',2,'fixture-2');
 await sign(3,'IT-1',0,'fixture-3');
 await db.prepare("UPDATE player_signed_contracts SET closed_tick=2,close_reason='transfer' WHERE player_id=3").run();
 await sign(3,'IT-2',2,'fixture-3-new');
 await sign(4,'IT-1',0,'fixture-4');
 await sign(5,'IT-1',56,'fixture-5');
 const read=async (sql:string)=>(await db.prepare('SELECT player_id,club_key FROM '+sql+' ORDER BY player_id').all()).results;
 const row=(player_id:number,club_key:string)=>({player_id,club_key});
 expect(await read(CURRENT_PLAYER_CONTRACTS_SQL)).toEqual([row(1,'IT-1'),row(3,'IT-1')]);
 expect(await read(NEXT_MATCH_PLAYER_CONTRACTS_SQL)).toEqual([]);
 const directory=await readPublicPlayers(db,1);
 expect(directory.players.find(p=>p.id===1)?.clubKey).toBe('IT-1');
 expect(directory.players.find(p=>p.id===6)?.clubKey).toBeNull();
 expect(directory.players.find(p=>p.id===4)?.clubKey).toBeNull();
 const detail=await readPublicPlayer(db,1),roster=await readPublicClubRoster(db,'IT-1');
 expect(detail.player.clubKey).toBe('IT-1');
 expect(roster.players.map(p=>p.id)).toEqual([1,3]);
 expect(detail.player.market_value_arc).toBe(roster.players[0].market_value_arc);
 expect((await readPublicClubRoster(db,'IT-40')).count).toBe(0);
 expect(JSON.stringify(directory)).not.toMatch(/annual_salary_arc|signed_mandate_id|signing_key|contract_id/);
 // This projection-only fixture uses the same validated bindings in both
 // seasons; no sporting progression or qualification authority is simulated.
 const snapshot=await loadApprovedSnapshot();
 const insertSnapshot=(season:number)=>db.prepare('INSERT INTO seasons(season_number,generation,participants_hash,rules_hash,snapshot_json,created_at) VALUES(?,?,?,?,?,?)').bind(season,gen,snapshot.participantsHash,snapshot.rulesHash,JSON.stringify(snapshot),now);
 await insertSnapshot(1).run();
 await db.prepare("UPDATE world_state SET season_number=1,day=0,phase='preparing',revision=1 WHERE id=1").run();
 expect(await read(NEXT_MATCH_PLAYER_CONTRACTS_SQL)).toEqual([row(1,'IT-1'),row(3,'IT-1')]);
 await db.prepare("UPDATE world_state SET day=2,phase='active',revision=2 WHERE id=1").run();
 expect(await read(CURRENT_PLAYER_CONTRACTS_SQL)).toEqual([row(1,'IT-1'),row(3,'IT-1')]);
 expect(await read(NEXT_MATCH_PLAYER_CONTRACTS_SQL)).toEqual([row(1,'IT-1'),row(2,'IT-2'),row(3,'IT-2')]);
 await db.prepare("UPDATE world_state SET day=3,revision=3 WHERE id=1").run();
 expect(await read(CURRENT_PLAYER_CONTRACTS_SQL)).toEqual([row(1,'IT-1'),row(2,'IT-2'),row(3,'IT-2')]);
 await db.prepare("UPDATE world_state SET day=56,phase='closed',revision=4 WHERE id=1").run();
 expect(await read(NEXT_MATCH_PLAYER_CONTRACTS_SQL)).toEqual([]);
 // The Lifecycle guard requires the persisted next snapshot, and rejects
 // missing or invalid source data. Keep this atomic test transition valid.
 await expect(db.prepare("UPDATE world_state SET season_number=2,day=0,phase='preparing',revision=5 WHERE id=1").run()).rejects.toThrow('invalid player lifecycle source');
 await db.batch([insertSnapshot(2),db.prepare("UPDATE world_state SET season_number=2,day=0,phase='preparing',revision=5 WHERE id=1")]);
 expect((await db.prepare("SELECT json_extract(payload_json,'$.age') AS age FROM generated_players ORDER BY id").all<{age:number}>()).results.map(r=>r.age)).toEqual([23,23,23,22,23,23]);
 expect(await read(CURRENT_PLAYER_CONTRACTS_SQL)).toEqual([row(5,'IT-1')]);
 expect(await read(NEXT_MATCH_PLAYER_CONTRACTS_SQL)).toEqual([row(5,'IT-1')]);
 expect((await db.prepare('SELECT COUNT(*) n FROM player_signed_contracts').first<{n:number}>())?.n).toBe(6);
 // Disposable D1 test isolation rolls back storage; do not bypass immutability triggers.
});
