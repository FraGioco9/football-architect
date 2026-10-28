import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
test('actual Worker local compilation excludes synthetic approval fixtures and operator tooling', {timeout:30000},async()=>{
 const out=await mkdtemp(join(tmpdir(),'fa-worker-build-'));
 try{
  // --dry-run compiles/checks only; this never uploads, provisions or touches remote D1.
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../bin/wrangler.js',import.meta.resolve('wrangler'))),'deploy','--dry-run','--no-autoconfig','--outdir',out,'--metafile',join(out,'meta.json')],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,WRANGLER_SEND_METRICS:'false',CI:'true'},encoding:'utf8',timeout:25000});
  assert.equal(result.status,0,String(result.stderr).slice(-1200));
  const meta=JSON.parse(await readFile(join(out,'meta.json'),'utf8'));
  assert.ok(Object.keys(meta.inputs).some(path=>path.endsWith('src/commands.ts')));
  for(const path of Object.keys(meta.inputs))assert.doesNotMatch(path,/(?:^|\/)(?:tests|fixtures|tools)\//,path);
  for(const path of Object.keys(meta.inputs))assert.doesNotMatch(path,/season-1\.candidate\.json/,path);
  for(const required of ['catalogues/season-1.approval.json','data/clubs.json','data/divisions.json','data/international-competitions.json','assets/world-calendar-model.js'])assert.ok(Object.keys(meta.inputs).some(path=>path.endsWith(required)),required);
  const entries=await readdir(out);assert.ok(entries.some(path=>path.endsWith('.js')));
  for(const file of entries.filter(path=>/\.(?:js|map)$/.test(path)))assert.doesNotMatch(await readFile(join(out,file),'utf8'),/season-one-review-candidate|pending-owner-review|synthetic:test-only|synthetic-prepare|synthetic-operator-password|fixture@example\.invalid/);
 }finally{await rm(out,{recursive:true,force:true})}
});
