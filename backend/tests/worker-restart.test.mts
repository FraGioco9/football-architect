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

test('real Wrangler canonical initialize/read and idempotent audit survive restart', {timeout:180000},async()=>{
 const state=await mkdtemp(join(tmpdir(),'fa-world-restart-'));
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=(server.address() as {port:number}).port;await new Promise<void>(r=>server.close(()=>r()));
 const origin='http://127.0.0.1:'+port,password='worker-restart-synthetic-password-2026';
 let child:ReturnType<typeof spawn>|undefined,logs='';
 const stop=async()=>{if(child&&child.exitCode===null){const closed=once(child,'close');child.kill('SIGTERM');await closed}child=undefined};
 const start=async()=>{
  child=spawn(process.execPath,[fileURLToPath(new URL('../bin/wrangler.js',import.meta.resolve('wrangler'))),'dev','--local','--inspector-port','0','--inspector-ip','127.0.0.1','--ip','127.0.0.1','--port',String(port),'--persist-to',state,'--var','PLAYER_MODE:local','--var','PLAYER_ORIGIN:'+origin],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
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
  try{
   await manageAccount(handle.db,'create','operator@example.invalid',password);
   const operator=await handle.db.prepare('SELECT id,password_verifier FROM admin_accounts WHERE email_normalized=?').bind('operator@example.invalid').first<{id:string;password_verifier:string}>();
   assert.ok(operator);
   const now=Math.floor(Date.now()/1000),playerId='restart-player';
   await handle.db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
    .bind(playerId,'operator@example.invalid',operator.password_verifier,1,now,'active',now,now).run();
   await handle.db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
    .bind(playerId,operator.id,now).run();
   await handle.db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>
    handle.db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind(playerId,permission,now)));
  }finally{await handle.close()}
  const before=await start();
  const logged=await fetch(origin+'/api/player/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'operator@example.invalid',password})});
  assert.equal(logged.status,200);const cookie=logged.headers.get('set-cookie')!.split(';')[0],auth=await logged.json() as any;
  const session=await fetch(origin+'/api/player/session',{headers:{Cookie:cookie}});assert.equal(session.status,200);
  const command={expectedGeneration:before.world.generation,expectedRevision:before.world.revision};
  const prepare=()=>fetch(origin+'/api/admin/seasons/prepare',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':auth.csrfToken,'Idempotency-Key':'canonical-restart-prepare-01'},body:JSON.stringify(command)});
  const initialized=await prepare();assert.equal(initialized.status,200);const outcome=await initialized.json() as any;
  assert.deepEqual(outcome.world,{...before.world,seasonNumber:1,revision:1,day:0,phase:'preparing'});
  // The score-only direct calendar/start endpoints are retired. Use the
  // complete protected V2 milestone and day-finalization HTTP flow.
  let simulatedWorld=outcome.world;
  const submit=(path:string,body:unknown,key:string)=>fetch(origin+path,{
   method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json',
    'X-CSRF-Token':auth.csrfToken,'Idempotency-Key':key},body:JSON.stringify(body)
  });
  const action=async(path:string,key:string,extra:Record<string,unknown>={})=>{
   const cmd={expectedGeneration:simulatedWorld.generation,expectedRevision:simulatedWorld.revision,...extra};
   const response=await submit(path,cmd,key);
   assert.equal(response.status,200,path+': '+await response.clone().text());
   const saved=await response.json() as any;
   simulatedWorld=saved.world;
   return saved;
  };
  await action('/api/admin/seasons/events/initialize','canonical-restart-initialize-01');
  await action('/api/admin/seasons/events/start','canonical-restart-event-start-01');
  for(const eventId of ['domestic:entrants','international:entrants'])
   await action('/api/admin/seasons/events/confirm','canonical-restart-confirm-'+eventId,{eventId});
  await action('/api/admin/seasons/events/advance','canonical-restart-event-day2-01');
  await action('/api/admin/seasons/events/domestic-calendar','canonical-restart-domestic-01');
  await action('/api/admin/seasons/events/advance','canonical-restart-event-day3-01');
  await action('/api/admin/seasons/events/international-draw','canonical-restart-draw-01');
  const calendarCommand={expectedGeneration:simulatedWorld.generation,expectedRevision:simulatedWorld.revision};
  const generate=()=>submit('/api/admin/seasons/events/international-calendar',calendarCommand,'canonical-restart-publish-01');
  const generated=await generate();assert.equal(generated.status,200,await generated.clone().text());
  const calendarOutcome=await generated.json() as any;simulatedWorld=calendarOutcome.world;
  assert.deepEqual(simulatedWorld,{...outcome.world,revision:10,day:3,phase:'active'});
  let lastAdvanceCommand:any,lastAdvanceOutcome:any;
  for(let day=4;day<=13;day++){
   lastAdvanceCommand={expectedGeneration:simulatedWorld.generation,expectedRevision:simulatedWorld.revision};
   const next=await submit('/api/admin/seasons/advance',lastAdvanceCommand,'canonical-restart-sport-day-'+day);
   assert.equal(next.status,200,'sport day '+day+': '+await next.clone().text());
   lastAdvanceOutcome=await next.json() as any;simulatedWorld=lastAdvanceOutcome.world;
   assert.equal(simulatedWorld.day,day);
  }
  await stop();const after=await start();assert.deepEqual(after,{world:simulatedWorld});
  const advanceReplay=await submit('/api/admin/seasons/advance',lastAdvanceCommand,'canonical-restart-sport-day-13');
  assert.equal(advanceReplay.status,200,await advanceReplay.clone().text());
  assert.deepEqual(await advanceReplay.json(),lastAdvanceOutcome);
  const calendarReplay=await generate();assert.equal(calendarReplay.status,200);
  assert.deepEqual(await calendarReplay.json(),calendarOutcome);
  const prepareReplay=await prepare();assert.equal(prepareReplay.status,200);
  assert.deepEqual(await prepareReplay.json(),outcome);
  assert.equal((await fetch(origin+'/api/admin/session',{headers:{Cookie:cookie}})).status,200);
  const [one,two]=await Promise.all([fetch(origin+'/api/world').then(r=>r.json()),fetch(origin+'/api/world').then(r=>r.json())]);
  assert.deepEqual(one,two);assert.deepEqual(one,{world:simulatedWorld});
  const matchRead=await fetch(origin+'/api/competitions/IT-1/seasons/1');
  assert.equal(matchRead.status,200);
  assert.equal((await matchRead.json() as any).provenance.resultAuthority,'temporary-lineup-v1');
  await stop();
  const persisted=await openLocalDatabase(state);
  try{
   const operations=(await persisted.db.prepare('SELECT * FROM admin_operations').all()).results;
   assert.equal(operations.length,20);
   const audit=operations.find((r:any)=>r.command==='prepare-season-v1') as any;
   assert.equal(audit.id,outcome.operationId);assert.equal(audit.resulting_revision,1);
   assert.ok(Number(audit.created_at)>0);
   const season=await persisted.db.prepare('SELECT * FROM seasons').first() as any;
   assert.equal(season.participants_hash,'d31b39b48190eed3e165931be573391d17298321fdb3ca71e922346aa3749d1a');
   const days=(await persisted.db.prepare('SELECT * FROM season_lineup_day_outcomes ORDER BY day').all()).results;
   assert.equal(days.length,13);
   const day=days.find((r:any)=>r.day===13) as any;
   const dayEvidence=JSON.parse(day.outcome_json);
   assert.equal(dayEvidence.simulationVersion,'temporary-lineup-v1');
   assert.equal(dayEvidence.results.length,128);
   assert.ok(dayEvidence.results.every((r:any)=>Number.isSafeInteger(r.matchId)&&r.receiptHash));
   const receipts=(await persisted.db.prepare('SELECT receipt_json FROM match_lineup_result_receipts WHERE day=13').all()).results;
   assert.equal(receipts.length,128);
   for(const receipt of receipts){
    const frozen=JSON.parse(receipt.receipt_json as string);
    assert.equal(frozen.authority,'official');
    assert.equal(frozen.algorithmVersion,'temporary-lineup-v1');
    assert.equal(frozen.result.home.kind,'team_fallback');
    assert.equal(frozen.result.away.kind,'team_fallback');
   }
   const legacy=(await persisted.db.prepare('SELECT count(*) n FROM season_day_outcomes').first()) as {n:number};
   assert.equal(legacy.n,0);
   const calendar=await persisted.db.prepare('SELECT * FROM season_calendars').first() as any;
   assert.equal(JSON.parse(calendar.calendar_json).fixtures.length,3984);
   const draws=(await persisted.db.prepare('SELECT * FROM season_draws').all()).results;
   assert.equal(draws.length,2);
   for(const draw of draws)assert.equal(JSON.parse(draw.outcome_json as string).fixtures.length,72);
   assert.equal(JSON.parse(season.snapshot_json).approvalReference,'owner:2026-10-28:season-1-review:8126da13d0f36a1a2087f66f21626d06fe00c873');
  }finally{await persisted.close()}
  assert.ok(!logs.includes(password));assert.ok(!logs.includes(cookie.split('=')[1]));
 }finally{await stop();await rm(state,{recursive:true,force:true})}
});
