/** Bulk match-slot publication. Called only inside the source's protected D1 batch. */
import type {Database,Statement} from './database.ts';
import type {Fixture} from './initial-schedule.ts';
import {assignLeagueMatchSlots} from './domain/calendar/match-slot-identity.ts';
import {buildKnockoutSlotReservations} from './domain/calendar/knockout-slot-reservations.ts';

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

/** The caller must include these in the same D1 batch as official draw publication. */
export async function knockoutPublicationStatements(
 db:Database,generation:string,season:number,kind:PublicationKind,
 sourceHashes:ReadonlyMap<string,string>,publishedAt:number,
):Promise<Statement[]> {
 const slots=await buildKnockoutSlotReservations(generation,season,kind);
 const grouped=new Map<string,unknown[]>();
 for(const slot of slots){
  const sourceHash=sourceHashes.get(slot.competitionId);
  if(!sourceHash||!/^[0-9a-f]{64}$/.test(sourceHash))throw new RangeError('Invalid knockout source');
  const rows=grouped.get(slot.competitionId)??[];
  rows.push({...slot,generation,season,sourceKind:kind,sourceHash,publishedAt});
  grouped.set(slot.competitionId,rows);
 }
 if(grouped.size!==(kind==='calendar'?18:kind==='domestic'?16:2)||
    sourceHashes.size!==grouped.size)throw new RangeError('Incomplete knockout draw');
 const sql=`INSERT INTO season_knockout_match_slots (
 match_id,generation,season_number,competition_id,phase_id,tie_id,leg,slot_id,marker,
 scheduled_day,round_number,home_policy,rules_version,participant_a_json,
 participant_b_json,source_kind,source_hash,published_at)
 SELECT json_extract(value,'$.matchId'),json_extract(value,'$.generation'),
 json_extract(value,'$.season'),json_extract(value,'$.competitionId'),
 json_extract(value,'$.phaseId'),json_extract(value,'$.tieId'),json_extract(value,'$.leg'),
 json_extract(value,'$.slotId'),json_extract(value,'$.marker'),json_extract(value,'$.day'),
 json_extract(value,'$.round'),json_extract(value,'$.homePolicy'),
 json_extract(value,'$.rulesVersion'),json(json_extract(value,'$.participantA')),
 json(json_extract(value,'$.participantB')),json_extract(value,'$.sourceKind'),
 json_extract(value,'$.sourceHash'),json_extract(value,'$.publishedAt')
 FROM json_each(?)`;
 return [...grouped.values()].map(rows=>db.prepare(sql).bind(JSON.stringify(rows)));
}
