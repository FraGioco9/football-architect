/**
 * #605 — Optional, read-only public match ID projection onto a verified calendar
 * day. The two match-slot tables contain only committed fixtures/reservations.
 * No per-competition HTTP fetch, no season rewrite, no synthetic IDs.
 */
import type {Database} from './database.ts';

export interface CalendarLinkFixture {
 readonly id:string;readonly competitionId:string;readonly phaseId:string;
 readonly tieId:string|null;readonly leg:number|null;readonly marker:string;
 readonly day:number;readonly round:number;
}
interface PublishedRow {
 public_id:number;generation:string;season_number:number;competition_id:string;
 phase_id:string;source_fixture_id:string|null;tie_id:string|null;leg:number|null;
 marker:string;scheduled_day:number;round_number:number|null;
}
const numeric=id=>Number.isSafeInteger(id)&&id>0;
const bracket=(phase:string,tie:string,leg:number)=>[phase,tie,leg].join(':');

export function linkCalendarFixturesFromRows(fixtures:readonly CalendarLinkFixture[],
 rows:readonly PublishedRow[],generation:string,season:number,day:number){
 const league=new Map<string,PublishedRow>(),knockout=new Map<string,PublishedRow>();
 for(const row of rows){
  if(!row||!numeric(row.public_id)||row.generation!==generation||
     row.season_number!==season||row.scheduled_day!==day)
   return new Map<string,string>();
  if(row.phase_id==='league'){
   if(typeof row.source_fixture_id!=='string'||league.has(row.source_fixture_id))
    return new Map<string,string>();
   league.set(row.source_fixture_id,row);
  }else{
   if(typeof row.tie_id!=='string'||!row.tie_id||
      !Number.isSafeInteger(row.leg)||row.leg<1||row.leg>2)
    return new Map<string,string>();
   const key=bracket(row.phase_id,row.tie_id,row.leg);
   if(knockout.has(key+':'+row.competition_id))return new Map<string,string>();
   knockout.set(key+':'+row.competition_id,row);
  }
 }
 const links=new Map<string,string>();
 for(const fixture of fixtures){
  const row=fixture.phaseId==='league'?league.get(fixture.id):
   typeof fixture.tieId==='string'&&fixture.leg!==null?
    knockout.get(bracket(fixture.phaseId,fixture.tieId,fixture.leg)+':'+fixture.competitionId):undefined;
  if(row&&row.competition_id===fixture.competitionId&&row.phase_id===fixture.phaseId&&
     row.marker===fixture.marker&&row.scheduled_day===fixture.day&&
     (row.round_number===null||row.round_number===fixture.round))
   links.set(fixture.id,String(row.public_id));
 }
 return links;
}
export async function readCalendarPublishedMatchLinks(db:Database,generation:string,season:number,day:number,
 fixtures:readonly CalendarLinkFixture[]){
 if(!fixtures.length)return new Map<string,string>();
 try{
  // One scoped UNION query returns numeric IDs only for this published world/day.
  const result=await db.prepare(`
   SELECT n.id AS public_id,s.generation,s.season_number,s.competition_id,s.phase_id,
     s.source_fixture_id,NULL AS tie_id,NULL AS leg,s.marker,s.scheduled_day,s.round_number
   FROM season_match_slots s
   JOIN public_match_numbers n ON n.slot_match_id=s.match_id
    AND n.generation=s.generation AND n.season_number=s.season_number
   WHERE s.generation=? AND s.season_number=? AND s.scheduled_day=?
   UNION ALL
   SELECT n.id AS public_id,s.generation,s.season_number,s.competition_id,s.phase_id,
     NULL AS source_fixture_id,s.tie_id,s.leg,s.marker,s.scheduled_day,s.round_number
   FROM season_knockout_match_slots s
   JOIN public_match_numbers n ON n.slot_match_id=s.match_id
    AND n.generation=s.generation AND n.season_number=s.season_number
   WHERE s.generation=? AND s.season_number=? AND s.scheduled_day=?
  `).bind(generation,season,day,generation,season,day).all<PublishedRow>();
  return linkCalendarFixturesFromRows(fixtures,result.results,generation,season,day);
 }catch{
  // Missing/unavailable public match numbers must not erase verified calendar data.
  return new Map<string,string>();
 }
}
