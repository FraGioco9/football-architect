import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {diagnose} from '../tools/ci-diagnostics.mjs';
import {selectTests,essential} from '../tools/ci-selected.mjs';

test('selected Site lane executes each essential/area file once and rejects foreign files',()=>{
 const selected=selectTests(['tests/admin-settings.test.mjs','tests/season-two-controls.test.mjs']);
 assert.equal(selected.length,essential.length);assert.equal(new Set(selected).size,selected.length);
 assert.throws(()=>selectTests(['backend/tests/world.test.ts']),/Unknown selected/);
});
for(const [text,category] of [
 ['Unclassified test: unknown','Test defect'],['Error: ENOSPC','Infrastructure failure'],
 ['Error: Executable doesn\'t exist','Test data or environment problem'],['BLOCKED: pending evidence','Missing or pending CI evidence']
])test('taxonomy: '+category,()=>assert.equal(diagnose({text,command:['node','--test'],exitCode:1}).category,category));

test('subprocess wrapper preserves nonzero exit and serializes first failure and expected/actual',()=>{
 const root=mkdtempSync(join(tmpdir(),'fa-diagnostics-'));
 try{
  const r=spawnSync(process.execPath,['tools/ci-run.mjs','injected-assertion','--',process.execPath,'-e',"require('node:assert/strict').equal(1,24,'controlled failure')"],{env:{...process.env,FA_CI_REPORT_DIR:root},encoding:'utf8'});
  assert.equal(r.status,1);assert.match(r.stderr,/First actionable failure/);
  const data=JSON.parse(readFileSync(join(root,readdirSync(root).find(f=>f.endsWith('.json'))),'utf8'));
  assert.equal(data.status,'FAIL');assert.equal(data.actual,'1,');assert.equal(data.expected,'24,');assert.ok(data.firstFailureMs>=0);assert.match(data.reproduce,/controlled failure/);
 }finally{rmSync(root,{recursive:true,force:true})}
});

test('history flags same-head inconsistent outcomes as candidates, never proves a flaky pass',async()=>{
 const {analyzeHistory}=await import('../tools/ci-history.mjs');
 const records=[{head:'a',reproduce:'node test',status:'FAIL',signature:'one'},{head:'a',reproduce:'node test',status:'PASS',signature:'two'},{head:'b',reproduce:'node test',status:'FAIL',signature:'one'}];
 const result=analyzeHistory(records);assert.equal(result.flakyCandidates.length,1);assert.equal(result.repeatedFailures[0].count,2);
 assert.equal(result.flakyCandidates[0].classification,'requires investigation');
});

test('PowerShell reproduction preserves safe scenario environment and omits secrets',()=>{
 const result=diagnose({text:'AssertionError: area',command:['node','tests/ci-opt-01-browser-smoke.mjs'],env:{FA_TARGET_AREA:'guide',FA_BROWSER_ENGINE:'webkit',PR_BASE_SHA:'a'.repeat(40),SECRET:'private'}});
 assert.match(result.reproduce,/\$env:FA_TARGET_AREA='guide'/);assert.match(result.reproduce,/\$env:FA_BROWSER_ENGINE='webkit'/);assert.doesNotMatch(result.reproduce,/SECRET|private/);
});

test('Node failure diagnostics give a focused replay with escaped test name and retain the complete suite command',()=>{
 const text="not ok 7 - score [stable]\n  ---\n  location: '/work/tests/score.test.mjs:8:1'\n  error: 'Expected values to be strictly equal'\n  expected: 24\n  actual: 1\n  ...";
 const result=diagnose({text,command:['node','tools/ci-opt-01-node-runner.mjs']});
 assert.deepEqual(result.reproductionCommand,['node','--test','--test-name-pattern=score \\[stable\\]','tests/score.test.mjs']);
 assert.match(result.reproduce,/--test-name-pattern/);assert.equal(result.suiteReproduce,'node tools/ci-opt-01-node-runner.mjs');
});
test('a runtime failure is never replayed as a pure Node test',()=>{
 const text="AssertionError: runtime\n at backend/tests/player-auth-runtime.test.ts:8:1\nexpected: 24\nactual: 1";
 const command=['npm','--prefix','backend','test'];const result=diagnose({text,command});
 assert.deepEqual(result.reproductionCommand,command);
});

