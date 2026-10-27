import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import worker from '../src/index.ts';
import { readWorld } from '../src/world-repository.ts';

const bindings = env as unknown as {
  DB: {
    prepare(sql: string): { first<T>(): Promise<T | null>; run(): Promise<unknown> };
  };
  TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1];
};

beforeAll(async () => {
  await applyD1Migrations(bindings.DB as Parameters<typeof applyD1Migrations>[0], bindings.TEST_MIGRATIONS);
});

describe('official local D1 binding, no remote services', () => {
  it('seeds a valid singleton Season 0 and publishes no secrets', async () => {
    const world = await readWorld(bindings.DB);
    expect(world.schemaVersion).toBe(1);
    expect(world.generation).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(world).toMatchObject({revision:0,seasonNumber:0,day:0,phase:'unstarted'});
    const response = await worker.fetch(new Request('https://local.invalid/api/world'), bindings);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({world});
  });
  it('reapplying migrations retains the same singleton generation', async () => {
    const before = await readWorld(bindings.DB);
    await applyD1Migrations(bindings.DB as Parameters<typeof applyD1Migrations>[0], bindings.TEST_MIGRATIONS);
    expect(await readWorld(bindings.DB)).toEqual(before);
  });
  it('rejects singleton deletion and invalid transitions at D1 boundary', async () => {
    await expect(bindings.DB.prepare('DELETE FROM world_state WHERE id=1').run()).rejects.toThrow();
    await expect(bindings.DB.prepare("UPDATE world_state SET phase='active' WHERE id=1").run()).rejects.toThrow();
    expect((await readWorld(bindings.DB)).phase).toBe('unstarted');
  });
  it('rolls back an entire D1 batch after a failed integrity guard', async () => {
    const generation=(await readWorld(bindings.DB)).generation;
    const before=await readWorld(bindings.DB);
    const db=bindings.DB as unknown as {
      prepare(sql:string): {bind(...values:unknown[]):unknown};
      batch(statements:unknown[]):Promise<unknown>;
    };
    const first=db.prepare(
      "UPDATE world_state SET revision=revision+1, season_number=1, phase='preparing' WHERE id=1 AND generation=? AND revision=0"
    ).bind(generation);
    const reject=db.prepare("INSERT INTO world_state (id,generation) VALUES (2,'impossible')");
    await expect(db.batch([first,reject])).rejects.toThrow();
    expect(await readWorld(bindings.DB)).toEqual(before);
  });
  it('does not enable unauthenticated season preparation', async () => {
    const response = await worker.fetch(new Request('https://local.invalid/api/admin/prepare', {method:'POST'}), bindings);
    expect(response.status).toBe(404);
  });
});
