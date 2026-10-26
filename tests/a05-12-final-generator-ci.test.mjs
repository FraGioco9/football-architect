import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('A05-12: generated pages remain byte-equivalent to the checked-in shell',()=>{
 const p=spawnSync(process.execPath,['tools/generate-app-pages.mjs','--check'],{cwd:root,encoding:'utf8',timeout:120000});
 assert.equal(p.status,0,p.stderr||p.stdout||p.error?.message);
 assert.match(p.stdout,/Static HTML matches checked-in pages/);
});

test('A05-12: exact-head Node and Chromium CI remain mandatory and non-publishing',()=>{
 const site=read('.github/workflows/landing-checks.yml');
 const browser=read('.github/workflows/int24-browser-qa.yml');
 assert.match(site,/Assert exact checked-out SHA/);
 assert.match(site,/node --test --test-concurrency=1 tests\/\*\.test\.mjs/);
 assert.match(browser,/Assert exact PR checkout/);
 assert.match(browser,/tests\/int24-browser-qa\.mjs/);
 assert.doesNotMatch(site+browser,/vercel deploy|supabase db push/);
});

test('A05-12: final WORLD-TIME and DEV guard regression suites are present',()=>{
 for(const p of ['tests/a05-07-world-equivalence.test.mjs','tests/a05-08-dev-world-integration.test.mjs','tests/a05-10-final-consumer-evidence.test.mjs','tests/a05-11-dev-publication-boundaries.test.mjs']){
  assert.match(read(p),/test\(/,p);
 }
});
