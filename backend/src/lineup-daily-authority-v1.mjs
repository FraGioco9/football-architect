/** #613 — isolated season-pinned candidate cutover preflight.
 * Returns guarded SQL statements; NEVER calls db.batch() or modifies world state.
 * A future authorized season-preparation command must add these to its own
 * authenticated transaction. This is NOT a season/day command.
 */
const VERSION='temporary-lineup-v1';
const FAIL='00000000-0000-4000-8000-000000000000';
const error=(message)=>{throw new TypeError('Invalid daily lineup authority: '+message)};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const guard=(db,condition,params)=>db.prepare(
 'INSERT INTO world_state(id,generation) SELECT 2,? WHERE NOT EXISTS('+condition+')'
).bind(FAIL,...params);
function worldCheck(world){
 if(!world||!uuid.test(world.generation)||!Number.isSafeInteger(world.revision)||world.revision<0||
  !Number.isSafeInteger(world.seasonNumber)||world.seasonNumber<1||
  !Number.isSafeInteger(world.day)||world.day<0||world.day>56||
  !['preparing','active','closed'].includes(world.phase))error('world');
}
function same(a,b){
 return !!a&&a.generation===b.generation&&a.revision===b.revision&&
  a.seasonNumber===b.seasonNumber&&a.phase===b.phase&&a.day===b.day;
}
async function worldRead(db){
 return db.prepare('SELECT generation,revision,season_number AS seasonNumber,day,phase FROM world_state WHERE id=1').first();
}
const countSql='SELECT COUNT(*) AS n FROM season_day_outcomes WHERE season_number=?';
const pinSql='SELECT generation,season_number,simulation_version,pinned_at FROM season_result_authorities WHERE generation=? AND season_number=?';

/** Stages a season pin only when PREPARING, before any game/receipt. */
export async function planLineupSeasonAuthorityPinV1(db,world,now){
 worldCheck(world);
 if(world.phase!=='preparing'||world.day!==0||!Number.isSafeInteger(now)||now<=0)
  error('pinning requires a fresh preparing season');
 const before=await worldRead(db);
 if(!same(before,world))error('stale world');
 const [snapshot,days,oldPin,receipts]=await Promise.all([
  db.prepare('SELECT generation FROM seasons WHERE season_number=?').bind(world.seasonNumber).first(),
  db.prepare(countSql).bind(world.seasonNumber).first(),
  db.prepare(pinSql).bind(world.generation,world.seasonNumber).first(),
  db.prepare('SELECT COUNT(*) AS n FROM match_lineup_result_receipts WHERE generation=? AND season_number=?')
   .bind(world.generation,world.seasonNumber).first()
 ]);
 if(!snapshot||snapshot.generation!==world.generation||!Number.isSafeInteger(days?.n)||
  days.n!==0||oldPin||!Number.isSafeInteger(receipts?.n)||receipts.n!==0)
  error('season is not pristine');
 if(!same(await worldRead(db),world))error('world changed');
 const guards=[
  guard(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=? AND phase=? AND day=0',
   [world.generation,world.revision,world.seasonNumber,'preparing']),
  guard(db,'SELECT 1 FROM seasons WHERE generation=? AND season_number=?',
   [world.generation,world.seasonNumber]),
  guard(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM season_day_outcomes WHERE season_number=?)=0',
   [world.seasonNumber]),
  guard(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM match_lineup_result_receipts WHERE generation=? AND season_number=?)=0',
   [world.generation,world.seasonNumber]),
  guard(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM season_result_authorities WHERE generation=? AND season_number=?)',
   [world.generation,world.seasonNumber])
 ];
 return {kind:'pin-proposal',simulationVersion:VERSION,guards,
  writes:[db.prepare('INSERT INTO season_result_authorities(generation,season_number,simulation_version,pinned_at) VALUES(?,?,?,?)')
   .bind(world.generation,world.seasonNumber,VERSION,now)]};
}

/** Readiness is necessary but NOT sufficient for official cutover:
 * provider, progression replay, archived reads and versioned day schema
 * must all be reviewed independently. Never treat this as permission to write.
 */
export async function inspectLineupDayReadinessV1(db,world){
 worldCheck(world);
 if(world.phase!=='active'||world.day>=56)return {ready:false,reason:'not-an-advanceable-day'};
 if(!same(await worldRead(db),world))error('stale world');
 const [pin,rows]=await Promise.all([
  db.prepare(pinSql).bind(world.generation,world.seasonNumber).first(),
  db.prepare('SELECT generation,day,simulation_version FROM season_day_outcomes WHERE season_number=? ORDER BY day')
   .bind(world.seasonNumber).all()
 ]);
 if(!Array.isArray(rows?.results))error('missing daily evidence');
 if(!same(await worldRead(db),world))error('world changed');
 if(!pin||pin.generation!==world.generation||pin.season_number!==world.seasonNumber||
  pin.simulation_version!==VERSION||!Number.isSafeInteger(pin.pinned_at)||pin.pinned_at<=0)
  return {ready:false,reason:'unversioned-or-legacy-season'};
 const records=rows.results;
 if(records.length!==world.day||records.some((r,i)=>
  r.generation!==world.generation||r.day!==i+1||r.simulation_version!==VERSION))
  return {ready:false,reason:'missing-mixed-or-future-evidence'};
 return {ready:true,kind:'lineup-daily-preflight',simulationVersion:VERSION,
  nextDay:world.day+1,priorDays:records.length,worldGeneration:world.generation};
}
