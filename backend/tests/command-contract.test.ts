import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors.ts';
import { parseIdempotencyKey, parsePrepareRequest } from '../src/command-contract.ts';
import { loadApprovedSnapshot } from '../src/catalogue-snapshot.ts';

const generation='550e8400-e29b-41d4-a716-446655440000';
const valid={expectedGeneration:generation,expectedRevision:0};

test('strict prepare request exposes only revision metadata',()=>{
  assert.deepEqual(parsePrepareRequest(valid),valid);
  for(const invalid of [
    null, [], '', {expectedGeneration:generation},
    {...valid,expectedRevision:-1}, {...valid,expectedRevision:1.2},
    {...valid,expectedRevision:NaN}, {...valid,expectedRevision:Infinity},
    {...valid,expectedRevision:'0'}, {...valid,expectedGeneration:'bad'},
    {...valid,approved:true}, {...valid,participants:[]},
    {...valid,rulesHash:'a'.repeat(64)},
  ]) assert.throws(()=>parsePrepareRequest(invalid),(e:unknown)=>e instanceof ApiError && e.status===422);
});
test('idempotency key rejects short, oversized, whitespace and control bytes',()=>{
  assert.equal(parseIdempotencyKey('prepare-2026-unique-01'),'prepare-2026-unique-01');
  for(const invalid of [null,'','short','x'.repeat(129),'abc defghijklmnop','\r\nInjected: yes','ä'.repeat(20)])
    assert.throws(()=>parseIdempotencyKey(invalid),(e:unknown)=>e instanceof ApiError && e.status===422);
});
test('no production approval is bundled in this foundation',()=>{
  assert.equal(loadApprovedSnapshot(),null);
});
