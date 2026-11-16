/** #613: local D1-only rollback/immutability for an unwired planned receipt.
 * No deployment, HTTP handler or official world-day processing imports this file.
 */
import {beforeAll,describe,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import type {Database} from '../src/database.ts';
import {readWorld} from '../src/world-repository.ts';
import {matchIdForSlot} from '../src/domain/calendar/match-slot-identity.ts';
import {ATTRIBUTES} from '../src/players-generator-core.mjs';
import {planMatchSimulationReceiptV1} from '../src/match-lineup-snapshot-v1.mjs';

const bindings=env as unknown as {DB:Database;TEST_MIGRATIONS:Parameters<typeof applyD1Migrations>[1]};
const db=bindings.DB;
const now=1_800_000_000,sourceHash='a'.repeat(64);
const fixtureId='season:1:IT-1:N01:IT-1:IT-2';
const roles=['GK','RB','CB','CB','LB','CM','DM','CM','RW','ST','LW','ST'];
const seed='temporary-d1-test-seed-2026';
let generation:string,matchId:number,slotMatchId:string;

beforeAll(async()=>{
 await applyD1Migrations(db as Parameters<typeof applyD1Migrations>[0],bindings.TEST_MIGRATIONS);
 generation=(await readWorld(db)).generation;
 await db.prepare("UPDATE world_state SET season_number=1,day=12,phase='active',revision=2 WHERE id=1").run();
 await db.prepare('INSERT INTO seasons(season_number,generation,participants_hash,rules_hash,snapshot_json,created_at) VALUES(?,?,?,?,?,?)')
  .bind(1,generation,sourceHash,'b'.repeat(64),'{}',now).run();
 slotMatchId=await matchIdForSlot({generation,season:1,competitionId:'IT-1',phaseId:'league',slotId:'round:1:match:1'});
 await db.prepare('INSERT INTO season_match_slots(match_id,generation,season_number,competition_id,phase_id,slot_id,source_fixture_id,marker,scheduled_day,round_number,home_club_id,away_club_id,source_kind,source_hash,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  .bind(slotMatchId,generation,1,'IT-1','league','round:1:match:1',fixtureId,'N01',13,1,'IT-1','IT-2','calendar',sourceHash,now).run();
 await db.prepare('INSERT INTO public_match_numbers(slot_match_id,generation,season_number) VALUES(?,?,?)')
  .bind(slotMatchId,generation,1).run();
 matchId=(await db.prepare('SELECT id FROM public_match_numbers WHERE slot_match_id=?')
  .bind(slotMatchId).first<{id:number}>())!.id;
 const draft='00000000-0000-4000-8000-000000000613';
 await db.prepare('INSERT INTO player_generation_drafts(id,world_generation,season_number,account_id,options_json,candidates_json,count,seed,status,created_at,expires_at,committed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
  .bind(draft,generation,1,'d1-unwired-test','{}','[]',12,seed,'committed',now,now+1000,now+10).run();
 for(let i=0;i<12;i++){
  const id=i+1;
  const payload=JSON.stringify({career_status:'active',primary_position:roles[i],secondary_positions:[],
   attributes:Object.fromEntries(ATTRIBUTES.map(attr=>[attr,61])),
   development_aptitude:91});
  await db.prepare('INSERT INTO generated_players(id,batch_id,world_generation,entry_season,payload_json,created_at) VALUES(?,?,?,?,?,?)')
   .bind(id,draft,generation,1,payload,now+20).run();
  if(id<=11)await db.prepare('INSERT INTO player_club_affiliations(player_id,club_key) VALUES(?,?)')
   .bind(id,'IT-1').run();
 }
});

const input=async()=>({
 match:{matchId,season:1,day:13,fixtureId,competitionId:'IT-1',homeClubId:'IT-1',awayClubId:'IT-2',sourceHash},
 world:{generation,revision:2,seasonNumber:1,day:12,phase:'active'},
 seed,context:{mode:'regulation'},now:now+30,
});

describe('#613 local Worker D1 guarded match receipts (not wired to official clock)',()=>{
 it('rollback on concurrent transfer, then immutable single authoritative receipt',async()=>{
  const args=await input();
  const staged=await planMatchSimulationReceiptV1(db,args);
  expect(staged.kind).toBe('lineup_candidate');
  if(staged.kind!=='lineup_candidate')throw Error('missing XI');
  // A contract change does not increment world revision: guard must still abort the batch.
  await db.prepare("UPDATE player_club_affiliations SET club_key='IT-3' WHERE player_id=1").run();
  await expect(db.batch([...staged.guards,...staged.writes])).rejects.toThrow();
  expect((await db.prepare('SELECT COUNT(*) AS n FROM match_lineup_result_receipts').first<{n:number}>())?.n).toBe(0);
  await db.prepare("UPDATE player_club_affiliations SET club_key='IT-1' WHERE player_id=1").run();
  // Also reject a new affiliation that changes the count, even with all original players intact.
  await db.prepare("INSERT INTO player_club_affiliations(player_id,club_key) VALUES(?,?)").bind(12,'IT-2').run();
  await expect(db.batch([...staged.guards,...staged.writes])).rejects.toThrow();
  expect((await db.prepare('SELECT COUNT(*) AS n FROM match_lineup_result_receipts').first<{n:number}>())?.n).toBe(0);
  await db.prepare('DELETE FROM player_club_affiliations WHERE player_id=?').bind(12).run();
  const fresh=await planMatchSimulationReceiptV1(db,args);
  expect(fresh.kind).toBe('lineup_candidate');
  if(fresh.kind!=='lineup_candidate')throw Error('missing XI');
  await db.batch([...fresh.guards,...fresh.writes]);
  const row=await db.prepare('SELECT receipt_hash,receipt_json FROM match_lineup_result_receipts WHERE public_match_id=?')
   .bind(matchId).first<{receipt_hash:string;receipt_json:string}>();
  expect(row?.receipt_hash).toBe(fresh.receiptHash);
  expect(JSON.parse(row!.receipt_json).result.home.starters).toHaveLength(11);
  await expect(db.batch([...fresh.guards,...fresh.writes])).rejects.toThrow();
  await expect(db.prepare('UPDATE match_lineup_result_receipts SET receipt_hash=? WHERE public_match_id=?')
   .bind('c'.repeat(64),matchId).run()).rejects.toThrow();
  await expect(db.prepare('DELETE FROM match_lineup_result_receipts WHERE public_match_id=?')
   .bind(matchId).run()).rejects.toThrow();
  // Current roster changes do not alter a frozen receipt, even if an individual retires.
  await db.prepare("UPDATE player_club_affiliations SET club_key='IT-3' WHERE player_id=1").run();
  const preserved=await db.prepare('SELECT receipt_hash,receipt_json FROM match_lineup_result_receipts WHERE public_match_id=?')
   .bind(matchId).first<{receipt_hash:string;receipt_json:string}>();
  expect(preserved).toEqual(row);
 });
});
