import {beforeAll,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import type {Database} from '../src/database.ts';
import {economicAssert,provisionClubAccounts} from '../src/economic-ledger.ts';
import {parseResetScopes,previewAdminReset,readAdminEconomySummary,readAdminEconomyReconciliation,parseEconomyPage,readAdminEconomyClubs,readAdminEconomyLedger} from '../src/admin-inspection.ts';
const binding=env as any,db=binding.DB as Database;
const access=()=>[economicAssert(db,'SELECT 1')]; // trusted isolated fixture only
beforeAll(async()=>{await applyD1Migrations(db,binding.TEST_MIGRATIONS)});
it('validates exact reset scope and never executes a reset',async()=>{
 expect(parseResetScopes({scopes:['economy','sporting']})).toEqual(['sporting','economy']);
 for(const input of [{scopes:[]},{scopes:['sporting','sporting']},{scopes:['unknown']},{scopes:['sporting'],execute:true}])expect(()=>parseResetScopes(input)).toThrow();
 const before=await db.prepare('SELECT * FROM world_state').first();
 const preview=await previewAdminReset(db,access(),['sporting','players','contracts','economy']);
 expect(preview.executable).toBe(false);
 // #777: this inventory is contract-only even before 0041 is applied.
 // The same test runs on the full migration set after synchronization with #800.
 expect(preview.counts).not.toHaveProperty('player_club_affiliations');
 expect(preview.counts).toMatchObject({generated_players:0,player_signed_contracts:0,player_agent_mandates:0});
 expect(preview.blockers).toContain('preview_only');
 expect(preview.blockers).toContain('economic_history_protected');
 expect(await db.prepare('SELECT * FROM world_state').first()).toEqual(before);
 await expect(previewAdminReset(db,[],['sporting'])).rejects.toMatchObject({status:403});
});
it('distinguishes missing accounts from provisioned zero and never activates finance',async()=>{
 const empty=await readAdminEconomySummary(db,access());
 expect(empty.status).toBe('uninitialized');
 expect(empty.genesis).toMatchObject({status:'uninitialized',fundedClubs:null,issuedArc:null});
 expect(empty.rewards.rows).toHaveLength(4);
 expect(empty.rewards.rows.every(x=>x.creditedArc===null&&x.status==='uninitialized')).toBe(true);
 expect(empty.rewards.rows.reduce((sum,x)=>sum+Number(x.forecastArc),0)).toBe(4800000);
 expect(empty.payroll.rows.every(x=>x.earnedArc===null&&x.paidArc===null&&x.arrearsArc===null)).toBe(true);
 expect(empty.accounts.find(a=>a.kind==='CLUB_TREASURY')?.balanceArc).toBeNull();
 await provisionClubAccounts(db,1770000000,access());
 const provisioned=await readAdminEconomySummary(db,access());
 expect(provisioned.accounts.find(a=>a.kind==='CLUB_TREASURY')).toMatchObject({count:320,balanceArc:'0'});
 expect(provisioned.status).toBe('uninitialized');
 expect((await readAdminEconomyReconciliation(db,access())).status).toBe('uninitialized');
 expect(await db.prepare('SELECT * FROM economic_control').first()).toBeNull();
 await expect(readAdminEconomySummary(db,[])).rejects.toMatchObject({status:403});
});
it('reports the real 0039 generation blocker even when posting is frozen',async()=>{
 await db.prepare('INSERT INTO economic_policy_versions VALUES(?,?,?,?,?,?,?)').bind('synthetic-inspection',1770000000,'fixture',2400000,3000000,'{}','{}').run();
 await db.prepare('INSERT INTO economic_control VALUES(1,?,0)').bind('synthetic-inspection').run();
 const before=await db.prepare('SELECT * FROM economic_control').first();
 expect((await previewAdminReset(db,access(),['sporting'])).blockers).toContain('economic_generation_guard');
 const summary=await readAdminEconomySummary(db,access());
 expect(summary.status).toBe('frozen');
 expect(summary.genesis.status).toBe('unavailable');
 expect(summary.rewards.rows.every(x=>x.creditedArc===null)).toBe(true);
 await readAdminEconomyReconciliation(db,access());
 expect(await db.prepare('SELECT * FROM economic_control').first()).toEqual(before);
});

it('paginates the canonical club catalogue and redacted ledger, rejects unsafe or stale pagination',async()=>{
 const first=await readAdminEconomyClubs(db,access(),parseEconomyPage(new URLSearchParams(),'clubs'));
 expect(first.rows).toHaveLength(50);expect(first.pages).toBe(7);
 const last=await readAdminEconomyClubs(db,access(),parseEconomyPage(new URLSearchParams({page:'7',checkpoint:first.checkpoint}),'clubs'));
 expect(last.rows).toHaveLength(20);
 expect(()=>parseEconomyPage(new URLSearchParams({page:'2'}),'clubs')).toThrow();
 await expect(readAdminEconomyClubs(db,access(),parseEconomyPage(new URLSearchParams({page:'2',checkpoint:'0'.repeat(64)}),'clubs'))).rejects.toMatchObject({status:409});
 const ledger=await readAdminEconomyLedger(db,access(),parseEconomyPage(new URLSearchParams(),'ledger'));
 expect(ledger.rows).toEqual([]);expect(ledger.nextCursor).toBeNull();
});
