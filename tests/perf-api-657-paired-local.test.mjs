import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parsePairedOptions,validateLocalSnapshot,DEFAULT_MEASURED_ROUTES} from '../tools/perf-api-657-paired-local.mjs';

const a='1'.repeat(40),b='2'.repeat(40);
const opts=extra=>parsePairedOptions([
 '--before='+a,'--after='+b,'--snapshot=/tmp/local-isolated-d1',
 ...extra
]);
test('PERF-API-657 pairs immutable served revisions, never names/remote API URLs',()=>{
 const p=opts(['--runs=3','--routes=/calendar,/clubs,/dashboard']);
 assert.equal(p.before,a);assert.equal(p.after,b);assert.equal(p.runs,3);
 assert.deepEqual(p.routes,['/calendar','/clubs','/dashboard']);
 assert.ok(DEFAULT_MEASURED_ROUTES.includes('/calendar'));
 for(const args of [
  ['--after='+a],['--before=main'],['--after=https://example.com'],
  ['--runs=6'],['--routes=https://other.site/calendar'],['--routes=//evil'],
  ['--routes=/calendar,/calendar'],['--base-url=https://preview.football-architect.workers.dev'],
  ['--snapshot=relative/path'],['--before='+a],['--playwright=relative/index.mjs']
 ])assert.throws(()=>opts(args));
});
test('PERF-API-657 requires a COPY of a real local SQLite state outside the checkout',()=>{
 const root=mkdtempSync(join(tmpdir(),'fa-perf-657-test-'));
 try{
  const repo=join(root,'repo'),snapshot=join(root,'saved-local-state');
  mkdirSync(repo);mkdirSync(join(snapshot,'v3','d1'),{recursive:true});
  assert.throws(()=>validateLocalSnapshot(snapshot,repo),/no local Wrangler .sqlite/);
  const file=join(snapshot,'v3','d1','local.sqlite');
  writeFileSync(file,'test marker only: no Worker is started in this pure test');
  assert.equal(validateLocalSnapshot(snapshot,repo),true);
  assert.throws(()=>validateLocalSnapshot(repo,repo),/OUTSIDE/);
  assert.throws(()=>validateLocalSnapshot(join(root,'missing'),repo),/Missing/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
