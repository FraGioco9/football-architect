// Real browser + local Wrangler/D1 acceptance. All identities/state are synthetic.
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {openLocalDatabase,manageAccount} from '../backend/tools/operator-local.mts';
import {createPasswordService} from '../backend/src/password-core.ts';
import {PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS} from '../backend/src/footballer-public-projection.ts';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
import {verifyAdminWorldLifecycle} from './admin-world-lifecycle-browser.mjs';
import {preflightAnonymousLocalApi,collectAnonymousBrowser} from '../tools/perf-api-01-requests.mjs';

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
// Use the standard pull_request event file rather than changing the repository
// workflow just to pass one opt-in flag. The event is tied to this exact checkout.
async function auditRequested(){
 if(process.env.FA_LOCAL_API_AUDIT==='1')return true; // Explicit local-only opt-in.
 if(process.env.GITHUB_EVENT_NAME!=='pull_request'||!process.env.GITHUB_EVENT_PATH)return false;
 try{
  const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  const checked=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  return event.pull_request?.draft===true&&
   event.pull_request?.head?.sha===checked&&
   event.pull_request?.body?.includes('<!-- local-anonymous-api-audit -->')===true;
 }catch{return false}
}
const populatedAudit=await auditRequested();
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
  // Synthetic player records live only in the fresh local Miniflare D1 and are
  // destroyed with the temporary runner directory. Nothing is seeded remotely.
  if(populatedAudit){
   const world=await handle.db.prepare('SELECT generation FROM world_state WHERE id=1').first<{generation:string}>();
   assert.ok(world?.generation,'Local migrated world required');
   const draftId=crypto.randomUUID(),size=250;
   await handle.db.prepare('INSERT INTO player_generation_drafts (id,world_generation,season_number,account_id,options_json,candidates_json,count,seed,status,created_at,expires_at,committed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(draftId,world.generation,0,'browser-player','{}','[]',size,'perf-api-synthetic-250','committed',now,now+86400,now).run();
   const players=Array.from({length:size},(_,index)=>{
    const id=index+1,position=id%5===0?'GK':id%3===0?'ST':'CM';
    const attributes=Object.fromEntries(PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS.map((key,n)=>[key,25+(id*7+n*11)%70]));
    const payload={first_name:'Synthetic',last_name:'Player'+id,
     nationality:id%3===0?'ITA':id%3===1?'ENG':'FRA',secondary_nationality:null,
     age:18+id%18,initial_age:16,career_status:'active',height_cm:172+id%25,
     preferred_foot:id%4===0?'left':'right',primary_position:position,
     secondary_positions:position==='CM'?['DM']:[],attributes,development_aptitude:50};
    return {id,payload:JSON.stringify(payload)};
   });
   for(let start=0;start<players.length;start+=40)
    await handle.db.batch(players.slice(start,start+40).map(({id,payload})=>handle.db
     .prepare('INSERT INTO generated_players(id,batch_id,world_generation,entry_season,payload_json,created_at) VALUES (?,?,?,?,?,?)')
     .bind(id,draftId,world.generation,0,payload,now)));
   const memberships=Array.from({length:110},(_,i)=>({id:i+1,club:i<73?'IT-1':'IT-2'}));
   for(let start=0;start<memberships.length;start+=40)
    await handle.db.batch(memberships.slice(start,start+40).map(({id,club})=>handle.db
     .prepare('INSERT INTO player_club_affiliations(player_id,club_key) VALUES(?,?)').bind(id,club)));
   const total=await handle.db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>();
   const it1=await handle.db.prepare("SELECT COUNT(*) AS n FROM player_club_affiliations WHERE club_key='IT-1'").first<{n:number}>();
   assert.equal(total?.n,250);assert.equal(it1?.n,73);
   console.log('PERF-API-01 synthetic local D1 seed PASS: players=250; IT-1=73; IT-2=37');
  }
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
 // Optional diagnostic on this same disposable Worker/D1 and already-started
 // Chromium; never enable on all PRs or against the shared DEV/Preview pool.
 if(populatedAudit){
  await preflightAnonymousLocalApi(origin);
  const routes=['/dashboard','/players','/players?offset=50','/players?sort=age&order=desc',
   '/players/100','/clubs/it/1/overview','/clubs/it/1/roster'];
  const records=await collectAnonymousBrowser(browser,{base:origin,routes,runs:1});
  const summary=records.map(({route,scenario,requestCount,observedRequestCount,incomplete,errorResponses,repeatedRequestCandidates,skipped})=>({
   route,scenario,requestCount,observedRequestCount,incomplete:!!incomplete,errorResponses,repeatedRequestCandidates,skipped:!!skipped
  }));
  const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const directory=join(process.env.RUNNER_TEMP||state,'fa-ci-artifacts');
  await mkdir(directory,{recursive:true});
  const artifact={schemaVersion:1,head,environment:'disposable local Worker/D1; anonymous Chromium; world reset to synthetic Season 0',
   syntheticPopulation:{players:250,affiliations:{'IT-1':73,'IT-2':37},persistent:false},
   caveats:'Synthetic seeded player data on exact HEAD only, not a code-before/after or production comparison. Numeric selectors and URL variant IDs are only ephemeral.',
   records};
  await writeFile(join(directory,'perf-api-01-anonymous-local.json'),JSON.stringify(artifact,null,2)+'\n');
  console.log('PERF-API-01 REAL LOCAL WORKER/D1 '+JSON.stringify(summary));
  const rosterView=records.find(row=>row.route==='/clubs/it/1/roster'&&row.scenario==='roster-info-to-technical');
  assert.ok(rosterView&&!rosterView.skipped,'Populated roster must expose its view control');
  assert.equal(rosterView.requestCount,0,'Switching Roster view must not refetch verified roster data');
 }
}finally{
 if(browser)await browser.close();
 if(preview?.listening){preview.closeAllConnections();await new Promise<void>(r=>preview!.close(()=>r()))}
 if(worker&&worker.exitCode===null){const closed=once(worker,'close');worker.kill('SIGTERM');await closed}
 if(priorTarget===undefined)delete process.env.FA_ADMIN_API_TARGET;else process.env.FA_ADMIN_API_TARGET=priorTarget;
 await rm(state,{recursive:true,force:true});
}
