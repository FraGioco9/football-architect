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

test('real Wrangler local Worker sees operator storage and durable sessions after restart', {timeout:90000},async()=>{
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
  assert.equal(logged.status,200);const cookie=logged.headers.get('set-cookie')!.split(';')[0];
  const session=await fetch(origin+'/api/admin/session',{headers:{Cookie:cookie}});assert.equal(session.status,200);
  await stop();const after=await start();assert.deepEqual(after,before);
  assert.equal((await fetch(origin+'/api/admin/session',{headers:{Cookie:cookie}})).status,200);
  const [one,two]=await Promise.all([fetch(origin+'/api/world').then(r=>r.json()),fetch(origin+'/api/world').then(r=>r.json())]);assert.deepEqual(one,two);
  assert.ok(!logs.includes(password));assert.ok(!logs.includes(cookie.split('=')[1]));
 }finally{await stop();await rm(state,{recursive:true,force:true})}
});
