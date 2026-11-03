import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
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
