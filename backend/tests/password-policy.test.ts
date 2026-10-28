import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePasswordShape as check } from '../src/password-policy.ts';

test('requires between 15 and 128 Unicode code points', () => {
  assert.equal(check('a'.repeat(14)), 'invalid_length');
  assert.equal(check('a'.repeat(15)), null);
  assert.equal(check('a'.repeat(128)), null);
  assert.equal(check('a'.repeat(129)), 'invalid_length');
  assert.equal(check('🔐'.repeat(15)), null);
  assert.equal(check('🔐'.repeat(129)), 'invalid_length');
});

test('preserves exact password bytes, including spaces and composed forms', () => {
  assert.equal(check(' abcdefghijklmno '), null);
  assert.equal(check('é'.repeat(15)), null);
  assert.equal(check('e\u0301'.repeat(15)), null);
  assert.notEqual('é'.repeat(15), 'e\u0301'.repeat(15));
});

test('rejects nonstrings and malformed surrogate pairs', () => {
  assert.equal(check(null), 'invalid_type');
  assert.equal(check(123), 'invalid_type');
  assert.equal(check('a'.repeat(15) + '\ud800'), 'invalid_encoding');
  assert.equal(check('\udc00' + 'a'.repeat(15)), 'invalid_encoding');
  assert.equal(check('🔐'.repeat(128)), null);
});
