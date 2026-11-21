import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBrowserTiming} from '../tools/ci-browser-timing.mjs';

test('browser telemetry emits deterministic phase and navigation statistics once',()=>{
 let clock=0;const lines=[];
 const timing=createBrowserTiming('fixture','webkit',{now:()=>clock,emit:line=>lines.push(line)});
 clock=10;timing.mark('browser-ready');clock=15;timing.mark('preview-ready');
 for(const v of [3,4,8,15,20,-1,NaN])timing.sample('route-ready',v);
 clock=80;timing.mark('cases-complete');clock=84;timing.mark('cleanup-complete');
 timing.report();timing.report();
 assert.equal(lines.length,1);
 assert.ok(lines[0].startsWith('CI_BROWSER_TIMING '));
 const e=JSON.parse(lines[0].slice('CI_BROWSER_TIMING '.length));
 assert.deepEqual([e.schema,e.suite,e.engine,e.totalMs],[1,'fixture','webkit',84]);
 assert.deepEqual(Object.values(e.phasesMs),[10,5,65,4,0]);
 assert.deepEqual(e.samples['route-ready'],{count:5,totalMs:50,medianMs:8,p95Ms:20});
});

test('diagnostic sink failure cannot change test outcomes',()=>{
 const timing=createBrowserTiming('fixture','chromium',{now:()=>1,emit:()=>{throw Error('sink failed')}});
 assert.doesNotThrow(()=>timing.report());
});

test('browser suites retain pass markers, WebKit serialization, and cleanup telemetry',()=>{
 for(const [path,specific] of [
  ['tests/account-interaction-browser.mjs',["account interaction matrix PASS: ","maxConcurrent:engine==='webkit'?1:2","timing.sample('route-ready'"]],
  ['tests/admin-settings-browser.mjs',["Dedicated Admin page browser contracts PASS: ","timing.mark('permissions-matrix-complete')","timing.sample('denied-route-sequence-ready'"]]
 ]){
  const source=readFileSync(path,'utf8');
  for(const fragment of ["timing.mark('browser-ready')","timing.mark('preview-ready')","timing.mark('cases-complete')","timing.mark('cleanup-complete');timing.report()",...specific])assert.ok(source.includes(fragment),path+': '+fragment);
 }
});
