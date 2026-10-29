import {clearTestWorld} from './fixtures/test-world.ts';
import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {executeLifecycle} from '../src/lifecycle-command.ts';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {readWorld} from '../src/world-repository.ts';
import {csrfFor,type AdminSession} from '../src/auth.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
import {handleAdmin} from '../src/http-admin.ts';
import type {Database} from '../src/database.ts';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000),token='b'.repeat(64);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>,csrfToken:string;
const command=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
const run=(action:'start'|'advance',key='lifecycle-synthetic-0001',cmd=command(),database:Database=db)=>executeLifecycle(database,session,action,cmd,key,now);
const step=async()=>{const r=await run('advance','advance-day-'+(world.day+1)+'-synthetic');world=r.world;return r};
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await clearTestWorld(db);
 csrfToken=await csrfFor(token);session={actor:{id:'simulation-operator',email:'simulation@example.invalid'},digest:await digestOpaqueToken(token),credentialVersion:1,csrfDigest:await digestOpaqueToken(csrfToken)};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic-not-login',now-100).run();
 await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(session.digest,session.actor.id,1,session.csrfDigest,now-100,now-10,now+1000).run();
 world=await readWorld(db);world=(await prepareSeason(db,session,command(),'simulation-prepare-0001',await loadApprovedSnapshot(),now)).world;
 world=(await generateSeasonCalendar(db,session,command(),'simulation-calendar-0001',now)).world;
});
it('starts only from server-validated calendar/draws; processes each destination day once with stable finalized scores',async()=>{
 world=(await run('start')).world;expect(world).toMatchObject({day:1,phase:'active',revision:3});
 while(world.day<16)await step();
 const rows=(await db.prepare('SELECT * FROM season_day_outcomes ORDER BY day').all()).results;expect(rows).toHaveLength(16);
 for(const row of rows){const outcome=JSON.parse(row.outcome_json);expect(await canonicalHash(outcome)).toBe(row.outcome_hash);expect(outcome.generation).toBe(world.generation);expect(outcome.results).toHaveLength(row.day<13?0:[13,14,15].includes(row.day)?128:152);}
 const saved=JSON.parse(rows[15].outcome_json);expect(saved.results.slice(0,24).every((r:any)=>r.fixtureId.includes(':int-'))).toBe(true);
 expect(saved.results.every((r:any)=>r.algorithmVersion==='temporary-score-v1'&&r.provenance==='temporary-simulation')).toBe(true);
 await expect(db.prepare("UPDATE season_day_outcomes SET outcome_json='{}'").run()).rejects.toThrow();
 expect((await readWorld(db)).day).toBe(16);
},30000);
it('identical start/advance requests replay, competing keys have exactly one winner, and cross-command keys conflict',async()=>{
 const start=await Promise.all([run('start'),run('start')]);expect(start[1]).toEqual(start[0]);
 await expect(run('advance')).rejects.toMatchObject({status:409,code:'idempotency_conflict'});
 world=start[0].world;
 const advances=await Promise.allSettled([run('advance','competing-advance-0001'),run('advance','competing-advance-0002')]);
 expect(advances.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(advances.filter(r=>r.status==='rejected').map((r:any)=>r.reason.status)).toEqual([409]);
 const winner=advances.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>,key=advances[0].status==='fulfilled'?'competing-advance-0001':'competing-advance-0002';
 expect(await run('advance',key)).toEqual(winner.value);expect((await db.prepare('SELECT count(*) n FROM season_day_outcomes').first()).n).toBe(2);
});
it('rolls back scores and day if the final audit fails, and rechecks revocation inside the commit',async()=>{
 world=(await run('start')).world;while(world.day<12)await step();
 await db.prepare("CREATE TRIGGER simulate_late_failure BEFORE INSERT ON admin_operations WHEN NEW.command='advance-season-v1' BEGIN SELECT RAISE(ABORT,'synthetic late failure'); END").run();
 try{await expect(step()).rejects.toMatchObject({status:503})}finally{await db.prepare('DROP TRIGGER simulate_late_failure').run()}
 expect(await readWorld(db)).toEqual(world);expect(await db.prepare('SELECT day FROM season_day_outcomes WHERE day=13').first()).toBeNull();
 const raced:Database={prepare:db.prepare.bind(db),async batch(statements){if(statements.length>1)await db.prepare('UPDATE admin_accounts SET credential_version=2').run();return db.batch(statements)}};
 await expect(run('advance','revoked-advance-0001',command(),raced)).rejects.toMatchObject({status:401});expect(await readWorld(db)).toEqual(world);
},30000);
it('rejects missing calendars/draws, corrupt immutable snapshots with correct hashes, and absent/forged receipts',async()=>{
 const calendar=await db.prepare('SELECT * FROM season_calendars').first();
 await db.prepare('DELETE FROM season_calendars').run();await expect(run('start')).rejects.toMatchObject({status:422});
 await db.prepare('INSERT INTO season_calendars VALUES(?,?,?,?,?,?)').bind(...Object.values(calendar)).run();
 await db.prepare('DROP TRIGGER season_snapshot_immutable').run();
 await db.prepare("UPDATE seasons SET snapshot_json='{}'").run();await expect(run('start')).rejects.toMatchObject({status:422});
 await db.prepare('UPDATE seasons SET snapshot_json=?').bind(JSON.stringify(await loadApprovedSnapshot())).run();
 await db.prepare("CREATE TRIGGER season_snapshot_immutable BEFORE UPDATE OF generation,participants_hash,rules_hash,snapshot_json ON seasons BEGIN SELECT RAISE(ABORT,'season snapshot is immutable'); END").run();
 world=(await run('start')).world;
 await db.prepare('DELETE FROM season_day_outcomes').run();await expect(step()).rejects.toMatchObject({status:422});
 expect(await readWorld(db)).toEqual(world);
});
it('atomically generates knockout ties,handles phase-day contention/rollback,and completes56days with4082 final scores',async()=>{
 world=(await run('start')).world;while(world.day<35)await step();
 const old=await db.prepare('SELECT outcome_json FROM season_day_outcomes WHERE day=35').first();
 const results=await Promise.allSettled([run('advance','phase-day36-competing-01'),run('advance','phase-day36-competing-02')]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected').map((r:any)=>r.reason.status)).toEqual([409]);
 world=(results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value.world;
 expect((await db.prepare('SELECT count(*) n FROM season_knockout_ties').first()).n).toBe(8);
 while(world.day<40)await step();
 await db.prepare("CREATE TRIGGER knockout_late_failure BEFORE INSERT ON admin_operations WHEN NEW.command='advance-season-v1' BEGIN SELECT RAISE(ABORT,'synthetic late failure'); END").run();
 try{await expect(step()).rejects.toMatchObject({status:503})}finally{await db.prepare('DROP TRIGGER knockout_late_failure').run()}
 expect((await readWorld(db)).day).toBe(40);expect((await db.prepare('SELECT count(*) n FROM season_knockout_ties').first()).n).toBe(8);expect(await db.prepare('SELECT day FROM season_day_outcomes WHERE day=41').first()).toBeNull();
 while(world.day<56)await step();
 expect((await readWorld(db)).day).toBe(56);expect((await db.prepare('SELECT count(*) n FROM season_knockout_ties').first()).n).toBe(54);
 const receipts=(await db.prepare('SELECT * FROM season_day_outcomes ORDER BY day').all()).results;
 expect(receipts).toHaveLength(56);expect(receipts.reduce((n:number,r:any)=>n+JSON.parse(r.outcome_json).results.length,0)).toBe(4082);
 expect(JSON.parse(receipts[52].outcome_json).results).toHaveLength(25);expect(JSON.parse(receipts[53].outcome_json).results).toHaveLength(9);
 expect((await db.prepare('SELECT outcome_json FROM season_day_outcomes WHERE day=35').first()).outcome_json).toBe(old.outcome_json);
 for(const r of (await db.prepare('SELECT * FROM season_knockout_ties').all()).results)expect(await canonicalHash(JSON.parse(r.plan_json))).toBe(r.plan_hash);
 await expect(db.prepare("UPDATE season_knockout_ties SET plan_json='{}'").run()).rejects.toThrow();
 await expect(step()).rejects.toMatchObject({status:409});
},120000);
it('HTTP enforces auth, Origin, CSRF and server-owned input for start and advance',async()=>{
 const config={DB:db,ADMIN_MODE:'local',ADMIN_ORIGIN:'http://localhost:2000'};
 const req=(action:string,headers:Record<string,string>={},body:unknown=command())=>new Request('http://localhost:2000/api/admin/seasons/'+action,{method:'POST',headers:{'Content-Type':'application/json',Origin:config.ADMIN_ORIGIN,Cookie:'fa_admin_local='+token,'X-CSRF-Token':csrfToken,'Idempotency-Key':'http-'+action+'-synthetic-0001',...headers},body:JSON.stringify(body)});
 for(const headers of [{Cookie:''},{Origin:'https://evil.example'},{'X-CSRF-Token':''}] as Record<string,string>[])expect((await handleAdmin(req('start',headers),config)).status).toBeGreaterThanOrEqual(400);
 expect((await handleAdmin(req('start',{}, {...command(),results:[]}),config)).status).toBe(422);
 const started=await handleAdmin(req('start'),config);expect(started.status).toBe(200);world=(await started.json() as any).world;
 expect((await handleAdmin(req('advance'),config)).status).toBe(200);
});

it('rejects self-rehashed corrupt calendars/draws and changed scores, with no world mutation',async()=>{
 const calendar=await db.prepare('SELECT * FROM season_calendars').first();
 const bad=JSON.parse(calendar.calendar_json);bad.fixtures[0].day=1;
 await db.prepare('DELETE FROM season_calendars').run();
 await db.prepare('INSERT INTO season_calendars VALUES(?,?,?,?,?,?)').bind(1,calendar.calendar_version,await canonicalHash(bad),JSON.stringify(bad),'validated',now).run();
 await expect(run('start')).rejects.toMatchObject({status:422});
 await db.prepare('DELETE FROM season_calendars').run();await db.prepare('INSERT INTO season_calendars VALUES(?,?,?,?,?,?)').bind(...Object.values(calendar)).run();
 const draw=await db.prepare("SELECT * FROM season_draws WHERE competition_id='int-1'").first();
 const corrupt=JSON.parse(draw.outcome_json);corrupt.fixtures.pop();
 await db.prepare("DELETE FROM season_draws WHERE competition_id='int-1'").run();
 await db.prepare('INSERT INTO season_draws VALUES(?,?,?,?,?,?,?,?,?)').bind(1,draw.competition_id,draw.stage_id,draw.algorithm_version,draw.seed,await canonicalHash(corrupt),JSON.stringify(corrupt),'validated',now).run();
 await expect(run('start')).rejects.toMatchObject({status:422});
 await db.prepare("DELETE FROM season_draws WHERE competition_id='int-1'").run();await db.prepare('INSERT INTO season_draws VALUES(?,?,?,?,?,?,?,?,?)').bind(...Object.values(draw)).run();
 world=(await run('start')).world;while(world.day<13)await step();
 const receipt=await db.prepare('SELECT * FROM season_day_outcomes WHERE day=13').first(),payload=JSON.parse(receipt.outcome_json);payload.results[0].homeGoals++;
 await db.prepare('DELETE FROM season_day_outcomes WHERE day=13').run();
 await db.prepare('INSERT INTO season_day_outcomes VALUES(?,?,?,?,?,?,?,?)').bind(1,receipt.generation,13,receipt.calendar_hash,receipt.simulation_version,await canonicalHash(payload),JSON.stringify(payload),now).run();
 await expect(step()).rejects.toMatchObject({status:422,code:'daily_evidence_invalid'});expect(await readWorld(db)).toEqual(world);
},30000);

it('rolls back an advance if receipt source bindings change between validation and commit',async()=>{
 world=(await run('start')).world;
 const receipt=await db.prepare('SELECT * FROM season_day_outcomes WHERE day=1').first();
 const raced:Database={prepare:db.prepare.bind(db),async batch(statements){
  if(statements.length>1){
   await db.prepare('DELETE FROM season_day_outcomes WHERE day=1').run();
   await db.prepare('INSERT INTO season_day_outcomes VALUES(?,?,?,?,?,?,?,?)').bind(1,receipt.generation,1,'f'.repeat(64),receipt.simulation_version,receipt.outcome_hash,receipt.outcome_json,now).run();
  }
  return db.batch(statements);
 }};
 await expect(run('advance','receipt-race-synthetic-01',command(),raced)).rejects.toMatchObject({status:503});
 expect(await readWorld(db)).toEqual(world);expect(await db.prepare('SELECT day FROM season_day_outcomes WHERE day=2').first()).toBeNull();
 expect(await db.prepare("SELECT id FROM admin_operations WHERE idempotency_key='receipt-race-synthetic-01'").first()).toBeNull();
});

it('rolls back an advance if a persisted knockout plan is replaced during commit',async()=>{
 world=(await run('start')).world;while(world.day<36)await step();
 const plan=await db.prepare('SELECT * FROM season_knockout_ties LIMIT 1').first();
 const raced:Database={prepare:db.prepare.bind(db),async batch(statements){
  if(statements.length>1){
   await db.prepare('DELETE FROM season_knockout_ties WHERE competition_id=? AND phase_id=? AND tie_id=?').bind(plan.competition_id,plan.phase_id,plan.tie_id).run();
   await db.prepare('INSERT INTO season_knockout_ties VALUES(?,?,?,?,?,?,?,?)').bind(1,plan.generation,plan.competition_id,plan.phase_id,plan.tie_id,'f'.repeat(64),plan.plan_json,now).run();
  }return db.batch(statements);
 }};
 await expect(run('advance','knockout-replaced-race-01',command(),raced)).rejects.toMatchObject({status:503});
 expect(await readWorld(db)).toEqual(world);expect(await db.prepare('SELECT day FROM season_day_outcomes WHERE day=37').first()).toBeNull();
 await expect(run('advance','knockout-invalid-stored-01')).rejects.toMatchObject({status:422,code:'knockout_evidence_invalid'});
},60000);
