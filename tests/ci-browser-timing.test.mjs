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

// Guard against accidental coverage loss when adding observational browser timing.
test('WebKit profiling preserves canonical-state, responsive and supplemental journeys',async()=>{
 const {browserCases,areaRoutes}=await import('./ci-opt-01-browser-cases.mjs');
 assert.equal(browserCases().length,20);
 assert.deepEqual(Object.keys(areaRoutes),['calendar','clubs','competitions','guide','admin']);
 const entry=readFileSync('tests/clean-ui-03-webkit-iphone.mjs','utf8');
 const area=readFileSync('tests/ci-opt-01-browser-smoke.mjs','utf8');
 const canonical=readFileSync('tests/canonical-state-browser.mjs','utf8');
 for(const s of ["await verifyCanonicalStateBrowser(browser,'webkit')","Object.keys(areaRoutes)","await runArea(browser,area,\"webkit\")","for(const route of pages)","timing.mark('cleanup-complete');timing.report()"])
  assert.ok(entry.includes(s),'WebKit: '+s);
 for(const s of ["for(const config of browserCases())","await verifyArea(page,area,config)","await verifyCompetitionCompactNetwork(browser,{engine})","await verifyCompetitionPlayerStats(browser,{engine})","await verifyCompetitionPublishedNetwork(browser,{engine})","await verifyClubBfcacheNetwork(browser,{engine})","timing.mark('pairwise-complete')","timing.sample('competition-published-network'","timing.report()"])
  assert.ok(area.includes(s),'Area: '+s);
 for(const s of ["for(const [i,path] of routes.entries())","for(const path of routes)","SH-03 '+engine+' PASS: '+checks","timing.mark('public-route-matrix-complete')","timing.mark('stale-world-invalidation-complete')","timing.report()"])
  assert.ok(canonical.includes(s),'SH-03: '+s);
});
