import {beforeAll,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import type {Database} from '../src/database.ts';
import {readWorld} from '../src/world-repository.ts';
import {
 readSeasonKnockoutTies,readSeasonCalendarHash,
 readSeasonArchiveSummary,readSeasonCloseReceipt
} from '../src/season-evidence-repository.ts';

const bindings=env as unknown as {DB:Database;TEST_MIGRATIONS:Parameters<typeof applyD1Migrations>[1]};
const db=bindings.DB,hash='a'.repeat(64),receiptHash='b'.repeat(64),now=1_800_000_000;
let generation:string;
type DayRow={day:number;generation:string;calendar_hash:string;simulation_version:string;outcome_hash:string;outcome_json:string};
const days=async(season:number)=>(await db.prepare('SELECT day,generation,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_lineup_day_outcomes WHERE season_number=? ORDER BY day')
 .bind(season).all<DayRow>()).results;
const count=async(season:number)=>(await db.prepare('SELECT COUNT(*) AS n FROM season_lineup_day_outcomes WHERE season_number=?').bind(season).first<{n:number}>())?.n??0;
const payload=(season:number,day:number)=>JSON.stringify({schemaVersion:2,season,generation,day,calendarHash:hash,simulationVersion:'temporary-lineup-v1',results:[]});
const insert=(season:number,day:number)=>db.prepare('INSERT INTO season_lineup_day_outcomes(season_number,generation,day,calendar_hash,simulation_version,outcome_hash,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
 .bind(season,generation,day,hash,'temporary-lineup-v1',receiptHash,payload(season,day),now);

beforeAll(async()=>{
 await applyD1Migrations(db as Parameters<typeof applyD1Migrations>[0],bindings.TEST_MIGRATIONS);
 generation=(await readWorld(db)).generation;
 for(const season of [1,2]){
  await db.prepare('INSERT INTO seasons(season_number,generation,participants_hash,rules_hash,snapshot_json,created_at) VALUES(?,?,?,?,?,?)')
   .bind(season,generation,hash,receiptHash,'{}',now).run();
  await db.prepare('INSERT INTO season_calendars(season_number,calendar_version,calendar_hash,calendar_json,status,created_at) VALUES(?,?,?,?,?,?)')
   .bind(season,'synthetic-d1-test-v2',hash,'{}','generated',now).run();
 }
 for(const [season,day] of [[1,3],[1,1],[2,1]])await insert(season,day).run();
 for(const [season,competition,phase,tie] of [[1,'IT-1','playoff','B'],[1,'IT-1','playoff','A'],[2,'IT-1','playoff','C']] as const)
  await db.prepare('INSERT INTO season_knockout_ties(season_number,generation,competition_id,phase_id,tie_id,plan_hash,plan_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
   .bind(season,generation,competition,phase,tie,hash,'{}',now).run();
});

describe('BE-03 V2 season-scoped D1 reads (isolated local D1)',()=>{
 it('isolates immutable V2 days by season and preserves primary-key ordering',async()=>{
  expect((await days(1)).map(r=>r.day)).toEqual([1,3]);
  expect((await days(2)).map(r=>r.day)).toEqual([1]);
  expect((await readSeasonKnockoutTies(db,1)).map(r=>r.tie_id)).toEqual(['A','B']);
  expect((await readSeasonKnockoutTies(db,2)).map(r=>r.tie_id)).toEqual(['C']);
  expect((await days(1))[0]).toEqual({day:1,generation,calendar_hash:hash,
   simulation_version:'temporary-lineup-v1',outcome_hash:receiptHash,outcome_json:payload(1,1)});
  expect((await readSeasonCalendarHash(db,1))?.calendar_hash).toBe(hash);
  expect(await readSeasonCalendarHash(db,3)).toBeNull();
  expect(await count(1)).toBe(2);expect(await count(2)).toBe(1);
  expect(await readSeasonArchiveSummary(db,1)).toBeNull();
  expect(await readSeasonCloseReceipt(db,1)).toBeNull();
 });
 it('uses indexed season keys for the public V2 receipts and shared metadata',async()=>{
  const queries=[
   ['SELECT day,generation,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_lineup_day_outcomes WHERE season_number=? ORDER BY day','season_lineup_day_outcomes'],
   ['SELECT generation,competition_id,phase_id,tie_id,plan_hash,plan_json FROM season_knockout_ties WHERE season_number=? ORDER BY competition_id,phase_id,tie_id','season_knockout_ties'],
   ['SELECT calendar_hash FROM season_calendars WHERE season_number=?','season_calendars'],
   ['SELECT COUNT(*) AS n FROM season_lineup_day_outcomes WHERE season_number=?','season_lineup_day_outcomes'],
   ['SELECT generation,archive_hash,summary_hash,summary_json FROM season_archive_summaries WHERE season_number=?','season_archive_summaries'],
   ["SELECT status,receipt_hash FROM season_admin_events WHERE season_number=? AND event_id='season:close' AND kind='close-season'",'season_admin_events']
  ] as const;
  for(const [sql,table] of queries){
   const plan=(await db.prepare('EXPLAIN QUERY PLAN '+sql).bind(1).all<{detail:string}>()).results;
   expect(plan.length,table).toBeGreaterThan(0);
   expect(plan.some(r=>/SEARCH .* USING (?:COVERING )?(?:INDEX|INTEGER PRIMARY KEY)/i.test(r.detail)),table+': '+JSON.stringify(plan)).toBe(true);
   expect(plan.some(r=>/USE TEMP B-TREE FOR ORDER BY/i.test(r.detail)),table+': '+JSON.stringify(plan)).toBe(false);
  }
 });
 it('rolls back duplicate V2 receipts and refuses writes over frozen evidence',async()=>{
  const before=await days(1);
  await expect(db.batch([insert(1,4),insert(1,4)])).rejects.toThrow();
  expect(await days(1)).toEqual(before);
  await expect(db.prepare('UPDATE season_lineup_day_outcomes SET outcome_json=? WHERE season_number=? AND day=?')
   .bind(payload(1,1),1,1).run()).rejects.toThrow();
  expect(await days(1)).toEqual(before);
 });
 it('reapplying migrations preserves the current world and sealed V2 rows',async()=>{
  const before=await readWorld(db);
  await applyD1Migrations(db as Parameters<typeof applyD1Migrations>[0],bindings.TEST_MIGRATIONS);
  expect(await readWorld(db)).toEqual(before);
  expect((await days(1)).map(r=>r.day)).toEqual([1,3]);
 });
});
