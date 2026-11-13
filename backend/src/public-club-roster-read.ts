/** #541: current affiliations only, one anonymous, complete read. Never a sporting-season squad. */
import clubs from '../../data/clubs.json' with {type:'json'};
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {projectPublicFootballerDirectoryRecord,type InternalFootballer} from './footballer-public-projection.ts';

const clubKeys=new Set(clubs.map(club=>club.countryId+'-'+club.clubId));
if(clubKeys.size!==320)throw Error('Invalid canonical club catalogue');
interface RosterRow {id:number;payload_json:string}
interface StoredPlayer extends InternalFootballer {age?:number}

/** No LIMIT, OFFSET or generation filter. The returned count is always players.length. */
export async function readPublicClubRoster(db:Database,clubKey:string){
 if(!clubKeys.has(clubKey))throw new ApiError(404,'club_not_found');
 const before=await readWorld(db);
 const rows=(await db.prepare(`SELECT p.id,p.payload_json FROM player_club_affiliations a
  INNER JOIN generated_players p ON p.id=a.player_id
  WHERE a.club_key=? ORDER BY p.id ASC`).bind(clubKey).all<RosterRow>()).results;
 const after=await readWorld(db);
 if(before.generation!==after.generation||before.revision!==after.revision)
  throw new ApiError(409,'stale_world');
 const players=rows.map(row=>{
  const stored=JSON.parse(row.payload_json) as StoredPlayer;
  return projectPublicFootballerDirectoryRecord(stored,{publicId:row.id,currentAge:stored.age});
 });
 return {clubKey,count:players.length,players};
}
