import setupWasm from 'argon2id/lib/setup.js';
import simdModule from 'argon2id/dist/simd.wasm';
import nonSimdModule from 'argon2id/dist/no-simd.wasm';

// One WASM instance owns mutable linear memory; never run two hashes against it at once.
// Bound the waiting queue so concurrent login bursts fail closed rather than grow without limit.
let queueTail: Promise<void> = Promise.resolve();
let pending = 0;
const MAX_PENDING = 4;
async function exclusiveHash<T>(work: () => Promise<T>): Promise<T> {
  if (pending >= MAX_PENDING) throw new Error('password_hash_busy');
  pending++;
  const previous = queueTail;
  let release!: () => void;
  queueTail = new Promise<void>(resolve => { release = resolve; });
  try {
    await previous;
    return await work();
  } finally {
    pending--;
    release();
  }
}

const wasmHash = setupWasm(
  (imports: WebAssembly.Imports) => WebAssembly.instantiate(simdModule, imports).then(instance => ({instance, module:simdModule})),
  (imports: WebAssembly.Imports) => WebAssembly.instantiate(nonSimdModule, imports).then(instance => ({instance, module:nonSimdModule})),
);
import { validatePasswordShape } from './password-policy.ts';

const MEMORY_KIB = 19456; // 19 MiB, Argon2id minimum for this application
const ITERATIONS = 2;
const PARALLELISM = 1;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const PREFIX = '$argon2id$v=19$m=19456,t=2,p=1$';
const BASE64 = /^[A-Za-z0-9+/]+$/;
const COMMON = new Set([
  'passwordpassword','password123456','password123456789',
  '123456789012345','1234567890123456','qwertyuiopasdfgh',
  'adminadminadmin','letmeinletmein123','iloveyouiloveyou',
  'correcthorsebatterystaple',
]);

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/,'');
}
function decode(encoded: string, expectedBytes: number): Uint8Array | null {
  if (!BASE64.test(encoded)) return null;
  try {
    const decoded=atob(encoded + '='.repeat((4-encoded.length%4)%4));
    if (decoded.length!==expectedBytes) return null;
    const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
    return encode(bytes)===encoded ? bytes : null;
  } catch { return null; }
}
function allowedPassword(password: unknown): password is string {
  return validatePasswordShape(password)===null;
}

export async function hashPassword(password: string): Promise<string> {
  if (!allowedPassword(password) || COMMON.has(password.toLowerCase()))
    throw new TypeError('invalid_password');
  const salt=crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const tag=await exclusiveHash(async () => {
    const compute = await wasmHash;
    return compute({password:new TextEncoder().encode(password),salt,passes:ITERATIONS,
      parallelism:PARALLELISM,memorySize:MEMORY_KIB,tagLength:HASH_BYTES});
  });
  const encoded=PREFIX+encode(salt)+'$'+encode(tag);
  tag.fill(0);
  salt.fill(0);
  return encoded;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (!allowedPassword(password) || typeof encoded!=='string' || !encoded.startsWith(PREFIX))
    return false;
  const parts=encoded.slice(PREFIX.length).split('$');
  if (parts.length!==2) return false;
  const salt=decode(parts[0],SALT_BYTES), expected=decode(parts[1],HASH_BYTES);
  if (!salt || !expected) return false;
  const actual=await exclusiveHash(async () => {
    const compute = await wasmHash;
    return compute({password:new TextEncoder().encode(password),salt,passes:ITERATIONS,
      parallelism:PARALLELISM,memorySize:MEMORY_KIB,tagLength:HASH_BYTES});
  });
  let difference=0;
  for(let i=0;i<HASH_BYTES;i++) difference|=actual[i]^expected[i];
  actual.fill(0);
  expected.fill(0);
  salt.fill(0);
  return difference===0;
}
