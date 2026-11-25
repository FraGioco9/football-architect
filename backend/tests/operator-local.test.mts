import * as requireChildProcessForPowerShellTest from 'node:child_process';
import {fileURLToPath as fileURLToPathForPowerShellTest} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openLocalDatabase,manageAccount} from '../tools/operator-local.mts';
import {auditOperatorCutover} from '../tools/operator-cutover-audit.mts';
import {rehearseLocalOperatorGrant,rehearseLocalOperatorRevoke} from '../tools/operator-cutover-rehearsal.mts';
import {requireStoredSession} from '../src/session-repository.ts';
import {createOpaqueToken,digestOpaqueToken} from '../src/session-tokens.ts';

test('local operator bootstrap/recovery persists across restart without default account or plaintext credentials',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fa-admin-operator-'));
 let handle:Awaited<ReturnType<typeof openLocalDatabase>>|undefined;
 try{
  handle=await openLocalDatabase(dir);
  const generation=await handle.db.prepare('SELECT generation FROM world_state').first();
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM admin_accounts').first())!.n,0);
  await manageAccount(handle.db,'create',' Operator@Example.Invalid ','local-synthetic-password-2026');
  await assert.rejects(manageAccount(handle.db,'create','operator@example.invalid','other-synthetic-password-2026'));
  const account=await handle.db.prepare('SELECT * FROM admin_accounts').first() as any;
  assert.equal(account.email_normalized,'operator@example.invalid');assert.equal(account.credential_version,1);
  assert.ok(String(account.password_verifier).startsWith('$argon2id$v=19$m=19456,t=2,p=1$'));
  assert.ok(!JSON.stringify(account).includes('local-synthetic-password-2026'));
  const token=createOpaqueToken(),now=Math.floor(Date.now()/1000),digest=await digestOpaqueToken(token);
  await handle.db.prepare('INSERT INTO admin_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?,?)').bind(digest,account.id,1,'a'.repeat(64),now,now,now+100).run();
  assert.equal(await requireStoredSession(handle.db,token,now),account.id);
  await handle.close();handle=undefined;handle=await openLocalDatabase(dir);
  assert.equal(await requireStoredSession(handle.db,token,now),account.id);
  await manageAccount(handle.db,'replace-password','operator@example.invalid','replacement-synthetic-password-2026');
  await assert.rejects(requireStoredSession(handle.db,token,now));
  assert.equal((await handle.db.prepare('SELECT credential_version FROM admin_accounts').first())!.credential_version,2);
  await handle.close();handle=undefined;
  handle=await openLocalDatabase(dir);
  assert.deepEqual(await handle.db.prepare('SELECT generation FROM world_state').first(),generation);
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM admin_accounts').first())!.n,1);
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM admin_sessions').first())!.n,0);
 }finally{await handle?.close();await rm(dir,{recursive:true,force:true})}
});

test('operator local storage refuses remote and ambiguous targets',async()=>{
 for(const target of ['','relative/path','https://remote.invalid/db','//server/share'])await assert.rejects(openLocalDatabase(target));
});

