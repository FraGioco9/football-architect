import test from 'node:test';
import assert from 'node:assert/strict';

test('repair benchmark changes the faulty model, preserves assertions and ends in complete passing coverage in both strategies',async()=>{
 const {runRepairBenchmark}=await import('../tools/ci-repair-benchmark.mjs');
 const result=await runRepairBenchmark({trials:1,workFactor:10});
 const {before,after}=result.trials[0];
 assert.equal(before.testsHash,after.testsHash);assert.equal(before.testsHash,before.validatedTestsHash);assert.equal(after.testsHash,after.validatedTestsHash);
 assert.equal(before.faultyModelHash,after.faultyModelHash);assert.equal(before.repairedModelHash,after.repairedModelHash);assert.notEqual(before.faultyModelHash,before.repairedModelHash);
 for(const sample of [before,after]){
  assert.equal(sample.fullValidation.tests,6);assert.equal(sample.fullValidation.pass,6);assert.equal(sample.fullValidation.skipped,0);
  assert.equal(sample.reproductions.length,2);assert.ok(sample.reproductions.every(r=>r.expectedFailure&&r.failed===1));
  assert.ok(sample.detectionMs>=0);assert.ok(sample.diagnosisMs>=sample.detectionMs);assert.ok(sample.patchApplicationMs>=0);assert.ok(sample.totalCycleMs>0);
 }
 assert.deepEqual(before.reproductions.map(r=>r.files),[6,6]);assert.deepEqual(after.reproductions.map(r=>r.files),[1,1]);
 assert.equal(result.repairMode,'automated known-source patch; no assertion changes');
});
