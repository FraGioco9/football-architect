import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiError} from '../src/errors.ts';
import {requireMutationOrigin,adminCookiePolicy} from '../src/origin-policy.ts';

test('only exact configured origin passes, no missing, null, subdomain or suffix',()=>{
  assert.doesNotThrow(()=>requireMutationOrigin('https://app.example.invalid','https://app.example.invalid'));
  for (const origin of [null,'null','http://app.example.invalid','https://evil.app.example.invalid','https://app.example.invalid.evil.test','https://app.example.invalid:444','https://other.invalid'])
    assert.throws(()=>requireMutationOrigin(origin,'https://app.example.invalid'),(e:unknown)=>e instanceof ApiError && e.status===403);
});
test('malformed or credentialed source configuration fails closed',()=>{
  for (const config of ['','https://a.invalid/path','https://user:pass@a.invalid','https://a.invalid?x=1','ftp://a.invalid'])
    assert.throws(()=>requireMutationOrigin('https://a.invalid',config),(e:unknown)=>e instanceof ApiError && e.status===503);
});
test('production cookies enforce HTTPS and host-prefix restrictions',()=>{
  assert.equal(adminCookiePolicy('production','https://app.example.invalid/'),
    '__Host-fa_admin; Secure; HttpOnly; SameSite=Strict; Path=/');
  assert.throws(()=>adminCookiePolicy('production','http://app.example.invalid/'));
  assert.match(adminCookiePolicy('local','http://127.0.0.1:8787/'),/^fa_admin_local;/);
  assert.throws(()=>adminCookiePolicy('local','http://192.168.1.4:8787/'));
  assert.throws(()=>adminCookiePolicy('local','https://app.example.invalid/'));
  assert.throws(()=>adminCookiePolicy('staging','https://app.example.invalid/'));
});
