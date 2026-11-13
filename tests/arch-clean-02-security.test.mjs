import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planPublicFiles,isAllowlistedPublicPath,publicRequestFile} from '../tools/publication-guard.mjs';
import '../assets/world-calendar-model.js';
import '../assets/world-clock-adapter.js';
const hosting=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));

test('ARCH-CLEAN-02 security: approved hosting routes include exactly two Players-preview redirects',()=>{
  assert.equal(hosting.redirects.length,36);
  for(const suffix of ['/', '/index.html'])assert.deepEqual(hosting.redirects.find(route=>route.source==='/admin/players/preview'+suffix),{source:'/admin/players/preview'+suffix,destination:'/admin/players/preview',permanent:true});
  assert.equal(hosting.rewrites.length,10);
  assert.equal(hosting.redirects.filter(route=>route.source.startsWith('/admin/:section(calendar|players|contracts)')).length,2);
  assert.equal(hosting.rewrites.filter(route=>route.source==='/admin/:section(calendar|players|contracts)').length,1);
  assert.equal(hosting.rewrites.some(r=>r.destination.includes('/app/')),false);
});

test('ARCH-CLEAN-02 security: public plan excludes DEV, repository tooling, and tests',()=>{
  const files=planPublicFiles();
  assert.ok(files.length>0);
  for(const file of files){
    assert.equal(isAllowlistedPublicPath(file),true,file);
    assert.doesNotMatch(file,/^(?:__fa_dev__|tools|tests|docs|\.github)\//);
  }
  assert.equal(isAllowlistedPublicPath('tools/dev-world-clock.mjs'),false);
  assert.equal(isAllowlistedPublicPath('tests/arch-clean-02-security.test.mjs'),false);
});

test('ARCH-CLEAN-02 security: invalid routes do not resolve to publishable files',()=>{
  for(const route of ['/competitions/it-3/overview','/clubs/it/41/stats','/competitions/it-1/unknown']){
    assert.equal(isAllowlistedPublicPath(publicRequestFile(route)),false,route);
  }
});

test('ARCH-CLEAN-02 security: read-only world clock refuses untrusted event lifecycle',()=>{
  const adapter=globalThis.faWorldClockAdapter;
  assert.ok(adapter);
  const snapshot={source:{kind:'dev',reference:'test only'},current:{season:1,day:17}};
  assert.equal(adapter.normalize(snapshot).eventStates.length,0);
  assert.throws(()=>adapter.normalize({...snapshot,eventStates:[{eventId:'any',competitionId:'int-1',status:'completed'}]}));
});
