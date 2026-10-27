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
});
