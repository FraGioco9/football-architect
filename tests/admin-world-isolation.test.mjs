import test from 'node:test';
import assert from 'node:assert/strict';
import {planPublicFiles,isAllowlistedPublicPath,repositoryRoot} from '../tools/publication-guard.mjs';
import {readFileSync} from 'node:fs';
test('actual static publication plan excludes Admin backend, verifier material, fixtures and operator tools',()=>{
 const files=planPublicFiles(repositoryRoot);
 assert.ok(files.length>0);
 for(const file of files){
  assert.ok(!file.startsWith('backend/'),file);
  assert.ok(!file.endsWith('.wasm'),file);
  if(/\.(?:js|mjs|html|json)$/.test(file))assert.doesNotMatch(readFileSync(new URL('../'+file,import.meta.url),'utf8'),/synthetic-operator-password-2026|local-synthetic-password-2026|\$argon2id\$v=19\$m=19456/,'private backend material in '+file);
 }
 for(const path of ['tools/dev-debug-config.mjs','__fa_dev__/dev-debug-config.mjs','backend/catalogues/season-1.participants.json','backend/catalogues/season-one-selection.mjs','backend/src/auth.ts','backend/src/password-core.ts','backend/tools/admin-account.mts','backend/package-lock.json','backend/migrations/0001_world.sql','backend/tests/auth-runtime.test.ts','backend/node_modules/argon2id/dist/simd.wasm'])assert.equal(isAllowlistedPublicPath(path),false,path);
});
