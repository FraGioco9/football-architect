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

test('stacked PRs skip FULL gate, but main-base verification remains strict on base edits',()=>{
 const source=readFileSync('.github/workflows/ci-opt-03-full-gate.yml','utf8');
 assert.match(source,/types: \[[^\]]*edited\]/);
 assert.match(source,/if: \$\{\{ github\.event_name == 'workflow_dispatch' \|\| github\.event\.pull_request\.base\.ref == 'main' \}\}/);
 assert.match(source,/pr\.base\.ref!=='main'/);
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
// TEST-SUITE-02 (#738): the real five-action Chrome journey is not optional on
// ordinary Match Engine PRs. This contract protects the workflow, not just the
// existence of a test file that could silently remain skipped forever.
function verifyMatchEngineActionLabGate(source){
 const job=source.split(/\r?\n  match-engine:\r?\n/)[1]?.split(/\r?\n  [a-z][a-z0-9-]*:\r?\n/)[0];
 assert.ok(job,'ME-01 must retain its match-engine job');
 assert.match(source,/^on:\r?\n  pull_request:\r?\n    paths:\r?\n      - 'match-engine\/\*\*'$/m,
  'Normal Match Engine file edits must trigger ME-01');
 assert.match(source,/^      - '\.github\/workflows\/match-engine-01\.yml'$/m,
  'Changes to the ME-01 workflow must trigger its own test');
 assert.match(job,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/,
  'Checkout must use exact PR HEAD');
 assert.match(job,/      - name: Verify exact PR HEAD\r?\n/);
 for(const command of [
  'npm --prefix match-engine test',
  'node --test tests/app-subdomain-preview.test.mjs tests/app-canonical-routes.test.mjs',
  'node --test match-engine/tests/lab-viewport-browser.test.mjs'
 ])assert.ok(job.includes('run: '+command),'ME-01 lost retained check: '+command);
 const marker='      - name: Five Action LABs clean-stack Chrome interaction';
 assert.equal(job.split(marker).length,2,'Exactly one Action LAB Chrome step is required');
 const stepStart=job.indexOf(marker),rest=job.slice(stepStart);
 const nextStep=rest.search(/\r?\n      - (?:name|uses):/);
 const actionStep=nextStep<0?rest:rest.slice(0,nextStep);
 assert.doesNotMatch(actionStep,/^\s*if:/m,'Action LAB must not be branch-gated or skipped');
 assert.doesNotMatch(actionStep,/^\s*continue-on-error:/m,'Action LAB failure must be fatal');
 assert.match(actionStep,/^\s*run: node --test match-engine\/tests\/action-labs-browser\.test\.mjs\s*$/m,
  'ME-01 must execute real Action LAB Chrome, not a placeholder');
 const viewport=job.indexOf('      - name: Browser viewport fit (Chrome, Advanced settings open and closed)');
 const benchmark=job.indexOf('      - name: Measured local CPU / memory sample');
 assert.ok(viewport>=0&&viewport<stepStart&&benchmark>stepStart,
  'Keep localhost:2000 browser steps sequential: viewport, actions, benchmark');
}

test('ME-01 requires the five Action LAB journeys on every matching PR HEAD',()=>{
 verifyMatchEngineActionLabGate(readFileSync('.github/workflows/match-engine-01.yml','utf8'));
});
test('ME-01 workflow contract detects historical branch skips and silent coverage loss',()=>{
 const source=readFileSync('.github/workflows/match-engine-01.yml','utf8');
 const command='        run: node --test match-engine/tests/action-labs-browser.test.mjs';
 const marker='      - name: Five Action LABs clean-stack Chrome interaction';
 const altered=[
  ['historic branch-name gate',source.replace(command,"        if: branch-only\n"+command)],
  ['continue-on-error',source.replace(command,'        continue-on-error: true\n'+command)],
  ['placeholder command',source.replace(command,'        run: echo skipped')],
  ['missing Action LAB step',source.replace(marker+'\n'+command,'')],
  ['no normal Match Engine path',source.replace("      - 'match-engine/**'","      - 'docs/**'")],
  ['lost viewport prerequisite',source.replace('      - name: Browser viewport fit (Chrome, Advanced settings open and closed)','      - name: Deprecated viewport')],
  ['lost exact PR HEAD',source.replace('ref: '+'$'+'{{ github.event.pull_request.head.sha }}','ref: main')]
 ];
 for(const [reason,broken] of altered){
  assert.notEqual(broken,source,'Mutation fixture must change workflow: '+reason);
  assert.throws(()=>verifyMatchEngineActionLabGate(broken),{name:'AssertionError'},reason);
 }
});


test('isolated Browser FULL evidence cannot pass with missing or skipped required lanes',()=>{
 const workflow='int24-browser-qa.yml';
 const proof=jobs(workflow);
 proof[0].steps.push({name:'Verify browser lane results',conclusion:'success'});
 const scope={name:'scope',conclusion:'success',steps:[
  {name:'Select browser lanes',conclusion:'success'},
  {name:'CSS parity required',conclusion:'success'},
  {name:'Visual parity required',conclusion:'success'}
 ]};
 proof.push(scope);
 for(const lane of ['core','responsive','webkit','css','visual'])proof.push({name:'Browser lane ('+lane+')',conclusion:'success',steps:[{name:'Run loopback preview and browser checks',conclusion:'success'}]});
 assert.equal(evaluateRun(run(),proof,sha,workflow).state,'PASS');
 for(const name of ['scope','Browser lane (core)','Browser lane (responsive)','Browser lane (webkit)','Browser lane (css)','Browser lane (visual)']){
  assert.equal(evaluateRun(run(),proof.filter(j=>j.name!==name),sha,workflow).state,'MISSING',name);
 }
 const aggregate=proof.find(j=>j.name==='chromium');
 const marker=aggregate.steps.pop();
 assert.equal(evaluateRun(run(),proof,sha,workflow).state,'MISSING','isolated jobs must not downgrade to legacy proof');
 aggregate.steps.push(marker);
 const webkit=proof.find(j=>j.name==='Browser lane (webkit)');
 for(const conclusion of ['failure','cancelled','skipped']){
  webkit.conclusion=conclusion;
  assert.equal(evaluateRun(run(),proof,sha,workflow).state,'MISSING',conclusion);
 }
 webkit.conclusion='success';
 webkit.steps[0].conclusion='skipped';
 assert.equal(evaluateRun(run(),proof,sha,workflow).state,'MISSING');
 webkit.steps[0].conclusion='success';
 scope.steps[1].conclusion='skipped';scope.steps[2].conclusion='skipped';
 assert.equal(evaluateRun(run(),proof,sha,workflow).state,'MISSING','unexpected parity lanes contradict scope markers');
 assert.equal(evaluateRun(run(),proof.filter(j=>!['Browser lane (css)','Browser lane (visual)'].includes(j.name)),sha,workflow).state,'PASS');
});

test('Match Engine exceptions permit only appended test files and static LAB routes',async()=>{
 const {staticRoutes,newTestCommands}=await import('../tools/ci-match-engine.cjs');
 const manifest=(command,dependencies={})=>JSON.stringify({scripts:{test:command},dependencies});
 const original='node --test tests/core.test.mjs';
 assert.ok(newTestCommands(manifest(original),manifest(original+' tests/pass.test.mjs')));
 for(const next of [manifest('node --test tests/pass.test.mjs'),manifest(original+' && true'),
  manifest(original+' tests/pass.test.mjs',{rapier:'latest'})])assert.equal(newTestCommands(manifest(original),next),false);
 const old="const MATCH_ENGINE_LAB = Object.freeze({\n  '/existing': 'existing'\n});\nserve();";
 const route="  '/__fa_match_engine__/lab-shot-calibration.mjs': 'match-engine/src/lab-shot-calibration.mjs',\n";
 const next=old.replace("  '/existing'",route+"  '/existing'");
 const exists=p=>p==='match-engine/src/lab-shot-calibration.mjs';
 assert.ok(staticRoutes(old,next,exists));
 for(const invalid of [next.replace('serve();','proxy();'),next.replace(route,route+route),
  next.replace('match-engine/src','backend/src'),next.replace("'/existing': 'existing'","'/existing': 'other'")])
  assert.equal(staticRoutes(old,invalid,exists),false);
 assert.equal(staticRoutes(old,next,()=>false),false);
});

test('inherited Admin evidence requires exact PR, base, head and executed proof on the candidate',async()=>{
 const {inheritedAdmin}=await import('../tools/ci-full-evidence.cjs');
 const base='b'.repeat(40),current=run({pull_requests:[{number:1,head:{sha},base:{sha:base}}]});
 const proof=[{name:'scope',conclusion:'success',steps:[{name:'Verified unchanged economic scope against executed FULL source',conclusion:'success'}]},
  {name:'Admin foundation contracts (Node 22)',conclusion:'success',steps:[{name:'FULL coverage completed',conclusion:'skipped'}]}];
 assert.ok(inheritedAdmin(current,proof,sha,1,base));
 assert.equal(inheritedAdmin(current,proof,sha,2,base),false);
 assert.equal(inheritedAdmin(current,proof,sha,1,sha),false);
 assert.equal(inheritedAdmin(current,proof,base,1,base),false);
 for(const conclusion of ['failure','skipped','cancelled']){
  proof[0].steps[0].conclusion=conclusion;
  assert.equal(inheritedAdmin(current,proof,sha,1,base),false);
 }
});

test('economic inheritance walks merged main trees and rejects changed consumers or incomplete source jobs',async()=>{
 const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join,dirname}=await import('node:path');
 const {execFileSync}=await import('node:child_process');
 const {economicSource,isolatedConsumers,isolatedDiff}=await import('../tools/ci-match-engine.cjs');
 const previous=process.cwd(),temp=mkdtempSync(join(tmpdir(),'fa-economic-ci-'));
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 const put=(p,data)=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,data);};
 const commit=title=>{git('add','.');git('commit','-qm',title);return git('rev-parse','HEAD');};
 try{
  process.chdir(temp);git('init','-q');git('config','user.name','CI');git('config','user.email','ci@example.invalid');
  put('match-engine/src/sidebar-shell.mjs','export const value=1;');const parent=commit('initial');
  put('backend/src/economy.ts','export const balance=1;');const base=commit('certified policy (#7)');
  const tree=git('rev-parse',base+'^{tree}');put('match-engine/src/core.mjs','export const gravity=10;');const head=commit('lab');
  const sourceSha='e'.repeat(40),identity={full_name:'owner/repo'};
  const pr={base:{ref:'main',sha:base},head:{sha:head,repo:identity}};
  const receipt=run({head_sha:sourceSha,pull_requests:[{number:7,head:{sha:sourceSha},base:{ref:'main',sha:parent}}]});
  const proof=jobs('admin-world-checks.yml');
  const operator=proof.find(j=>j.name.startsWith('Final local operator'));
  operator.steps.push(...['Execute isolated economic rehearsal','Verify DEV operator runtime and PowerShell regressions before full rehearsal',
    'Verify operator bootstrap, recovery and local persistence across restart'].map(name=>({name,conclusion:'success'})));
  const source={number:7,merged:true,merge_commit_sha:base,base:{ref:'main'},head:{sha:sourceSha,repo:identity}};
  const commitData={tree:{sha:tree}};
  const github={rest:{pulls:{get:async()=>({data:source})},git:{getCommit:async()=>({data:commitData})},
   actions:{listWorkflowRuns:'runs',listJobsForWorkflowRun:'jobs'}},paginate:async method=>method==='runs'?[receipt]:proof};
  const check=()=>economicSource({github,owner:'owner',repo:'repo',pr});
  assert.equal((await check()).source,sourceSha);
  operator.steps.at(-1).conclusion='skipped';assert.equal(await check(),null);operator.steps.at(-1).conclusion='success';
  commitData.tree.sha=parent;assert.equal(await check(),null);commitData.tree.sha=tree;
  pr.head.sha=base;assert.equal(await check(),null);pr.head.sha=head;
  put('backend/src/adapter.ts',"export {gravity} from '../../match-engine/src/core.mjs';");
  const shared=commit('shared consumer');assert.equal(isolatedDiff(head,shared),false);assert.equal(isolatedConsumers(shared),false);
  git('mv','match-engine/src/core.mjs','match-engine/src/lab.mjs');
  assert.equal(isolatedDiff(shared,commit('rename')),false);
 }finally{process.chdir(previous);rmSync(temp,{recursive:true,force:true});}
});

