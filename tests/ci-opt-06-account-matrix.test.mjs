import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runIndependentAccountMatrix} from '../tools/ci-opt-06-account-matrix.mjs';

test('all languages, themes and variants are visited, with at most two isolated contexts',async()=>{
 const visits=[],active=new Set();
 let release;
 const hold=new Promise(resolve=>release=resolve);
 const running=runIndependentAccountMatrix(['en','de','es','fr','it'],['dark','light'],[320,390,1440],async({language,theme,variant})=>{
  const key=language+':'+theme;
  assert.equal(active.has(key),false,'a theme must remain sequential');
  active.add(key);
  visits.push([language,theme,variant]);
  assert.ok(active.size<=2,'maximum two in-flight contexts');
  if(language==='en'&&variant===320)await hold;
  active.delete(key);
 });
 await Promise.resolve();
 assert.deepEqual(visits,[['en','dark',320],['en','light',320]],'both themes begin, but no later locale');
 release();
 await running;
 assert.equal(visits.length,30);
 for(const language of ['en','de','es','fr','it'])
  for(const theme of ['dark','light'])
   assert.deepEqual(visits.filter(v=>v[0]===language&&v[1]===theme).map(v=>v[2]),[320,390,1440]);
 assert.equal(active.size,0);
});

test('one theme failure awaits sibling and propagates without a false PASS',async()=>{
 for(const failed of ['dark','light']){
  const completed=[];
  await assert.rejects(runIndependentAccountMatrix(['it'],['dark','light'],[390],async({theme})=>{
   if(theme===failed)throw Error('broken '+theme);
   await Promise.resolve();completed.push(theme);
  }),error=>error instanceof AggregateError&&error.errors.length===1&&
   error.errors[0].message.includes('broken '+failed));
  assert.deepEqual(completed,[failed==='dark'?'light':'dark']);
 }
});
test('simultaneous theme failures are both surfaced',async()=>{
 await assert.rejects(
  runIndependentAccountMatrix(['en'],['dark','light'],[390],async({theme})=>{throw Error('broken '+theme)}),
  error=>error instanceof AggregateError&&error.errors.length===2&&
   error.errors.some(e=>e.message.includes('dark'))&&error.errors.some(e=>e.message.includes('light'))
 );
});
test('an empty or unbounded matrix fails closed',async()=>{
 for(const axes of [
  [[],['dark','light'],[390]], [['en'],[],[390]],
  [['en'],['dark','light','extra'],[390]], [['en'],['dark','light'],[]]
 ])await assert.rejects(runIndependentAccountMatrix(...axes,async()=>{}),/Account matrix must retain/);
});

test('official browser containers do not restore a cache at a different browser path',()=>{
 for(const workflow of ['int24-browser-qa.yml','admin-world-checks.yml']){
  const src=readFileSync(new URL('../.github/workflows/'+workflow,import.meta.url),'utf8');
  assert.match(src,/image: mcr\.microsoft\.com\/playwright:v1\.58\.2-noble/);
  assert.match(src,/PLAYWRIGHT_BROWSERS_PATH: \/ms-playwright/);
  if(workflow==='int24-browser-qa.yml'){
   assert.doesNotMatch(src,/path: ~\/\.cache\/ms-playwright/);
  }else{
   const account=src.split('  account-browser:')[1]?.split('  operator-final:')[0];
   assert.ok(account,'Account browser job exists');
   assert.doesNotMatch(account,/path: ~\/\.cache\/ms-playwright/);
   assert.match(src,/name: Cache pinned lifecycle Chromium binaries/,'noncontainer lifecycle cache remains');
  }
 }
});
