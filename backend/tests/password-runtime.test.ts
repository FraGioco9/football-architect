import {describe,expect,it} from 'vitest';
import {hashPassword,verifyPassword} from '../src/passwords.ts';

describe('Worker Argon2id password runtime',()=>{
  it('uses 19 MiB, two iterations, one lane and independent salts',async()=>{
    const password='sample🔐-long-credential-2026';
    const one=await hashPassword(password);
    const two=await hashPassword(password);
    expect(one).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
    expect(one).not.toBe(two);
    expect(await verifyPassword(password,one)).toBe(true);
    expect(await verifyPassword('wrong-password-long-2026',one)).toBe(false);
  },90000);
  it('serializes concurrent hashes using one mutable precompiled WASM instance',async()=>{
    const passwords=['concurrency-credential-01','concurrency-credential-02'];
    const encoded=await Promise.all(passwords.map(hashPassword));
    expect(encoded).toHaveLength(2);
    expect(await Promise.all(encoded.map((value,i)=>verifyPassword(passwords[i],value)))).toEqual([true,true]);
    expect(await verifyPassword(passwords[0],encoded[1])).toBe(false);
  },90000);
  it('rejects malformed and understrength encodings without hashing',async()=>{
    const pwd='synthetic-long-passphrase-26';
    for(const encoded of ['','plaintext','$argon2id$v=19$m=4096,t=2,p=1$a$b',
      '$argon2id$v=19$m=19456,t=1,p=1$a$b',
      '$argon2i$v=19$m=19456,t=2,p=1$a$b',
      '$argon2id$v=16$m=19456,t=2,p=1$a$b',
      '$argon2id$v=19$m=19456,t=2,p=1$bad$bad'])
      expect(await verifyPassword(pwd,encoded)).toBe(false);
    await expect(hashPassword('password123456')).rejects.toThrow('invalid_password');
  });
  it('matches independent argon2-cffi 25.1.0 known-answer fixtures at the production floor',async()=>{
    const salt='MDEyMzQ1Njc4OWFiY2RlZg';
    const vectors=[['independent-argon2-vector-2026','vkGKejmMYid+b4y79BCo6CA1EDcoxITIoX90Osr8sZM'],['Unicode 🔐 passphrase 2026','N4zUUixBd8zZ+qk3/uixLIWyDghj/U6V8nmNgUvKr7w']];
    for(const [password,tag] of vectors)expect(await verifyPassword(password,'$argon2id$v=19$m=19456,t=2,p=1$'+salt+'$'+tag)).toBe(true);
  });
  it('caps one isolate to four pending WASM operations and fails overflow closed',async()=>{
    const results=await Promise.allSettled(Array.from({length:5},(_,i)=>hashPassword('bounded-synthetic-password-'+i)));
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(4);
    expect(results.filter(x=>x.status==='rejected')).toHaveLength(1);
    const rejected=results.find(x=>x.status==='rejected') as PromiseRejectedResult;
    expect(String(rejected.reason)).toContain('password_hash_busy');
  });

});
