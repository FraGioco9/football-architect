import {beforeAll,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import type {Database} from '../src/database.ts';
import {readWorld} from '../src/world-repository.ts';
import {
  readSeasonDayOutcomes,readSeasonKnockoutTies,readSeasonCalendarHash,
  countSeasonDayOutcomes,readSeasonArchiveSummary,readSeasonCloseReceipt,
} from '../src/season-evidence-repository.ts';

const bindings=env as unknown as {DB:Database;TEST_MIGRATIONS:Parameters<typeof applyD1Migrations>[1]};
const db=bindings.DB;
const one='a'.repeat(64),two='b'.repeat(64),now=1_800_000_000;
let generation:string;
beforeAll(async()=>{
  await applyD1Migrations(db as Parameters<typeof applyD1Migrations>[0],bindings.TEST_MIGRATIONS);
  generation=(await readWorld(db)).generation;
  for(const season of [1,2]){
    await db.prepare('INSERT INTO seasons(season_number,generation,participants_hash,rules_hash,snapshot_json,created_at) VALUES(?,?,?,?,?,?)')
      .bind(season,generation,one,two,'{}',now).run();
    await db.prepare('INSERT INTO season_calendars(season_number,calendar_version,calendar_hash,calendar_json,status,created_at) VALUES(?,?,?,?,?,?)')
      .bind(season,'synthetic-d1-test-v1',one,'{}','generated',now).run();
  }
  for(const [season,day] of [[1,3],[1,1],[2,1]]){
    await db.prepare('INSERT INTO season_day_outcomes(season_number,generation,day,calendar_hash,simulation_version,outcome_hash,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .bind(season,generation,day,one,'temporary-score-v1',two,'{}',now).run();
  }
  for(const [season,competition,phase,tie] of [[1,'IT-1','playoff','B'],[1,'IT-1','playoff','A'],[2,'IT-1','playoff','C']] as const){
    await db.prepare('INSERT INTO season_knockout_ties(season_number,generation,competition_id,phase_id,tie_id,plan_hash,plan_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .bind(season,generation,competition,phase,tie,one,'{}',now).run();
  }
});

describe('BE-03 season-scoped D1 repositories (local test DB only)',()=>{
  it('isolates seasons and preserves primary-key ordering and selected fields',async()=>{
    expect((await readSeasonDayOutcomes(db,1)).map(r=>r.day)).toEqual([1,3]);
    expect((await readSeasonDayOutcomes(db,2)).map(r=>r.day)).toEqual([1]);
    expect((await readSeasonKnockoutTies(db,1)).map(r=>r.tie_id)).toEqual(['A','B']);
    expect((await readSeasonKnockoutTies(db,2)).map(r=>r.tie_id)).toEqual(['C']);
    const receipt=(await readSeasonDayOutcomes(db,1))[0];
    expect(receipt).toEqual({day:1,generation,calendar_hash:one,simulation_version:'temporary-score-v1',outcome_hash:two,outcome_json:'{}'});
    expect((await readSeasonCalendarHash(db,1))?.calendar_hash).toBe(one);
    expect(await readSeasonCalendarHash(db,3)).toBeNull();
    expect(await countSeasonDayOutcomes(db,1)).toBe(2);
    expect(await countSeasonDayOutcomes(db,2)).toBe(1);
    expect(await readSeasonArchiveSummary(db,1)).toBeNull();
    expect(await readSeasonCloseReceipt(db,1)).toBeNull();
  });
  it('uses existing composite primary keys for season-scoped scans and ordering',async()=>{
    const cases=[
      ['SELECT day,generation,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_day_outcomes WHERE season_number=? ORDER BY day','season_day_outcomes'],
      ['SELECT generation,competition_id,phase_id,tie_id,plan_hash,plan_json FROM season_knockout_ties WHERE season_number=? ORDER BY competition_id,phase_id,tie_id','season_knockout_ties'],
      ['SELECT calendar_hash FROM season_calendars WHERE season_number=?','season_calendars'],
      ['SELECT count(*) AS n FROM season_day_outcomes WHERE season_number=?','season_day_outcomes'],
      ['SELECT generation,archive_hash,summary_hash,summary_json FROM season_archive_summaries WHERE season_number=?','season_archive_summaries'],
      ["SELECT status,receipt_hash FROM season_admin_events WHERE season_number=? AND event_id='season:close' AND kind='close-season'",'season_admin_events'],
    ] as const;
    for(const [sql,table] of cases){
      const plan=(await db.prepare('EXPLAIN QUERY PLAN '+sql).bind(1).all<{detail:string}>()).results;
      expect(plan.length,table).toBeGreaterThan(0);
      expect(plan.some(row=>/SEARCH .* USING (?:COVERING )?(?:INDEX|INTEGER PRIMARY KEY)/i.test(row.detail)),table+': '+JSON.stringify(plan)).toBe(true);
      expect(plan.some(row=>/USE TEMP B-TREE FOR ORDER BY/i.test(row.detail)),table+': '+JSON.stringify(plan)).toBe(false);
    }
  });
  it('preserves batch rollback on a late constraint failure without rewriting receipts',async()=>{
    const before=await readSeasonDayOutcomes(db,1);
    const insertion=()=>db.prepare('INSERT INTO season_day_outcomes(season_number,generation,day,calendar_hash,simulation_version,outcome_hash,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .bind(1,generation,4,one,'temporary-score-v1',two,'{}',now);
    await expect(db.batch([insertion(),insertion()])).rejects.toThrow();
    expect(await readSeasonDayOutcomes(db,1)).toEqual(before);
    await expect(db.prepare('UPDATE season_day_outcomes SET outcome_json=? WHERE season_number=? AND day=?').bind('{"modified":true}',1,1).run()).rejects.toThrow();
    expect(await readSeasonDayOutcomes(db,1)).toEqual(before);
  });
  it('reapplying append-only migrations leaves Season 0 identity and synthetic rows unchanged',async()=>{
    const before=await readWorld(db);
    await applyD1Migrations(db as Parameters<typeof applyD1Migrations>[0],bindings.TEST_MIGRATIONS);
    expect(await readWorld(db)).toEqual(before);
    expect((await readSeasonDayOutcomes(db,1)).map(r=>r.day)).toEqual([1,3]);
  });
});