test('ME-01 evidence rejects a skipped candidate check, cancellation and stale base',async()=>{
 const {engineEvidence}=await import('../tools/ci-full-evidence.cjs');
 const base='b'.repeat(40);
 const exact=run({pull_requests:[{number:1,head:{sha},base:{sha:base}}]});
 const steps=['Verify exact PR HEAD','Install pinned physics candidate','Focused core and route security tests',
  'Existing routing/preview regressions','Browser viewport fit (Chrome, Advanced settings open and closed)',
  'Five Action LABs clean-stack Chrome interaction','Measured local CPU / memory sample'].map(name=>({name,conclusion:'success'}));
 const github={rest:{actions:{listWorkflowRuns:'runs',listJobsForWorkflowRun:'jobs'}},
  paginate:async method=>method==='runs'?[exact]:[{name:'match-engine',conclusion:'success',steps}]};
 const check=async baseSha=>(await engineEvidence({github,owner:'owner',repo:'repo',sha,prNumber:1,baseSha})).state;
 assert.equal(await check(base),'PASS');
 steps[4].conclusion='skipped';assert.equal(await check(base),'MISSING');
 exact.conclusion='cancelled';assert.equal(await check(base),'FAIL');
 assert.equal(await check(sha),'MISSING');
});

test('economic receipt verifies the remaining operator executions and cannot become a new FULL source',()=>{
 const wf='admin-world-checks.yml',proof=jobs(wf);
 const operator=proof.find(j=>j.name.startsWith('Final local operator'));
 const rehearsal={name:'Execute isolated economic rehearsal',conclusion:'success'};
 const remaining={name:'Verify operator bootstrap, recovery and local persistence across restart',conclusion:'success'};
 operator.steps.push(rehearsal,remaining,{name:'Verify DEV operator runtime and PowerShell regressions before full rehearsal',conclusion:'success'});
 assert.equal(evaluateRun(run(),proof,sha,wf).state,'PASS');
 rehearsal.conclusion='skipped';assert.equal(evaluateRun(run(),proof,sha,wf).state,'MISSING');
 proof.push({name:'scope',conclusion:'success',steps:[{name:'Verified isolated economic inputs',conclusion:'success'}]});
 assert.equal(evaluateRun(run(),proof,sha,wf).state,'ECONOMY_INHERITED');
 remaining.conclusion='skipped';assert.equal(evaluateRun(run(),proof,sha,wf).state,'MISSING');
});

