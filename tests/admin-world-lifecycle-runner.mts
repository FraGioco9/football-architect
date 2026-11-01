// Real browser + local Wrangler/D1 acceptance. All identities/state are synthetic.
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {openLocalDatabase,manageAccount} from '../backend/tools/operator-local.mts';
import {createPasswordService} from '../backend/src/password-core.ts';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
import {verifyAdminWorldLifecycle} from './admin-world-lifecycle-browser.mjs';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const playwright=await import(process.env.FA_ADMIN_PLAYWRIGHT||require.resolve('playwright'));
const state=await mkdtemp(join(tmpdir(),'fa-admin-browser-'));
const origin='http://app.localhost:2000';
const password='browser-player-synthetic-password-2026',legacyPassword='browser-legacy-different-password-2026';
const email='operator@example.invalid';
const portProbe=createServer();portProbe.listen(0,'127.0.0.1');await once(portProbe,'listening');
const port=(portProbe.address() as {port:number}).port;
await new Promise<void>(r=>portProbe.close(()=>r()));
let worker:ReturnType<typeof spawn>|undefined,browser:any,preview:ReturnType<typeof createPreviewServer>|undefined;
const priorTarget=process.env.FA_ADMIN_API_TARGET;
let workerLogs='';
try{
 const handle=await openLocalDatabase(state);
 try{
  await manageAccount(handle.db,'create',email,legacyPassword);
  const legacy=await handle.db.prepare('SELECT id FROM admin_accounts WHERE email_normalized=?').bind(email).first<{id:string}>();
  assert.ok(legacy);
  // Compute a distinct Player verifier; never copy the retired Admin credential.
  const setupWasm=(await import(require.resolve('argon2id/lib/setup.js'))).default;
  const moduleRoot=new URL('./',pathToFileURL(require.resolve('argon2id')));
  const modules=await Promise.all(['simd','no-simd'].map(async name=>WebAssembly.compile(await readFile(new URL('dist/'+name+'.wasm',moduleRoot)))));
  const loader=(module:WebAssembly.Module)=>(imports:WebAssembly.Imports)=>WebAssembly.instantiate(module,imports).then(instance=>({module,instance}));
  const service=createPasswordService(setupWasm(loader(modules[0]),loader(modules[1])));
  const verifier=await service.hashPassword(password),now=Math.floor(Date.now()/1000);
  await handle.db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
   .bind('browser-player',email,verifier,1,now,'active',now,now).run();
  await handle.db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind('browser-player',legacy.id,now).run();
  await handle.db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>handle.db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('browser-player',permission,now)));
 }finally{await handle.close()}
 const wrangler=fileURLToPath(new URL('../bin/wrangler.js',pathToFileURL(require.resolve('wrangler'))));
 worker=spawn(process.execPath,[wrangler,'dev','--local','--inspector-port','0','--inspector-ip','127.0.0.1','--ip','127.0.0.1','--port',String(port),'--persist-to',state,'--var','PLAYER_MODE:local','--var','PLAYER_ORIGIN:'+origin],{cwd:fileURLToPath(new URL('../backend/',import.meta.url)),env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
 const capture=(chunk:Buffer)=>{workerLogs=(workerLogs+String(chunk)).slice(-12000)};
 worker.stdout!.on('data',capture);worker.stderr!.on('data',capture);
 let ready=false;
 for(let n=0;n<100;n++){
  if(worker.exitCode!==null)throw Error('Disposable Worker exited before readiness');
  try{if((await fetch('http://127.0.0.1:'+port+'/api/world')).status===200){ready=true;break}}catch{}
  await delay(150);
 }
 assert.ok(ready,'Disposable Worker readiness');
 process.env.FA_ADMIN_API_TARGET='http://127.0.0.1:'+port;
 preview=createPreviewServer({subdomains:true,devPreview:false});preview.listen(2000,'127.0.0.1');await once(preview,'listening');
 browser=await playwright.chromium.launch({headless:true,...(process.env.FA_ADMIN_CHROME?{executablePath:process.env.FA_ADMIN_CHROME,args:['--no-sandbox']}: {})});
 const result=await verifyAdminWorldLifecycle(browser,{origin,publicOrigin:'http://127.0.0.1:2000',password,email,legacyPassword});
 assert.deepEqual(result,{unifiedPlayerLogin:true,retiredAdminLoginDenied:true,distinctCredentials:true,twoSeasonLifecycle:true,anonymousIsolation:true,historicalNavigation:true,staleResetProjection:true,freshInitialization:true});
 assert.ok(!workerLogs.includes(password)&&!workerLogs.includes(legacyPassword),'No credential in Worker logs');
 console.log('Unified Admin real Worker/D1 browser lifecycle PASS: '+JSON.stringify(result));
}finally{
 if(browser)await browser.close();
 if(preview?.listening){preview.closeAllConnections();await new Promise<void>(r=>preview!.close(()=>r()))}
 if(worker&&worker.exitCode===null){const closed=once(worker,'close');worker.kill('SIGTERM');await closed}
 if(priorTarget===undefined)delete process.env.FA_ADMIN_API_TARGET;else process.env.FA_ADMIN_API_TARGET=priorTarget;
 await rm(state,{recursive:true,force:true});
}