test('operator refuses ancestor and persistence-subtree symlinks without writing through them',async()=>{
 const {symlink,mkdir,readdir}=await import('node:fs/promises');
 const root=await mkdtemp(join(tmpdir(),'fa-admin-links-'));
 try{
  const outside=join(root,'outside');await mkdir(outside);
  const linked=join(root,'alias');await symlink(outside,linked);
  await assert.rejects(openLocalDatabase(join(linked,'child')));
  assert.deepEqual(await readdir(outside),[]);
  const state=join(root,'state');await mkdir(state);await symlink(outside,join(state,'v3'));
  await assert.rejects(openLocalDatabase(state));
  assert.deepEqual(await readdir(outside),[]);
  const nested=join(root,'nested','v3','d1','namespace');await mkdir(nested,{recursive:true});await symlink(outside,join(nested,'database.sqlite'));
  await assert.rejects(openLocalDatabase(join(root,'nested')));
  assert.deepEqual(await readdir(outside),[]);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('read-only cutover audit denies incomplete linking and accepts explicit verified grants',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fa-cutover-audit-'));
 const email='audit@example.invalid',now=Math.floor(Date.now()/1000);
 const handle=await openLocalDatabase(dir);
 try{
  const first=await auditOperatorCutover(handle.db,email);
  assert.equal(first.ready,false);assert.ok(first.findings.includes('operator_missing'));
  await manageAccount(handle.db,'create',email,'synthetic-cutover-password-2026');
  await handle.db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
   .bind('audit-player',email,'synthetic',1,'pending',now,now).run();
  const unverified=await auditOperatorCutover(handle.db,email);
  assert.deepEqual(unverified.findings,['player_inactive','player_unverified','operator_link_missing','missing_access','missing_read','missing_write']);
  const operator=await handle.db.prepare('SELECT id FROM admin_accounts WHERE email_normalized=?').bind(email).first<{id:string}>();
  assert.ok(operator);
  await handle.db.prepare('UPDATE player_accounts SET status=?,email_verified_at=? WHERE id=?').bind('active',now,'audit-player').run();
  await handle.db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
   .bind('audit-player',operator.id,now).run();
  await handle.db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>
   handle.db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('audit-player',permission,now)));
  const before=await handle.db.prepare('SELECT generation,revision FROM world_state').first();
  assert.deepEqual(await auditOperatorCutover(handle.db,email),{ready:true,findings:[]});
  await handle.db.prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?').bind(operator.id).run();
  assert.deepEqual((await auditOperatorCutover(handle.db,email)).findings,['operator_disabled']);
  await handle.db.prepare('UPDATE admin_accounts SET enabled=1 WHERE id=?').bind(operator.id).run();
  await handle.db.prepare('DELETE FROM player_admin_operator_links WHERE player_account_id=?').bind('audit-player').run();
  assert.deepEqual((await auditOperatorCutover(handle.db,email)).findings,['operator_link_missing']);
  await handle.db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
   .bind('audit-player',operator.id,now).run();
  assert.deepEqual(await auditOperatorCutover(handle.db,email),{ready:true,findings:[]});
  await manageAccount(handle.db,'create','other-operator@example.invalid','synthetic-other-password-2026');
  const other=await handle.db.prepare('SELECT id FROM admin_accounts WHERE email_normalized=?')
   .bind('other-operator@example.invalid').first<{id:string}>();
  assert.ok(other);
  await handle.db.prepare('UPDATE player_admin_operator_links SET legacy_admin_account_id=? WHERE player_account_id=?')
   .bind(other.id,'audit-player').run();
  assert.deepEqual((await auditOperatorCutover(handle.db,email)).findings,['operator_link_conflict']);
  await handle.db.prepare('UPDATE player_admin_operator_links SET legacy_admin_account_id=? WHERE player_account_id=?')
   .bind(operator.id,'audit-player').run();
  assert.deepEqual(await auditOperatorCutover(handle.db,email),{ready:true,findings:[]});
  assert.deepEqual(await handle.db.prepare('SELECT generation,revision FROM world_state').first(),before,'Preflight never changes sporting world');
  await handle.db.prepare('DELETE FROM account_permissions WHERE account_id=? AND permission=?').bind('audit-player','admin.world.write').run();
  assert.deepEqual((await auditOperatorCutover(handle.db,email)).findings,['missing_write']);
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM player_sessions').first<{n:number}>())?.n,0);
  await assert.rejects(auditOperatorCutover(handle.db,'invalid'));
 }finally{await handle.close();await rm(dir,{recursive:true,force:true})}
});

