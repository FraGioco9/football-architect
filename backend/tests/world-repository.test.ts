import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors.ts';
import { readWorld, type WorldDatabase } from '../src/world-repository.ts';

const row = {schema_version:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:0,season_number:0,day:0,phase:'unstarted'};
const database = (value: unknown): WorldDatabase => ({
  prepare: (query) => {
    assert.match(query, /FROM world_state WHERE id = 1/);
    return { first: async <T>() => value as T };
  },
});
test('reads a validated singleton without writing', async () => {
  assert.deepEqual(await readWorld(database(row)), {
    schemaVersion:1,generation:row.generation,revision:0,seasonNumber:0,day:0,phase:'unstarted'
  });
});
test('uninitialized or unavailable storage fails closed', async () => {
  for (const db of [undefined, null, database(null), database({...row, phase:'active'}), {
    prepare: () => { throw new Error('internal SQL SECRET'); }
  }]) {
    await assert.rejects(readWorld(db as WorldDatabase), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status,503);
      assert.equal(error.code,'world_unavailable');
      assert.doesNotMatch(error.message,/SQL SECRET/);
      return true;
    });
  }
});
