/** Server-owned, published club stadium catalogue for assigning match venues. */
import clubs from '../../data/clubs.json' with {type:'json'};
const stadiums=new Map(clubs.map(club=>[club.countryId+'-'+club.clubId,club.stadiumName] as const));

export function canonicalHomeStadium(clubId:string):string|null {
 const value=stadiums.get(clubId);
 if(typeof value!=='string'||value!==value.trim()||value.length<1||value.length>120||
    /[\x00-\x1f\x7f]/.test(value))return null;
 return value;
}

/** New match slots persist stadium_name at draw publication. Older immutable
 * slots created before the column existed remain NULL and can read this
 * server-owned club catalogue without modifying their source hash.
 */
export function matchSlotStadium(homeClubId:string,stored:string|null|undefined):string|null {
 if(stored!=null){
  if(typeof stored!=='string'||stored!==stored.trim()||stored.length<1||
     stored.length>120||/[\x00-\x1f\x7f]/.test(stored))return null;
  return stored;
 }
 return canonicalHomeStadium(homeClubId);
}
