import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,copyFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readD1Migrations} from '@cloudflare/vitest-plugin';
import {createHash} from 'node:crypto';
import {preparePreview,verifyPreviewPackage,validatePreviewTarget} from '../tools/prepare-preview.mts';
const repository=fileURLToPath(new URL('../../',import.meta.url));
const target={accountId:'1'.repeat(32),databaseId:'11111111-1111-4111-8111-111111111111',origin:'https://football-architect-preview.example.workers.dev'};
test('Preview target rejects Production/arbitrary origins, local UUIDs and incomplete provenance',()=>{
 assert.doesNotThrow(()=>validatePreviewTarget({...target,sourceSha:'a'.repeat(40)}));
 for(const extra of [{origin:'https://production.example.com'},{origin:target.origin+'/'},{origin:'http://football-architect-preview.example.workers.dev'},{origin:'https://user:pass@football-architect-preview.example.workers.dev'},{databaseId:'00000000-0000-4000-8000-000000000001'},{accountId:'bad'},{sourceSha:'HEAD'}])assert.throws(()=>validatePreviewTarget({...target,sourceSha:'a'.repeat(40),...extra}));
});
test('offline exact-snapshot preparation compiles a standalone guarded package and detects tampering',{timeout:90000},async()=>{
 const temp=await mkdtemp(join(tmpdir(),'fa-preview-package-')),source=join(temp,'source'),output=join(temp,'package');
 const git=(...args:string[])=>execFileSync('git',args,{cwd:source,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 try{
  await mkdir(source);const archive=join(temp,'source.tar');execFileSync('git',['archive','HEAD','--format=tar','--output',archive],{cwd:repository});execFileSync('tar',['-xf',archive,'-C',source]);
  // Include the current patch for pre-commit RED/GREEN runs; final CI source is
  // already the exact checked-out commit. Nothing changes the real checkout.
  for(const path of ['backend/src/preview.ts','backend/src/preview-routes.d.ts','assets/account-ui.js','assets/app.js','assets/landing.js'])await copyFile(join(repository,path),join(source,path));
  git('init','-q');git('add','.');git('-c','user.name=Local QA','-c','user.email=qa@example.invalid','commit','-qm','Disposable Preview package fixture');
  const sourceSha=git('rev-parse','HEAD').trim();
  const manifest=await preparePreview({...target,repository:source,sourceSha,output});
  assert.equal(manifest.sourceSha,sourceSha);assert.ok(manifest.files.some(x=>x.path==='assets/account/login/index.html'));assert.ok(manifest.files.some(x=>/^bundle\/.*\.wasm$/.test(x.path)));
  const config=JSON.parse(await readFile(join(output,'wrangler.json'),'utf8'));assert.equal(config.vars.PLAYER_MODE,'preview');assert.equal(config.vars.PLAYER_ORIGIN,target.origin);assert.equal(config.assets.run_worker_first,true);assert.equal(config.assets.html_handling,'none');assert.equal(config.no_bundle,true);assert.equal(config.d1_databases[0].database_id,target.databaseId);
  for(const path of manifest.files.map(x=>x.path))assert.doesNotMatch(path,/^assets\/(?:backend|tools|tests|\.git|\.wrangler|__fa_dev__)\//);
  assert.equal(await readFile(join(output,'assets/account/login/index.html'),'utf8'),await readFile(join(source,'account/login/index.html'),'utf8'));
  assert.doesNotMatch(await readFile(join(output,config.main),'utf8'),/synthetic-operator-password|fixture@example\.invalid|season-one-review-candidate/);
  assert.deepEqual(await verifyPreviewPackage(output),manifest);
  const wrangler=fileURLToPath(new URL('../bin/wrangler.js',import.meta.resolve('wrangler')));
  execFileSync(process.execPath,[wrangler,'deploy','--dry-run','--no-autoconfig','--config',join(output,'wrangler.json'),'--outdir',join(temp,'standalone-check')],{cwd:temp,env:{...process.env,WRANGLER_SEND_METRICS:'false',CI:'true'},stdio:'pipe',timeout:30000});
  assert.deepEqual(await verifyPreviewPackage(output),manifest);
  const runtime=new Miniflare(convertV4MiniflareOptions({modules:manifest.files.filter(x=>x.path===config.main.replace('./','')||x.path.endsWith('.wasm')).sort((a,b)=>a.path.endsWith('.js')?-1:1).map(x=>({type:x.path.endsWith('.wasm')?'CompiledWasm' as const:'ESModule' as const,path:join(output,x.path)})),modulesRoot:join(output,'bundle'),compatibilityDate:config.compatibility_date,bindings:config.vars,d1Databases:{DB:target.databaseId},assets:{directory:join(output,'assets'),binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true},assetConfig:{html_handling:'none',not_found_handling:'none'}}}));
  try{
   const db=await runtime.getD1Database('DB');for(const migration of await readD1Migrations(join(source,'backend/migrations')))await db.batch(migration.queries.map(sql=>db.prepare(sql)));
   await db.prepare("INSERT INTO account_environment_pool VALUES(1,'dev-preview',1)").run();
   for(const path of ['/account/login','/calendar','/competitions/it-1/fixtures?season=1','/clubs/it/3/history']){
    const r=await runtime.dispatchFetch(target.origin+path);assert.equal(r.status,200,path+(r.status===200?'':' '+(await r.text()).slice(0,1200)));assert.match(r.headers.get('content-type')??'',/html/);assert.match(r.headers.get('cache-control')??'',/no-store/);assert.equal(r.headers.get('x-fa-source-sha'),sourceSha);assert.doesNotMatch(await r.text(),/window\.faDevPreviewMode=true|data-fa-dev-preview/);
   }
   for(const path of ['/backend/wrangler.toml','/tools/publication-guard.mjs','/__fa_dev__/standings-client.mjs'])assert.equal((await runtime.dispatchFetch(target.origin+path)).status,404,path);
   const headers={'CF-Connecting-IP':'192.0.2.10'};
   const handshake=await runtime.dispatchFetch(target.origin+'/api/environment',{headers});assert.equal(handshake.status,200);assert.equal((await handshake.json() as {pool:string}).pool,'dev-preview');
   assert.equal((await runtime.dispatchFetch(target.origin+'/api/player/session',{headers})).status,401);
   assert.equal((await runtime.dispatchFetch(target.origin+'/api/world')).status,200);
  }finally{await runtime.dispose()}

  await assert.rejects(preparePreview({...target,repository:source,sourceSha,output}),/exists|overwrite/);
  await writeFile(join(output,'assets/account/login/index.html'),'tampered');await assert.rejects(verifyPreviewPackage(output),/hash|integrity/);
 }finally{await rm(temp,{recursive:true,force:true})}
});

test('package verification rejects a self-consistent hash list with a Production config',async()=>{
 const output=await mkdtemp(join(tmpdir(),'fa-preview-policy-'));
 try{
  const contents=JSON.stringify({vars:{PLAYER_MODE:'production'}});await writeFile(join(output,'wrangler.json'),contents);
  await writeFile(join(output,'manifest.json'),JSON.stringify({schemaVersion:1,sourceSha:'a'.repeat(40),sourceTree:'b'.repeat(40),pool:'dev-preview',origin:target.origin,target:{accountId:target.accountId,databaseId:target.databaseId},publicationAuthorized:false,files:[{path:'wrangler.json',sha256:createHash('sha256').update(contents).digest('hex'),bytes:Buffer.byteLength(contents)}]}));
  await assert.rejects(verifyPreviewPackage(output),/config|policy|target/);
 }finally{await rm(output,{recursive:true,force:true})}
});
