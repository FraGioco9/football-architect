import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiError} from '../src/errors.ts';
import {csrfFor,requireCsrf,type AdminSession} from '../src/auth.ts';
import {playerCsrfFor,playerRequireCsrf} from '../src/player-auth.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';

const token='a'.repeat(64);
const denied=(error:unknown)=>error instanceof ApiError&&error.status===403&&error.code==='csrf_forbidden';

test('Player and historical Admin keep distinct CSRF derivation namespaces',async()=>{
 const player=await playerCsrfFor(token),legacy=await csrfFor(token);
 assert.notEqual(player,legacy);
 const playerDigest=await digestOpaqueToken(player),legacyDigest=await digestOpaqueToken(legacy);
 const session:AdminSession={actor:{id:'operator',email:'operator@example.invalid'},digest:'b'.repeat(64),credentialVersion:1,csrfDigest:legacyDigest};
 await assert.doesNotReject(playerRequireCsrf(playerDigest,player));
 await assert.doesNotReject(requireCsrf(session,legacy));
 await assert.rejects(()=>requireCsrf(session,player),denied);
 await assert.rejects(()=>playerRequireCsrf(playerDigest,legacy),denied);
});
test('both CSRF checks reject missing, malformed, wrong-case and foreign tokens',async()=>{
 const expected=await digestOpaqueToken(await playerCsrfFor(token));
 const admin:AdminSession={actor:{id:'op',email:'op@example.invalid'},digest:'b'.repeat(64),credentialVersion:1,csrfDigest:expected};
 for(const candidate of [null,'', 'wrong', '0'.repeat(64), 'A'.repeat(64)]){
  await assert.rejects(()=>playerRequireCsrf(expected,candidate),denied);
  await assert.rejects(()=>requireCsrf(admin,candidate),denied);
 }
});