test('selected public evidence requires executed site checks and verifies browser scope',async()=>{
 const {selectedPublicEvidence}=await import('../tools/ci-full-evidence.cjs');
 const base='b'.repeat(40),receipt=run({pull_requests:[{number:1,head:{sha},base:{sha:base}}]});
 const step=(name,conclusion='success')=>({name,conclusion});
 const job=(name,...steps)=>({name,conclusion:'success',steps});
 const scope=job('scope',step('Certified impacted suites'));
 const aggregate=job('chromium',step('Verify browser lane results'),step('FULL coverage completed','skipped'),step('Run loopback preview and browser checks'));
 const lane=job('Browser lane (core)',step('Run loopback preview and browser checks'));
 const check=(jobs,b=base)=>selectedPublicEvidence('int24-browser-qa.yml',receipt,jobs,sha,1,b);
 assert.equal(check([scope,aggregate,lane]),true);assert.equal(check([scope,aggregate]),false);
 assert.equal(check([scope,aggregate,lane],sha),false);
 lane.steps[0].conclusion='skipped';assert.equal(check([scope,aggregate,lane]),false);
 aggregate.steps[2].conclusion='skipped';assert.equal(check([scope,aggregate]),true);
 const site=[job('head-exact',step('Certified impacted suites')),job('landing',step('Site essential contracts (FAST and TARGETED)'),step('FULL coverage completed','skipped'))];
 assert.equal(selectedPublicEvidence('landing-checks.yml',receipt,site,sha,1,base),true);
 site[1].steps[0].conclusion='skipped';assert.equal(selectedPublicEvidence('landing-checks.yml',receipt,site,sha,1,base),false);
});
