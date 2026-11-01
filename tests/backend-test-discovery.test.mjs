import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {discoverContracts} from '../backend/tools/run-contracts.mjs';
test('backend contract command discovers every pure test including new season policies',()=>{
 const actual=discoverContracts().map(file=>basename(file));
 const expected=readdirSync(new URL('../backend/tests/',import.meta.url)).filter(file=>file.endsWith('.test.ts')&&/from ['"]node:test['"]/.test(readFileSync(new URL('../backend/tests/'+file,import.meta.url),'utf8'))).sort();
 assert.deepEqual(actual,expected);
 for(const name of ['cloudflare-email-delivery','international-holder-allocation-proposal','league-partial','season-calendar-multi-season','season-qualification-pots','season-two-snapshot','sporting-day-payload'])assert.ok(actual.includes(name+'.test.ts'),name);
});
test('contract discovery fails closed on empty or unclassified suites and excludes runtime/operator files',()=>{
 const folder=mkdtempSync(join(tmpdir(),'fa-contract-inventory-')),url=pathToFileURL(folder+'/');
 try{
  assert.throws(()=>discoverContracts(url),/No backend/);
  writeFileSync(join(folder,'contract.test.ts'),"import test from 'node:test';");
  writeFileSync(join(folder,'worker-runtime.test.ts'),"import {it} from 'vitest';");
  writeFileSync(join(folder,'d1-integration.test.ts'),"import {it} from 'vitest';");
  writeFileSync(join(folder,'operator.test.mts'),"import test from 'node:test';");
  assert.deepEqual(discoverContracts(url).map(file=>basename(file)),['contract.test.ts']);
  writeFileSync(join(folder,'unknown.test.ts'),'// not classified');
  assert.throws(()=>discoverContracts(url),/Unclassified backend test/);
 }finally{rmSync(folder,{recursive:true,force:true})}
});