test('synthetic cutover rehearsal grants only explicitly matched identities and revokes safely',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fa-operator-rehearsal-'));
 const handle=await openLocalDatabase(dir);
 try{
  const now=Math.floor(Date.now()/1000),email='rehearsal@example.invalid';
  await manageAccount(handle.db,'create',email,'synthetic-operator-password-2026');
  const legacy=await handle.db.prepare('SELECT id FROM admin_accounts WHERE email_normalized=?').bind(email).first<{id:string}>();
  assert.ok(legacy);
  await handle.db.prepare("INSERT INTO player_accounts(id,email_normalized,password_verifier,status,email_verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
   .bind('rehearsal-player',email,'synthetic','active',now,now,now).run();
  const identity={playerId:'rehearsal-player',legacyId:legacy.id,email};
  assert.deepEqual((await auditOperatorCutover(handle.db,email)).findings,['operator_link_missing','missing_access','missing_read','missing_write']);
  await assert.rejects(rehearseLocalOperatorGrant(handle.db,{...identity,legacyId:'different'},now));
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM account_permissions').first<{n:number}>())?.n,0);
  const worldBefore=await handle.db.prepare('SELECT generation,revision FROM world_state').first();
  // Prevent silent privilege transfer if the historic identity already belongs to
  // a different verified Player. Refusal must not grant the new Player anything.
  await handle.db.prepare("INSERT INTO player_accounts(id,email_normalized,password_verifier,status,email_verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
   .bind('existing-player','other-player@example.invalid','synthetic','active',now,now,now).run();
  await handle.db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
   .bind('existing-player',legacy.id,now).run();
  await assert.rejects(rehearseLocalOperatorGrant(handle.db,identity,now),/rehearsal_link_conflict/);
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM account_permissions').first<{n:number}>())?.n,0);
  await handle.db.prepare('DELETE FROM player_admin_operator_links WHERE player_account_id=?').bind('existing-player').run();
  assert.deepEqual(await rehearseLocalOperatorGrant(handle.db,identity,now),{ready:true});
  assert.deepEqual(await rehearseLocalOperatorGrant(handle.db,identity,now),{ready:true});
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM account_permissions').first<{n:number}>())?.n,3);
  assert.deepEqual(await auditOperatorCutover(handle.db,email),{ready:true,findings:[]});
  const token=await digestOpaqueToken(createOpaqueToken());
  await handle.db.prepare("INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)")
   .bind(token,'rehearsal-player',1,'a'.repeat(64),now,now,now+3600).run();
  await rehearseLocalOperatorRevoke(handle.db,'rehearsal-player');
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM player_sessions').first<{n:number}>())?.n,0);
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM account_permissions').first<{n:number}>())?.n,0);
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM admin_accounts').first<{n:number}>())?.n,1);
  assert.deepEqual((await auditOperatorCutover(handle.db,email)).findings,['operator_link_missing','missing_access','missing_read','missing_write']);
  assert.deepEqual(await handle.db.prepare('SELECT generation,revision FROM world_state').first(),worldBefore);
 }finally{await handle.close();await rm(dir,{recursive:true,force:true})}
});

test('#791 DEV operator requires explicit exact scope, action confirmation and no caller cursor',async()=>{
 const {parseDevOperatorRequest,readDevOperatorSchema}=await import('../src/dev-operator.ts');
 const generation='00000000-0000-4000-8000-000000000001';
 const request={action:'settle',expectedGeneration:generation,expectedSeason:1,expectedDay:28,confirmation:'DEV settle '+generation+' 1:28',data:{}};
 assert.equal(parseDevOperatorRequest(request).action,'settle');
 for(const altered of [{...request,confirmation:''},{...request,expectedDay:56},{...request,data:{cursor:'1'}},{...request,action:'reset'},{...request,expectedSeason:'1'}])assert.throws(()=>parseDevOperatorRequest(altered));
 const dir=await mkdtemp(join(tmpdir(),'fa-dev-operator-schema-'));
 let h:Awaited<ReturnType<typeof openLocalDatabase>>|undefined;
 try{
  h=await openLocalDatabase(dir);
  const before=await h.db.prepare('SELECT * FROM world_state').first();
  const schema=await readDevOperatorSchema(h.db);
  assert.equal(schema.ready,schema.missingMigrations.length===0&&schema.missingObjects.length===0);
  assert.deepEqual(await h.db.prepare('SELECT * FROM world_state').first(),before);
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM generated_players').first())!.n,0);
 }finally{await h?.close();await rm(dir,{recursive:true,force:true})}
});

test('#791 shared DEV Worker gates real authenticated HTTP requests on isolated D1',async()=>{
 const {default:sharedWorker}=await import('../src/shared-dev-worker.ts');
 const {default:ordinaryWorker}=await import('../src/index.ts');
 const {seedUnifiedOperator}=await import('./fixtures/unified-operator.ts');
 const dir=await mkdtemp(join(tmpdir(),'fa-dev-operator-http-'));
 let h:Awaited<ReturnType<typeof openLocalDatabase>>|undefined;
 try{
  h=await openLocalDatabase(dir);
  const db=h.db,now=Math.floor(Date.now()/1000),token='f'.repeat(64);
  const operator=await seedUnifiedOperator(db,'dev-http-fixture','dev-http@example.invalid',now,token);
  const origin='http://app.localhost:2000',url=origin+'/api/admin/dev-operator';
  const env={DB:db,PLAYER_MODE:'local',PLAYER_ORIGIN:origin,DEV_OPERATOR_ENABLED:'true',DEV_OPERATOR_SOURCE:'a'.repeat(40)};
  const headers={Cookie:operator.cookie,Origin:origin};
  assert.equal((await ordinaryWorker.fetch(new Request(url,{headers}),env)).status,404);
  assert.equal((await sharedWorker.fetch(new Request(url,{headers}),{...env,DEV_OPERATOR_ENABLED:'false'})).status,404);
  assert.equal((await sharedWorker.fetch(new Request(url,{headers}),env)).status,503);
  await db.prepare("INSERT INTO account_environment_pool(id,pool,initialized_at) VALUES(1,'dev-preview',?)").bind(now).run();
  assert.equal((await sharedWorker.fetch(new Request(url),env)).status,401);
  assert.notEqual((await sharedWorker.fetch(new Request(url,{headers}),env)).status,200);
  await db.prepare('INSERT INTO economic_finance_permissions VALUES(?,?,?,?)').bind(operator.playerId,'read','fixture',now).run();
  const response=await sharedWorker.fetch(new Request(url,{headers}),env);
  assert.equal(response.status,200,await response.clone().text());
  const status=await response.json() as any;
  assert.equal(status.schema.ready,true);assert.equal(status.pool,'dev-preview');assert.equal(status.source,env.DEV_OPERATOR_SOURCE);
  assert.equal(status.counts.generated_players,0);
  const body=JSON.stringify({action:'settle',expectedGeneration:status.world.generation,expectedSeason:0,expectedDay:0,confirmation:'DEV settle '+status.world.generation+' 0:0',data:{}});
  assert.equal((await sharedWorker.fetch(new Request(url,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body}),env)).status,403);
  const rejected=await sharedWorker.fetch(new Request(url,{method:'POST',headers:{...headers,'Content-Type':'application/json','X-CSRF-Token':operator.csrf},body}),env);
  assert.equal(rejected.status,409);
  // Registry drift alone must prevent all writes; never auto-apply a migration.
  await db.prepare("DELETE FROM d1_migrations WHERE name='0046_player_lifecycle_season_two.sql'").run();
  const missing=await sharedWorker.fetch(new Request(url,{method:'POST',headers:{...headers,'Content-Type':'application/json','X-CSRF-Token':operator.csrf},body}),env);
  assert.equal(missing.status,409);
  assert.equal((await missing.json() as any).error.code,'dev_operator_schema_not_ready');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM economic_transactions').first())!.n,0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first())!.n,0);
 }finally{await h?.close();await rm(dir,{recursive:true,force:true})}
});

