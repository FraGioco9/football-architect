import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('FULL gate waits for missing evidence rather than failing at the first observation',()=>{
 const source=readFileSync('tools/ci-full-evidence.cjs','utf8');
 assert.match(source,/while\s*\(/);
 assert.match(source,/PENDING/);
 assert.match(source,/BLOCKED/);
 assert.doesNotMatch(source,/core.setFailed\('Missing FULL workflow/);
});
test('test ownership inventory rejects additions before running suites',async()=>{
 const {auditDiscovery}=await import('../tools/ci-discovery.mjs');
 const result=auditDiscovery();assert.ok(result.total>150);
 assert.throws(()=>auditDiscovery({extra:['tests/unrecognized.test.mjs']}),/Unclassified/);
});
test('diagnostics retain assertion data and never infer a flaky pass',async()=>{
 const {diagnose}=await import('../tools/ci-diagnostics.mjs');
 const result=diagnose({text:'AssertionError [ERR_ASSERTION]: score\nactual: 1\nexpected: 24',command:['node','--test','tests/example.test.mjs'],exitCode:1});
 assert.equal(result.status,'FAIL');assert.match(result.reproduce,/node/);assert.match(result.actual,/1/);assert.match(result.expected,/24/);
 assert.equal(result.category,'Product regression');assert.equal(result.classification,'provisional');
});

const {evaluateRun,verify,requirements}=await import('../tools/ci-full-evidence.cjs');
const sha='a'.repeat(40);
function run(overrides={}){return {id:1,head_sha:sha,event:'pull_request',status:'completed',conclusion:'success',run_attempt:1,html_url:'https://example.invalid/1',...overrides};}
function jobs(workflow){return requirements[workflow].map(([name,step,execution])=>({name,conclusion:'success',steps:[...new Set([step,execution||step])].map(name=>({name,conclusion:'success'}))}));}
for(const workflow of Object.keys(requirements)){
 test(workflow+': FULL evidence excludes stale, skipped, pending, failed and cancelled runs',()=>{
  const good=jobs(workflow);
  assert.equal(evaluateRun(run(),good,sha,workflow).state,'PASS');
  assert.equal(evaluateRun(run({head_sha:'b'.repeat(40)}),good,sha,workflow).state,'STALE');
  assert.equal(evaluateRun(run({status:'in_progress',conclusion:null}),good,sha,workflow).state,'PENDING');
  assert.equal(evaluateRun(run({conclusion:'failure'}),good,sha,workflow).state,'FAIL');
  assert.equal(evaluateRun(run({conclusion:'cancelled'}),good,sha,workflow).state,'CANCELLED');
  assert.equal(evaluateRun(run(),[],sha,workflow).state,'MISSING');
  good[0].steps[0].conclusion='skipped';assert.equal(evaluateRun(run(),good,sha,workflow).state,'NARROW');
 });
}
function fake({stale=false,missing=false,failed=false}={}){
 let tick=0,calls=0;
 const api={pulls:{get:async()=>({data:{state:'open',head:{sha:stale&&calls++>0?'b'.repeat(40):sha,repo:{full_name:'owner/repo'}},base:{ref:'main'}}})},actions:{listWorkflowRuns:'runs',listJobsForWorkflowRun:'jobs'}};
 const github={rest:api,paginate:async(method,opts)=>method==='runs'?(missing||tick===0?[]:[run({id:Object.keys(requirements).indexOf(opts.workflow_id)+1,conclusion:failed?'failure':'success'})]):jobs(Object.keys(requirements)[opts.run_id-1])};
 const core={info:()=>{},summary:{addHeading(){return this},addCodeBlock(){return this},async write(){}}};
 return {github,core,context:{repo:{owner:'owner',repo:'repo'}},prNumber:1,expected:sha,maxWaitMs:3,intervalMs:1,now:()=>tick,wait:async()=>{tick++}};
}
test('gate observes evidence completion without rerunning suites',async()=>{assert.equal((await verify(fake())).length,3)});
test('gate invalidates a changed PR HEAD while waiting',async()=>{await assert.rejects(verify(fake({stale:true})),/stale HEAD/)});
test('gate deadline stays BLOCKED rather than passing absent evidence',async()=>{await assert.rejects(verify(fake({missing:true})),/BLOCKED.*PENDING/)});
test('failed evidence never waits into a successful result',async()=>{await assert.rejects(verify(fake({failed:true})),/FAIL\/CANCELLED/)});
test('reuse accepts only earlier completed exact-head FULL runs and excludes current run',async()=>{
 const {findReusable}=await import('../tools/ci-full-evidence.cjs');
 const github={rest:{actions:{listWorkflowRuns:'runs',listJobsForWorkflowRun:'jobs'}},paginate:async(method)=>method==='runs'?[run({id:3}),run({id:2}),run({id:1,head_sha:'b'.repeat(40)})]:jobs('landing-checks.yml')};
 assert.equal(await findReusable({github,owner:'owner',repo:'repo',sha,workflow:'landing-checks.yml',currentRun:3}),2);
 assert.equal(await findReusable({github,owner:'owner',repo:'repo',sha,workflow:'landing-checks.yml',currentRun:2}),null);
});
test('a failed FULL with skipped success marker cannot fall back to earlier green',()=>{
 const skipped=jobs('landing-checks.yml');skipped[0].steps[0].conclusion='skipped';
 assert.equal(evaluateRun(run({conclusion:'failure'}),skipped,sha,'landing-checks.yml').state,'FAIL');
 assert.equal(evaluateRun(run({conclusion:'cancelled'}),skipped,sha,'landing-checks.yml').state,'CANCELLED');
});
test('manual dispatch cannot replace PR-base-dependent FULL coverage',()=>{
 assert.equal(evaluateRun(run({event:'workflow_dispatch'}),jobs('int24-browser-qa.yml'),sha,'int24-browser-qa.yml').state,'IGNORED');
});
test('source execution is required even when a reuse-only run succeeds',()=>{
 const proof=jobs('landing-checks.yml');proof[0].steps.find(s=>s.name==='Site contracts (full)').conclusion='skipped';
 assert.equal(evaluateRun(run(),proof,sha,'landing-checks.yml').state,'REUSED');
});
test('discovery refuses unsupported test suffixes',async()=>{
 const {auditDiscovery}=await import('../tools/ci-discovery.mjs');
 for(const name of ['tests/new.test.js','tests/new.test.cjs','backend/tests/new.test.cts'])assert.throws(()=>auditDiscovery({extra:[name]}),/Unclassified/);
});
test('unknown paths fail closed and direct dependent contracts are selected',async()=>{
 const {classifyImpact}=await import('../tools/ci-opt-01-impact.mjs');
 for(const p of ['assets/competition-never-before-seen.js','calendar/unknown.R'])assert.equal(classifyImpact([p]).mode,'full');
 assert.ok(classifyImpact(['assets/competition-overview-teams.mjs']).tests.includes('tests/competition-overview-teams.test.mjs'));
});

test('gate executes its tested observer inline, without evaluating candidate code',()=>{
 const source=readFileSync('.github/workflows/ci-opt-03-full-gate.yml','utf8');
 const observer=readFileSync('tools/ci-full-evidence.cjs','utf8').split('\n').filter(l=>!l.startsWith('module.exports=')).join('\n').trim();
 const embedded=source.split('          script: |\n')[1].split('\n').map(l=>l.startsWith('            ')?l.slice(12):l).join('\n');
 assert.ok(embedded.startsWith(observer));assert.doesNotMatch(source,/actions\/checkout|require\(/);
});

test('ownership labels cannot hide executable tests in manual or helper lanes',async()=>{
 const {auditDiscovery}=await import('../tools/ci-discovery.mjs');
 const manifest=JSON.parse(readFileSync('tools/ci-test-ownership.json','utf8'));
 manifest.tests['tests/ci-opt-04-05.test.mjs']='manual';
 assert.throws(()=>auditDiscovery({manifest}),/Executable test/);
});

test('FULL proof for another PR base is stale even on identical source HEAD',()=>{
 const old=run({pull_requests:[{number:1,head:{sha},base:{sha:'b'.repeat(40)}}]});
 assert.equal(evaluateRun(old,jobs('landing-checks.yml'),sha,'landing-checks.yml',{prNumber:1,baseSha:'c'.repeat(40)}).state,'STALE');
});

test('FULL Admin proof requires independently completed Chromium and WebKit account jobs',()=>{
 const names=requirements['admin-world-checks.yml'].map(([name])=>name);
 for(const name of ['Account UI (chromium)','Account UI (webkit)'])assert.ok(names.includes(name));
 const incomplete=jobs('admin-world-checks.yml').filter(j=>j.name!=='Account UI (webkit)');
 assert.notEqual(evaluateRun(run(),incomplete,sha,'admin-world-checks.yml').state,'PASS');
});
test('account engine matrix is independent of Worker contracts and preserves both engines',()=>{
 const source=readFileSync('.github/workflows/admin-world-checks.yml','utf8');
 const matrix=source.split('\n  account-browser:')[1]?.split('\n  operator-final:')[0];
 assert.ok(matrix,'separate account job');assert.match(matrix,/needs: scope/);assert.doesNotMatch(matrix,/needs:.*password-policy/);
 assert.match(matrix,/fail-fast: false/);assert.match(matrix,/engine: \[chromium, webkit\]/);
 for(const suite of ['player-safe-return','account-pages','account-feedback','account-usability','control-focus','profile-navigation','account-interaction','account-layout','competition-season-zero-club-links'])assert.ok(matrix.includes('tests/'+suite+'-browser.mjs'),suite);
 assert.match(matrix,/tests\/admin-settings-browser\.mjs/);assert.match(matrix,/FA_AUTH_BROWSER: \$\{\{ matrix.engine \}\}/);
});
