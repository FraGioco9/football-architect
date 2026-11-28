/** #541: current signed contracts only, one anonymous, complete read. Never a sporting-season squad. */
import clubs from '../../data/clubs.json' with {type:'json'};
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {assertOpeningPublished} from './opening-world-publication.ts';
import {CURRENT_PLAYER_CONTRACTS_SQL} from './effective-player-contracts.mjs';
import {PUBLIC_EFFECTIVE_SALARY_SQL,PUBLIC_EFFECTIVE_END_SQL,publicRosterContractFacts} from './public-signed-term-read.ts';
import {projectPublicFootballerDirectoryRecord,type InternalFootballer} from './footballer-public-projection.ts';

const clubKeys=new Set(clubs.map(club=>club.countryId+'-'+club.clubId));
if(clubKeys.size!==320)throw Error('Invalid canonical club catalogue');
interface RosterRow {id:number;payload_json:string}
interface ContractRosterRow extends RosterRow {start_tick:number;end_tick:number;effective_salary_arc:number}
interface StoredPlayer extends InternalFootballer {age?:number}

/** No LIMIT or OFFSET; contract source enforces effective generation/date. The returned count is always players.length. */
export async function readPublicClubRoster(db:Database,clubKey:string){
 if(!clubKeys.has(clubKey))throw new ApiError(404,'club_not_found');
 const before=await readWorld(db);await assertOpeningPublished(db);
 const rows=(await db.prepare(`SELECT p.id,p.payload_json FROM ${CURRENT_PLAYER_CONTRACTS_SQL} a
  INNER JOIN generated_players p ON p.id=a.player_id
  WHERE a.club_key=? ORDER BY p.id ASC`).bind(clubKey).all<RosterRow>()).results;
 await assertOpeningPublished(db);const after=await readWorld(db);
 if(before.generation!==after.generation||before.revision!==after.revision)
  throw new ApiError(409,'stale_world');
 const players=rows.map(row=>{
  const stored=JSON.parse(row.payload_json) as StoredPlayer;
  return projectPublicFootballerDirectoryRecord(stored,{publicId:row.id,currentAge:stored.age});
 });
 return {clubKey,count:players.length,players};
}

/** #823: one anonymous current-roster projection; no payroll, mandate or offer data. */
export async function readPublicClubRosterContracts(db:Database,clubKey:string){
 if(!clubKeys.has(clubKey))throw new ApiError(404,'club_not_found');
 const before=await readWorld(db);await assertOpeningPublished(db);
 const rows=(await db.prepare(`SELECT p.id,p.payload_json,c.start_tick,${PUBLIC_EFFECTIVE_END_SQL} AS end_tick,
  ${PUBLIC_EFFECTIVE_SALARY_SQL} AS effective_salary_arc FROM ${CURRENT_PLAYER_CONTRACTS_SQL} a
  INNER JOIN generated_players p ON p.id=a.player_id
  INNER JOIN player_signed_contracts c ON c.id=a.contract_id
  INNER JOIN world_state w ON w.id=1 AND w.generation=c.world_generation
  WHERE a.club_key=? ORDER BY p.id ASC`).bind(clubKey).all<ContractRosterRow>()).results;
 await assertOpeningPublished(db);const after=await readWorld(db);
 if(before.generation!==after.generation||before.revision!==after.revision)
  throw new ApiError(409,'stale_world');
 const players=rows.map((row,index)=>{
  if(index>0&&row.id<=rows[index-1].id)throw new ApiError(503,'roster_unavailable');
  const stored=JSON.parse(row.payload_json) as StoredPlayer;
  return {...projectPublicFootballerDirectoryRecord(stored,{publicId:row.id,currentAge:stored.age}),
   contract:publicRosterContractFacts(row.start_tick,row.end_tick,row.effective_salary_arc)};
 });
 return {clubKey,count:players.length,players};
}
