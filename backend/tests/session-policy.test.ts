import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors.ts';
import {requireActiveSession, type SessionRow} from '../src/session-policy.ts';

const now = 1_800_000_000;
const valid: SessionRow = {
  account_id:'operator-01',session_credential_version:1,account_credential_version:1,
  enabled:1,created_at:now-200,last_seen_at:now-20,expires_at:now+1800,
};
const rejected = (row: SessionRow|null, time=now) =>
  assert.throws(()=>requireActiveSession(row,time),
    (e:unknown)=>e instanceof ApiError && e.status===401 && e.code==='unauthorized');

test('accepts an enabled operator session within both clocks',()=>{
  assert.equal(requireActiveSession(valid,now),'operator-01');
});
test('rejects missing, disabled or revoked credentials at point of use',()=>{
  rejected(null);
  rejected({...valid,enabled:0});
  rejected({...valid,session_credential_version:1,account_credential_version:2});
});
test('rejects idle and absolute deadline edges',()=>{
  rejected({...valid,last_seen_at:now-1800});
  rejected({...valid,expires_at:now});
  rejected({...valid,created_at:now-28801,last_seen_at:now,expires_at:now+1});
  rejected({...valid,created_at:now+1,last_seen_at:now+1});
});
test('rejects malformed dates and overlong absolute session',()=>{
  rejected({...valid,expires_at:valid.created_at+28801});
  rejected({...valid,created_at:-1});
  rejected({...valid,last_seen_at:now+1});
  rejected({...valid,account_id:''});
  assert.throws(()=>requireActiveSession(valid,Number.NaN),
    (e:unknown)=>e instanceof ApiError && e.status===503);
});
