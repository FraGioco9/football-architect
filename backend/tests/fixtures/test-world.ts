// Disposable test-D1 reset only. Keep immutable production triggers enabled.
import type {Database} from '../../src/database.ts';
const tables=['admin_accounts','admin_sessions','auth_throttles','seasons','season_calendars','season_draws','season_day_outcomes','season_knockout_ties','season_domestic_stages','season_admin_events','season_archives','season_archive_summaries','season_two_approvals','admin_operations'] as const;
export async function clearTestWorld(db:Database){
 await db.batch([
  db.prepare("UPDATE world_state SET generation=?,revision=0,season_number=0,day=0,phase='unstarted' WHERE id=1").bind(crypto.randomUUID()),
  ...[...tables].reverse().map(table=>db.prepare('DELETE FROM '+table)),
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
