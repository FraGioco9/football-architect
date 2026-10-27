import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeEmail, parseOperatorEmail } from '../src/email-identity.ts';
import { ApiError } from '../src/errors.ts';

test('operator email identifier is trimmed and lowercased', () => {
  assert.equal(normalizeEmail('  Admin.Test+01@EXAMPLE.Invalid  '),'admin.test+01@example.invalid');
  assert.equal(parseOperatorEmail('  Admin.Test+01@EXAMPLE.Invalid  '),'admin.test+01@example.invalid');
});
test('invalid identifiers have a stable nonsensitive error',()=>{
  for(const value of [null,12,'','admin','a@b','a@@example.invalid','a @example.invalid',
    'admin@example.invalid\u0000','x'.repeat(255)+'@example.invalid']){
    assert.throws(()=>parseOperatorEmail(value),(err:unknown)=>err instanceof ApiError &&
      err.status===422 && err.code==='invalid_credentials');
  }
});