test('#791 actual PowerShell client pins four paydays, confirmation and resume bound without a network binding',t=>{
 const {spawnSync}=requireChildProcessForPowerShellTest;
 const scriptPath=new URL('../../tools/dev-operator.ps1',import.meta.url);
 const command=String.raw`
$ErrorActionPreference='Stop'
$script:Head=(git rev-parse HEAD).Trim()
$script:Source=$script:Head
$script:Gen='00000000-0000-4000-8000-000000000001'
$script:Season=1
$script:Day=28
$script:Posts=0
$script:Ready=$true
$script:Confirm=$true
$script:Fail=$false
$script:DoneAfter=2
$script:FirstBody=''
function Read-Host([string]$Prompt){
 if(-not $script:Confirm){return 'wrong confirmation'}
 return $Prompt.Substring('Type exactly: '.Length)
}
function Invoke-RestMethod {
 param([string]$Uri,[string]$Method='Get',[string]$ContentType,[hashtable]$Headers,[string]$Body,$WebSession,$MaximumRedirection,$TimeoutSec)
 if($Uri -ceq 'http://app.localhost:2000/api/admin/session'){return @{csrfToken='synthetic-csrf'}}
 if($Uri -cne 'http://app.localhost:2000/api/admin/dev-operator'){throw 'unexpected target'}
 if($Headers['Origin'] -cne 'http://app.localhost:2000' -or $Headers['X-CSRF-Token'] -cne 'synthetic-csrf' -or $MaximumRedirection -ne 0){throw 'unexpected headers'}
 if($Method -ne 'Post'){
  return @{pool='dev-preview';database='football-architect-dev';source=$script:Source;schema=@{ready=$script:Ready};foreignKeyViolations=0;world=@{generation=$script:Gen;seasonNumber=$script:Season;day=$script:Day}}
 }
 $script:Posts++
 $request=$Body|ConvertFrom-Json
 $expected="DEV settle $($script:Gen) $($script:Season):$($script:Day)"
 if($request.action -cne 'settle' -or $request.expectedGeneration -cne $script:Gen -or $request.expectedSeason -ne $script:Season -or $request.expectedDay -ne $script:Day -or $request.confirmation -cne $expected){throw 'wrong scope'}
 if($script:Posts -eq 1){$script:FirstBody=$Body}
 elseif($Body -cne $script:FirstBody){throw 'retry changed approved request'}
 if($script:Fail){throw 'simulated lost response'}
 return @{done=($script:Posts -ge $script:DoneAfter);stage='payroll'}
}
function Check([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}
$session=New-Object Microsoft.PowerShell.Commands.WebRequestSession
$path=$env:FA_TEST_OPERATOR_SCRIPT
& $path -Action status -Session $session -ApprovedCommit $script:Head | Out-Null
Check ($script:Posts -eq 0) 'status wrote'
foreach($season in @(1,2)){foreach($day in @(28,56)){
 $script:Season=$season;$script:Day=$day;$script:Posts=0
 & $path -Action settle -Session $session -ApprovedCommit $script:Head -MaxRequests 2 | Out-Null
 Check ($script:Posts -eq 2) 'four payday loop did not finish'
}}
foreach($block in @('schema','source','confirmation','transport')){
 $script:Ready=$true;$script:Source=$script:Head;$script:Confirm=$true;$script:Fail=$false;$script:Posts=0
 switch($block){
  schema{$script:Ready=$false}
  source{$script:Source='a'*40}
  confirmation{$script:Confirm=$false}
  transport{$script:Fail=$true}
 }
 $rejected=$false
 try{& $path -Action settle -Session $session -ApprovedCommit $script:Head -MaxRequests 2 | Out-Null}catch{$rejected=$true}
 Check $rejected "failure not propagated: $block"
 Check ($script:Posts -eq $(if($block -eq 'transport'){1}else{0})) "unexpected mutation/retry: $block"
}
$script:Ready=$true;$script:Source=$script:Head;$script:Confirm=$true;$script:Fail=$false;$script:Posts=0;$script:DoneAfter=9
& $path -Action settle -Session $session -ApprovedCommit $script:Head -MaxRequests 2 | Out-Null
Check ($script:Posts -eq 2) 'request limit ignored'
Write-Output 'PowerShell client contract PASS'
`;
 const result=spawnSync('pwsh',['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{
  cwd:new URL('../../',import.meta.url),env:{...process.env,FA_TEST_OPERATOR_SCRIPT:fileURLToPathForPowerShellTest(scriptPath)},encoding:'utf8',timeout:30000
 });
 if((result.error as NodeJS.ErrnoException|undefined)?.code==='ENOENT'&&!process.env.CI){t.skip('PowerShell 7 not installed on this local machine');return}
 assert.equal(result.status,0,result.error?.message+'\n'+result.stdout+'\n'+result.stderr);
 assert.match(result.stdout,/PowerShell client contract PASS/);
});
