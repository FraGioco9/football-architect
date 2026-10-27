import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorldV1 } from '../src/types.ts';
import { projectWorld } from '../src/public-projections.ts';

const generation = '550e8400-e29b-41d4-a716-446655440000';
const unstarted = { schemaVersion: 1, generation, revision: 0, seasonNumber: 0, day: 0, phase: 'unstarted' };
test('fresh Season 0 is a real, valid initial world', () => {
  assert.deepEqual(parseWorldV1(unstarted), unstarted);
});
test('anonymous projection does not include operator or session data', () => {
  const internal = { ...unstarted, operatorEmail: 'private@example.invalid', sessionDigest: 'secret' };
  assert.deepEqual(projectWorld(internal), unstarted);
});
test('rejects malformed and inconsistent persisted worlds', () => {
  for (const state of [
    null, {}, { ...unstarted, schemaVersion: 2 }, { ...unstarted, generation: 'guess' },
    { ...unstarted, revision: -1 }, { ...unstarted, revision: 1 },
    { ...unstarted, seasonNumber: 1 }, { ...unstarted, day: 1 },
    { ...unstarted, phase: 'active' }, { ...unstarted, phase: 'closed' },
    { ...unstarted, day: 57 }, { ...unstarted, revision: 1.5 },
    { ...unstarted, phase: 'preparing', seasonNumber: 1, day: 1 },
    { ...unstarted, phase: 'active', seasonNumber: 1, revision: 1, day: 0 },
  ]) assert.throws(() => parseWorldV1(state), /invalid_world/);
});
test('accepts prepared, active and closed season projections', () => {
  for (const state of [
    { ...unstarted, revision: 1, seasonNumber: 1, day: 0, phase: 'preparing' },
    { ...unstarted, revision: 2, seasonNumber: 1, day: 1, phase: 'active' },
    { ...unstarted, revision: 57, seasonNumber: 1, day: 56, phase: 'closed' },
  ]) assert.deepEqual(parseWorldV1(state), state);
});
