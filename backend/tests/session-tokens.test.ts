import assert from 'node:assert/strict';
import test from 'node:test';
import {createOpaqueToken,digestOpaqueToken,getSessionDeadlines} from '../src/session-tokens.ts';

test('cryptographic session tokens are 256-bit and independently random',()=>{
  const tokens=Array.from({length:100},()=>createOpaqueToken());
  assert.equal(new Set(tokens).size,tokens.length);
  for(const token of tokens) assert.match(token,/^[0-9a-f]{64}$/);
});
test('storage digests are deterministic and never equal plaintext tokens',async()=>{
  const token=createOpaqueToken();
  const digest=await digestOpaqueToken(token);
  assert.match(digest,/^[0-9a-f]{64}$/);
  assert.notEqual(digest,token);
  assert.equal(await digestOpaqueToken(token),digest);
  assert.notEqual(await digestOpaqueToken(createOpaqueToken()),digest);
  for(const malformed of ['','ABC','f'.repeat(63),'z'.repeat(64),'f'.repeat(65)])
    await assert.rejects(digestOpaqueToken(malformed),/invalid_token/);
});
test('session expiry policy is bounded to eight hours absolute and 30 minutes idle',()=>{
  const t=1700000000;
  assert.deepEqual(getSessionDeadlines(t),{absoluteExpiresAt:t+28800,idleExpiresAt:t+1800});
  assert.throws(()=>getSessionDeadlines(-1));
  assert.throws(()=>getSessionDeadlines(1.5));
});
