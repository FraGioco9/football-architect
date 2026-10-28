import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors.ts';
import { createOpaqueToken, digestOpaqueToken } from '../src/session-tokens.ts';
import {requireStoredSession, type SessionDatabase} from '../src/session-repository.ts';

const now=1_800_000_000;
const session={account_id:'operator',session_credential_version:3,account_credential_version:3,
  enabled:1,created_at:now-100,last_seen_at:now-10,expires_at:now+2000};
test('queries the digest rather than a plaintext cookie and enforces current credentials',async()=>{
  const token=createOpaqueToken(),digest=await digestOpaqueToken(token);
  let sql='',bound='';
  const db:SessionDatabase={prepare:(query)=>{
    sql=query;
    return {bind:(value)=>{
      bound=String(value);
      return {first:async <T>()=>session as T};
    }};
  }};
  assert.equal(await requireStoredSession(db,token,now),'operator');
  assert.match(sql,/JOIN admin_accounts/);
  assert.match(sql,/token_digest = \?/);
  assert.equal(bound,digest);
  assert.notEqual(bound,token);
});
test('missing account, revocation and malformed cookie fail closed',async()=>{
  const token=createOpaqueToken();
  for(const row of [null,{...session,account_credential_version:4},{...session,enabled:0}]){
    const db:SessionDatabase={prepare:()=>({bind:()=>({first:async <T>()=>row as T})})};
    await assert.rejects(requireStoredSession(db,token,now),
      (error:unknown)=>error instanceof ApiError && error.status===401);
  }
  await assert.rejects(requireStoredSession(undefined,token,now),
    (error:unknown)=>error instanceof ApiError && error.status===503);
  await assert.rejects(requireStoredSession({prepare:()=>{throw Error('SQL detail');}},token,now),
    (error:unknown)=>error instanceof ApiError && error.code==='admin_unavailable' &&
      !error.message.includes('SQL detail'));
  await assert.rejects(requireStoredSession({prepare:()=>{throw Error('cannot be queried');}},'bad',now),
    (error:unknown)=>error instanceof ApiError && error.code==='unauthorized');
});
