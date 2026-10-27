import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {buildPlan} from '../tools/ci-opt-01-node-runner.mjs';

test('Node partition covers every discovered file exactly once and keeps resource suites serial',()=>{
 const plan=buildPlan();
 const all=[...plan.parallel,...plan.serial];
 assert.deepEqual([...all].sort(),readdirSync("tests").filter(x=>x.endsWith(".test.mjs")).map(x=>"tests/"+x).sort());
 assert.equal(all.length,plan.total);
 assert.equal(new Set(all).size,plan.total);
 assert.ok(plan.parallel.every(file=>["tests/competition-model.test.mjs","tests/routes-registry.test.mjs","tests/world-calendar-model.test.mjs","tests/guide.test.mjs"].includes(file)));
 for(const name of ['club-pages-browser','publication-gate','dev-standings-preview','generator-windows']){
  assert.ok(plan.serial.includes('tests/'+name+'.test.mjs'),name);
 }
});

test('changed executable dependency fingerprints revert the entire audited lane to serial',()=>{
 const plan=buildPlan({read:()=>Buffer.from('modified dependency')});
 assert.deepEqual(plan.parallel,[]);
 assert.equal(plan.serial.length,plan.total);
});

test('FULL fails closed when no test files are discovered',()=>{
 assert.throws(()=>buildPlan({list:()=>[]}),/No Node test files/);
});