test('streamed TAP failure details include focused replay before the final artifact is written',()=>{
 const root=mkdtempSync(join(tmpdir(),'fa-streamed-details-'));
 try{
  const file=join(root,'stream.test.mjs');
  writeFileSync(file,"import test from 'node:test';import assert from 'node:assert/strict';test('score [stable]',()=>assert.equal(1,24));");
  const env={...process.env,FA_CI_REPORT_DIR:root};delete env.NODE_TEST_CONTEXT;
  const r=spawnSync(process.execPath,['tools/ci-run.mjs','stream','--',process.execPath,'--test','--test-reporter=tap',file],{env,encoding:'utf8'});
  assert.equal(r.status,1);assert.match(r.stderr,/Failure details/);
  const data=JSON.parse(readFileSync(join(root,readdirSync(root).find(f=>f.endsWith('.json'))),'utf8'));
  assert.ok(data.firstDiagnosticMs>=data.firstFailureMs);assert.ok(data.firstDiagnosticMs<=data.durationMs);
  assert.ok(data.reproductionCommand.some(x=>x.includes('score \\[stable\\]')));
 }finally{rmSync(root,{recursive:true,force:true})}
});

test('PowerShell focused replay retains a Windows source path from escaped TAP locations',()=>{
 const file=String.raw`C:\repo\tests\score.test.ts`;
 const text=String.raw`not ok 1 - score
  location: 'C:\\repo\\tests\\score.test.ts:8:1'
  expected: 24
  actual: 1`;
 const result=diagnose({text,command:['node','--test',file]});
 assert.deepEqual(result.reproductionCommand,['node','--experimental-strip-types','--test','--test-name-pattern=score',file]);
 assert.match(result.reproduce,/C:\\repo\\tests\\score\.test\.ts/);
});

test('flaky candidates still compare the original suite after a failure gains a focused replay',async()=>{
 const {analyzeHistory}=await import('../tools/ci-history.mjs');
 const records=[{head:'a',status:'FAIL',reproduce:'node --test --test-name-pattern=score tests/score.test.mjs',suiteReproduce:'node tools/ci-opt-01-node-runner.mjs',signature:'one'},{head:'a',status:'PASS',reproduce:'node tools/ci-opt-01-node-runner.mjs',suiteReproduce:'node tools/ci-opt-01-node-runner.mjs',signature:'two'}];
 assert.equal(analyzeHistory(records).flakyCandidates.length,1);
});

test('a focused nested-test replay cannot turn the original failure into a filtered green result',()=>{
 const root=mkdtempSync(join(tmpdir(),'fa-nested-replay-'));
 try{
  const file=join(root,'nested.test.mjs'),env={...process.env};delete env.NODE_TEST_CONTEXT;
  writeFileSync(file,"import test from 'node:test';import assert from 'node:assert/strict';test('outer',async t=>{await t.test('child [score]',()=>assert.equal(1,24));});test('other',()=>{});");
  const original=spawnSync(process.execPath,['--test','--test-reporter=tap',file],{env,encoding:'utf8'});assert.equal(original.status,1);
  const record=diagnose({text:original.stdout+original.stderr,command:['node','--test',file]});
  const replay=spawnSync(process.execPath,['--test-reporter=tap',...record.reproductionCommand.slice(1)],{env,encoding:'utf8'});
  assert.equal(replay.status,1,replay.stdout+replay.stderr);assert.match(replay.stdout,/not ok.*child \[score\]/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
