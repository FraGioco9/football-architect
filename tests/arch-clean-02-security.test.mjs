import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planPublicFiles,isAllowlistedPublicPath,publicRequestFile} from '../tools/publication-guard.mjs';
import '../assets/world-calendar-model.js';
import '../assets/world-clock-adapter.js';
const hosting=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));

test('ARCH-CLEAN-02 security: approved hosting routes include exactly two Players-preview redirects',()=>{
  assert.equal(hosting.redirects.length,45);
  assert.equal(hosting.redirects.filter(rule=>!rule.source.startsWith('/history')).length,43,
   'retain the original 43 approved redirects');
  assert.deepEqual(hosting.redirects.filter(rule=>rule.source.startsWith('/history')),[{
   source:'/history/',destination:'/history',permanent:true
  },{source:'/history/index.html',destination:'/history',permanent:true}]);
  assert.deepEqual(hosting.redirects[0],{source:'/matches/:id([1-9][0-9]*)/',destination:'/matches/:id',permanent:true});
  for(const suffix of ['', '/', '/index.html'])assert.ok(hosting.redirects.some(rule=>rule.source.endsWith('/stats'+suffix)&&rule.destination==='/clubs/:country/:club/records'&&rule.permanent));
  for(const suffix of ['/', '/index.html'])assert.deepEqual(hosting.redirects.find(route=>route.source==='/admin/players/preview'+suffix),{source:'/admin/players/preview'+suffix,destination:'/admin/players/preview',permanent:true});
  assert.equal(hosting.rewrites.length,12);
  assert.equal(hosting.rewrites.filter(rule=>rule.source!=='/history').length,11,
   'retain the original 11 approved rewrites');
  assert.deepEqual(hosting.rewrites.find(rule=>rule.source==='/history'),
   {source:'/history',destination:'/history/index.html'});
  assert.deepEqual(hosting.rewrites[0],{source:'/matches/:id([1-9][0-9]*)',destination:'/matches/_shared/index.html'});
  assert.equal(hosting.redirects.filter(route=>route.source.startsWith('/admin/:section(calendar|players|contracts|licenses|rewards)')).length,2);
  assert.equal(hosting.rewrites.filter(route=>route.source==='/admin/:section(calendar|players|contracts|licenses|rewards)').length,1);
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
