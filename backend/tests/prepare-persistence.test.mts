import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openLocalDatabase} from '../tools/operator-local.mts';
import {prepareSeason} from '../src/commands.ts';
import {readWorld} from '../src/world-repository.ts';
import * as snapshots from '../src/catalogue-snapshot.ts';
import {syntheticApproval} from './fixtures/synthetic-approval.ts';
test('committed prepare and idempotency outcome survive local D1 close and reopen',async()=>{
 const state=await mkdtemp(join(tmpdir(),'fa-prepare-persist-')),now=Math.floor(Date.now()/1000);
 const session={actor:{id:'fixture',email:'fixture@example.invalid'},digest:'c'.repeat(64),credentialVersion:1,csrfDigest:'d'.repeat(64),unified:{playerId:'fixture-player',sessionDigest:'c'.repeat(64),csrfDigest:'d'.repeat(64)}};
 let handle=await openLocalDatabase(state);
 try{
  await handle.db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now).run();
  await handle.db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('fixture-player',session.actor.email,'synthetic',1,now,'active',now,now).run();
  await handle.db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind('fixture-player',session.actor.id,now).run();
  await handle.db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(session.digest,'fixture-player',1,session.csrfDigest,now,now,now+1000).run();
  await handle.db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>handle.db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('fixture-player',permission,now)));
  const world=await readWorld(handle.db),command={expectedGeneration:world.generation,expectedRevision:0};
  const result=await prepareSeason(handle.db,session,command,'synthetic-persistence-01',await syntheticApproval(snapshots),now);
  await handle.close();handle=await openLocalDatabase(state);
  assert.deepEqual(await readWorld(handle.db),result.world);
  assert.deepEqual(await prepareSeason(handle.db,session,command,'synthetic-persistence-01',await syntheticApproval(snapshots),now),result);
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM admin_operations').first<{n:number}>())!.n,1);
 }finally{await handle.close();await rm(state,{recursive:true,force:true})}
});
