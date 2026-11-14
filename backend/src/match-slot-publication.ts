/** Bulk match-slot publication. Called only inside the source's protected D1 batch. */
import type {Database,Statement} from './database.ts';
import type {Fixture} from './initial-schedule.ts';
import {assignLeagueMatchSlots} from './domain/calendar/match-slot-identity.ts';

export type PublicationKind='calendar'|'domestic'|'international';
const insertSql=`INSERT INTO season_match_slots(
 match_id,generation,season_number,competition_id,phase_id,slot_id,
 source_fixture_id,marker,scheduled_day,round_number,home_club_id,away_club_id,
 source_kind,source_hash,published_at)
 SELECT json_extract(value,'$.matchId'),json_extract(value,'$.generation'),
 json_extract(value,'$.season'),json_extract(value,'$.competitionId'),'league',
 json_extract(value,'$.slotId'),json_extract(value,'$.sourceFixtureId'),
 json_extract(value,'$.marker'),json_extract(value,'$.day'),json_extract(value,'$.round'),
 json_extract(value,'$.homeClubId'),json_extract(value,'$.awayClubId'),
 json_extract(value,'$.sourceKind'),json_extract(value,'$.sourceHash'),
 json_extract(value,'$.publishedAt') FROM json_each(?)`;

/** One SQL statement per competition, not one per match. No DB writes here. */
export async function matchPublicationStatements(
 db:Database,fixtures:readonly Fixture[],generation:string,season:number,
 kind:PublicationKind,sourceHashes:ReadonlyMap<string,string>,publishedAt:number,
):Promise<Statement[]> {
 const target=kind==='calendar'?3984:kind==='domestic'?3840:144;
 if(fixtures.length!==target||!Number.isSafeInteger(publishedAt)||publishedAt<1)
  throw new RangeError('Invalid fixture publication');
 const byId=new Map(fixtures.map(f=>[f.id,f]));
 if(byId.size!==fixtures.length)throw new RangeError('Duplicate source fixture');
 const slots=await assignLeagueMatchSlots(fixtures,generation,season);
 const groups=new Map<string,unknown[]>();
 for(const slot of slots){
  const fixture=byId.get(slot.sourceFixtureId)!;
  const sourceHash=sourceHashes.get(slot.competitionId);
  if(!sourceHash||!/^[0-9a-f]{64}$/.test(sourceHash)||
     (kind==='domestic'&&slot.competitionId.startsWith('int-'))||
     (kind==='international'&&!slot.competitionId.startsWith('int-')))
   throw new RangeError('Invalid fixture provenance');
  const rows=groups.get(slot.competitionId)??[];
  rows.push({matchId:slot.matchId,generation,season,competitionId:slot.competitionId,
   slotId:slot.slotId,sourceFixtureId:fixture.id,marker:fixture.marker,
   day:fixture.day,round:fixture.round,homeClubId:fixture.homeClubId,
   awayClubId:fixture.awayClubId,sourceKind:kind,sourceHash,publishedAt});
  groups.set(slot.competitionId,rows);
 }
 const targetGroups=kind==='calendar'?18:kind==='domestic'?16:2;
 if(groups.size!==targetGroups||sourceHashes.size!==targetGroups)
  throw new RangeError('Missing competition fixtures');
 return [...groups.values()].map(rows=>db.prepare(insertSql).bind(JSON.stringify(rows)));
}
