import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {openLocalDatabase,manageAccount} from '../tools/operator-local.mts';

test('real Wrangler canonical initialize/read and idempotent audit survive restart', {timeout:90000},async()=>{
 const state=await mkdtemp(join(tmpdir(),'fa-world-restart-'));
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=(server.address() as {port:number}).port;await new Promise<void>(r=>server.close(()=>r()));
 const origin='http://127.0.0.1:'+port,password='worker-restart-synthetic-password-2026';
 let child:ReturnType<typeof spawn>|undefined,logs='';
 const stop=async()=>{if(child&&child.exitCode===null){const closed=once(child,'close');child.kill('SIGTERM');await closed}child=undefined};
 const start=async()=>{
  child=spawn(process.execPath,[fileURLToPath(new URL('../bin/wrangler.js',import.meta.resolve('wrangler'))),'dev','--local','--inspector-port','0','--inspector-ip','127.0.0.1','--ip','127.0.0.1','--port',String(port),'--persist-to',state,'--var','ADMIN_MODE:local','--var','ADMIN_ORIGIN:'+origin],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
  child.stdout!.on('data',x=>{logs+=String(x)});child.stderr!.on('data',x=>{logs+=String(x)});
  for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error('Local Worker exited: '+logs.slice(-1200));
   try{const r=await fetch(origin+'/api/world');if(r.status===200)return await r.json() as any}catch{}
   await delay(150);
  }
  throw Error('Local Worker readiness timeout: '+logs.slice(-1200));
 };
 try{
  const handle=await openLocalDatabase(state);
  try{await manageAccount(handle.db,'create','operator@example.invalid',password)}finally{await handle.close()}
  const before=await start();
  const logged=await fetch(origin+'/api/admin/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'operator@example.invalid',password})});
  assert.equal(logged.status,200);const cookie=logged.headers.get('set-cookie')!.split(';')[0],auth=await logged.json() as any;
  const session=await fetch(origin+'/api/admin/session',{headers:{Cookie:cookie}});assert.equal(session.status,200);
  const command={expectedGeneration:before.world.generation,expectedRevision:before.world.revision};
  const prepare=()=>fetch(origin+'/api/admin/seasons/prepare',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':auth.csrfToken,'Idempotency-Key':'canonical-restart-prepare-01'},body:JSON.stringify(command)});
  const initialized=await prepare();assert.equal(initialized.status,200);const outcome=await initialized.json() as any;
  assert.deepEqual(outcome.world,{...before.world,seasonNumber:1,revision:1,day:0,phase:'preparing'});
  await stop();const after=await start();assert.deepEqual(after,{world:outcome.world});
  const replay=await prepare();assert.equal(replay.status,200);assert.deepEqual(await replay.json(),outcome);
  assert.equal((await fetch(origin+'/api/admin/session',{headers:{Cookie:cookie}})).status,200);
  const [one,two]=await Promise.all([fetch(origin+'/api/world').then(r=>r.json()),fetch(origin+'/api/world').then(r=>r.json())]);assert.deepEqual(one,two);assert.deepEqual(one,{world:outcome.world});
  await stop();const persisted=await openLocalDatabase(state);
  try{
   const rows=await persisted.db.prepare('SELECT * FROM admin_operations').all();assert.equal(rows.results.length,1);
   const audit=rows.results[0];assert.equal(audit.id,outcome.operationId);assert.equal(audit.command,'prepare-season-v1');assert.equal(audit.resulting_revision,1);assert.ok(Number(audit.created_at)>0);
   const season=await persisted.db.prepare('SELECT * FROM seasons').first() as any;assert.equal(season.participants_hash,'d31b39b48190eed3e165931be573391d17298321fdb3ca71e922346aa3749d1a');
   assert.equal(JSON.parse(season.snapshot_json).approvalReference,'owner:2026-10-28:season-1-review:8126da13d0f36a1a2087f66f21626d06fe00c873');
  }finally{await persisted.close()}
  assert.ok(!logs.includes(password));assert.ok(!logs.includes(cookie.split('=')[1]));
 }finally{await stop();await rm(state,{recursive:true,force:true})}
});
