// Disposable test-D1 reset only. Keep immutable production triggers enabled.
import type {Database} from '../../src/database.ts';
const tables=['player_accounts','player_generation_drafts','generated_players','player_portrait_profiles','player_club_affiliations','account_permissions','player_sessions','admin_accounts','admin_sessions','auth_throttles','seasons','season_calendars','season_draws','season_day_outcomes','season_knockout_ties','season_domestic_stages','season_admin_events','season_archives','season_archive_summaries','season_two_approvals','season_zero_approvals','admin_operations','season_match_slots','season_knockout_match_slots','season_lineup_day_outcomes','match_lineup_result_receipts'] as const;
export async function clearTestWorld(db:Database){
 await db.batch([
  // Disposable test-D1 only. Never disable the production V2 immutability
  // triggers: authorize the old generations within this single cleanup batch.
  db.prepare(`INSERT OR IGNORE INTO world_reset_permits(generation,operation_id)
   SELECT generation,? FROM match_lineup_result_receipts
   UNION SELECT generation,? FROM season_lineup_day_outcomes`)
   .bind(crypto.randomUUID(),crypto.randomUUID()),
  db.prepare('INSERT OR IGNORE INTO world_reset_permits(generation,operation_id) SELECT generation,? FROM world_state WHERE id=1').bind(crypto.randomUUID()),
  db.prepare('DELETE FROM match_lineup_result_receipts'),
  db.prepare('DELETE FROM season_lineup_day_outcomes'),
  db.prepare("UPDATE world_state SET generation=?,revision=0,season_number=0,day=0,phase='unstarted' WHERE id=1").bind(crypto.randomUUID()),
  db.prepare('DELETE FROM season_zero_approvals'),
  db.prepare('DELETE FROM public_match_numbers'),
  db.prepare("DELETE FROM sqlite_sequence WHERE name='public_match_numbers'"),
  db.prepare('DELETE FROM world_reset_permits'),
  // The unified Player-to-legacy-operator bridge references admin_accounts.
  // Clear links before deleting their historical operator rows in disposable test D1.
  db.prepare('DELETE FROM player_admin_operator_links'),
  ...[...tables].reverse().filter(table=>!['match_lineup_result_receipts','season_lineup_day_outcomes'].includes(table)).map(table=>db.prepare('DELETE FROM '+table)),
 ]);
}
export async function captureTestWorld(db:Database){
 const world=await db.prepare('SELECT * FROM world_state WHERE id=1').first();
 if(!world)throw Error('Missing test world');
 const rows=[];
 for(const table of tables)rows.push({table,values:(await db.prepare('SELECT * FROM '+table).all()).results});
 return {world,rows};
}
export async function restoreTestWorld(db:Database,snapshot:Awaited<ReturnType<typeof captureTestWorld>>){
 await clearTestWorld(db);
 const statements=snapshot.rows.flatMap(({table,values})=>values.map(row=>{
  const columns=Object.keys(row);
  return db.prepare('INSERT INTO '+table+' ('+columns.map(key=>'"'+key+'"').join(',')+') VALUES ('+columns.map(()=>'?').join(',')+')').bind(...columns.map(key=>row[key]));
 }));
 const columns=Object.keys(snapshot.world).filter(key=>key!=='id');
 statements.push(db.prepare('UPDATE world_state SET '+columns.map(key=>'"'+key+'"=?').join(',')+' WHERE id=1').bind(...columns.map(key=>snapshot.world[key])));
 await db.batch(statements);
}
