import {beforeAll,describe,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';

const bindings=env as unknown as {DB:Parameters<typeof applyD1Migrations>[0];TEST_MIGRATIONS:Parameters<typeof applyD1Migrations>[1]};
const db=bindings.DB;
beforeAll(async()=>{
 await applyD1Migrations(db,bindings.TEST_MIGRATIONS);
 await db.prepare("INSERT INTO seasons(season_number,generation,participants_hash,rules_hash,snapshot_json,created_at) VALUES(1,?,?,?,?,?)")
  .bind('fixture-generation','a'.repeat(64),'b'.repeat(64),'{}',1).run();
});
describe('real local D1 season artifact migration (no published data)',()=>{
 it('has no generated calendars/draws and preserves source Season0',async()=>{
  expect((await db.prepare('SELECT count(*) AS n FROM season_calendars').first<{n:number}>())?.n).toBe(0);
  expect((await db.prepare('SELECT count(*) AS n FROM season_draws').first<{n:number}>())?.n).toBe(0);
  expect((await db.prepare('SELECT phase FROM world_state WHERE id=1').first<{phase:string}>())?.phase).toBe('unstarted');
 });
 it('persists a local season calendar, prohibits overwrite and rejects invalid parent',async()=>{
  const value=[1,'world56-v1','c'.repeat(64),'{"days":[]}','generated',1] as const;
  await db.prepare('INSERT INTO season_calendars VALUES(?,?,?,?,?,?)').bind(...value).run();
  await expect(db.prepare('INSERT INTO season_calendars VALUES(?,?,?,?,?,?)').bind(...value).run()).rejects.toThrow();
  await expect(db.prepare("UPDATE season_calendars SET calendar_json='{}' WHERE season_number=1").run()).rejects.toThrow();
  await expect(db.prepare('INSERT INTO season_calendars VALUES(?,?,?,?,?,?)').bind(2,...value.slice(1)).run()).rejects.toThrow();
  expect((await db.prepare('SELECT calendar_hash FROM season_calendars WHERE season_number=1').first<{calendar_hash:string}>())?.calendar_hash).toBe('c'.repeat(64));
 });
 it('stores deterministic draw provenance and refuses mutations/corrupt JSON',async()=>{
  const value=[1,'int-1','league','int24-v1','0123456789abcdef','d'.repeat(64),'{"pairs":[]}','generated',1] as const;
  await db.prepare('INSERT INTO season_draws VALUES(?,?,?,?,?,?,?,?,?)').bind(...value).run();
  await expect(db.prepare("UPDATE season_draws SET seed='malicious-change' WHERE season_number=1").run()).rejects.toThrow();
  await expect(db.prepare('INSERT INTO season_draws VALUES(?,?,?,?,?,?,?,?,?)').bind(1,'int-2','league','int24-v1','0123456789abcdef','d'.repeat(64),'[]','generated',1).run()).rejects.toThrow();
  await db.prepare("UPDATE season_draws SET status='validated' WHERE season_number=1").run();
  expect((await db.prepare('SELECT status FROM season_draws WHERE season_number=1').first<{status:string}>())?.status).toBe('validated');
 });
 it('transactionally rolls back calendar insert if a draw integrity guard fails',async()=>{
  const before=(await db.prepare('SELECT count(*) AS n FROM season_calendars').first<{n:number}>())?.n;
  await expect(db.batch([
   db.prepare('INSERT INTO season_calendars VALUES(?,?,?,?,?,?)').bind(1,'duplicate','f'.repeat(64),'{}','generated',1),
   db.prepare('INSERT INTO season_draws VALUES(?,?,?,?,?,?,?,?,?)').bind(1,'int-3','league','int24-v1','0123456789abcdef','x','{}','generated',1),
  ])).rejects.toThrow();
  expect((await db.prepare('SELECT count(*) AS n FROM season_calendars').first<{n:number}>())?.n).toBe(before);
 });
});
