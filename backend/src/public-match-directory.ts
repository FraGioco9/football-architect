import calendarModel from '../../assets/world-calendar-model.js';
import type {Database} from './database.ts';
import {ApiError} from './errors.ts';
import {readWorld} from './world-repository.ts';
import {readPublicCalendarDayLineupV1} from './public-sporting-read-lineup-v1.ts';
import {confirmedPublication,validKnockoutSlot,type MatchRow,type ReservedKnockout} from './public-match-read-lineup-v1.ts';
import {buildKnockoutSlotReservations} from './domain/calendar/knockout-slot-reservations.ts';
import {matchIdForSlot} from './domain/calendar/match-slot-identity.ts';
import {canonicalHomeStadium,matchSlotStadium} from './match-venues.ts';
import type {Fixture} from './initial-schedule.ts';

type Slot=(MatchRow|ReservedKnockout)&{public_id:number|null};
type DayFixture=Fixture&{phaseId:string;tieId:string|null;leg:number|null;result:unknown};
function invalid():never{throw new ApiError(503,'match_unavailable')}
const tieKey=(competition:string,phase:string,tie:string,leg:number)=>[competition,phase,tie,leg].join(':');

export async function readMatchDirectory(db:Database,season:number,day:number){
 const receiptIds=new Map<string,number>();
 const projection=await readPublicCalendarDayLineupV1(db,season,day,receiptIds);
 const {world}=projection;
 const finish=async(publication:string,fixtures:unknown[])=>{
  const after=await readWorld(db);
  if(after.generation!==world.generation||after.revision!==world.revision||after.seasonNumber!==world.seasonNumber||
     after.day!==world.day||after.phase!==world.phase)throw new ApiError(409,'stale_world');
  return {schemaVersion:1,providerId:'authoritative-world',world,selectedSeason:season,day,publication,fixtures};
 };
 if(projection.status==='unavailable')return finish('unavailable',[]);
 if(season>world.seasonNumber||world.seasonNumber===0)return finish('unpublished',[]);
 const data=projection.data as {fixtures:DayFixture[]}|null;
 if(!data&&'reason' in projection&&projection.reason!=='calendar-unpublished')return invalid();
 const events=await db.prepare("SELECT event_id FROM season_admin_events WHERE season_number=? AND status='completed' AND event_id IN ('domestic:calendar','international:draw')").bind(season).all<{event_id:string}>();
 const committed=new Set(events.results.map(e=>e.event_id));
 const published=(id:string)=>!!data||committed.has(id.startsWith('int-')?'international:draw':'domestic:calendar');
 const key=(f:DayFixture)=>f.tieId&&f.leg?tieKey(f.competitionId,f.phaseId,f.tieId,f.leg):f.id;
 const evidence=new Map(data?.fixtures.map(f=>[key(f),f]));
 const slots=(table:'season_match_slots'|'season_knockout_match_slots')=>db.prepare(
  `SELECT s.*,p.id AS public_id FROM ${table} s LEFT JOIN public_match_numbers p
   ON p.slot_match_id=s.match_id AND p.generation=s.generation AND p.season_number=s.season_number
   WHERE s.season_number=? AND s.scheduled_day=? ORDER BY s.competition_id,s.slot_id`
 ).bind(season,day).all<Slot>();
 const [league,bracket]=await Promise.all([slots('season_match_slots'),slots('season_knockout_match_slots')]);
 const definitions=await buildKnockoutSlotReservations(world.generation,season,'calendar');
 const expected=new Set(definitions.filter(s=>s.day===day&&published(s.competitionId)).map(s=>s.matchId));
 type Marker={phase:string;marker:string;round:number;competitionIds:string[]};
 const calendar=calendarModel.createSeason(season) as {days:{events:Marker[]}[]};
 const markers=calendar.days[day-1]!.events;
 const leagueSlots=new Set<string>();
 for(const event of markers.filter(event=>event.phase==='league')){
  for(const id of event.competitionIds.filter(published)){
   const count=id.startsWith('int-')?12:8;
   for(let ordinal=1;ordinal<=count;ordinal++)leagueSlots.add([id,event.marker,'round:'+event.round+':match:'+ordinal].join('/'));
  }
 }
 const proofs=new Set<string>();
 const fixtures=[];
 for(const row of [...league.results,...bracket.results]){
  if(!published(row.competition_id))continue;
  if(row.generation!==world.generation||!Number.isSafeInteger(row.public_id)||!row.public_id||row.public_id<1)return invalid();
  if(row.source_kind==='domestic'&&row.competition_id.startsWith('int-')||
     row.source_kind==='international'&&!row.competition_id.startsWith('int-'))return invalid();
  const proof=[row.source_kind==='international'?row.competition_id:'',row.source_kind,row.source_hash,row.published_at].join(':');
  if(!proofs.has(proof)){await confirmedPublication(db,row);proofs.add(proof)}
  const knockout='tie_id' in row;
  let fixtureKey:string;
  if(knockout){
   await validKnockoutSlot(row,definitions);
   if(!expected.delete(row.match_id))return invalid();
   fixtureKey=tieKey(row.competition_id,row.phase_id,row.tie_id,row.leg);
  }else{
   if(!leagueSlots.delete([row.competition_id,row.marker,row.slot_id].join('/')))return invalid();
   const id=await matchIdForSlot({generation:world.generation,season,competitionId:row.competition_id,phaseId:row.phase_id,slotId:row.slot_id});
   fixtureKey=row.source_fixture_id;
   if(row.match_id!==id||fixtureKey!==['season',season,row.competition_id,row.marker,row.home_club_id,row.away_club_id].join(':'))return invalid();
  }
  const f=evidence.get(fixtureKey);
  if(!knockout&&data&&!f)return invalid();
  if(f&&(f.marker!==row.marker||f.competitionId!==row.competition_id||f.day!==day||
     (!knockout&&(f.round!==row.round_number||f.homeClubId!==row.home_club_id||f.awayClubId!==row.away_club_id))))return invalid();
  evidence.delete(fixtureKey);
  const home=knockout?f?.homeClubId??null:row.home_club_id;
  const away=knockout?f?.awayClubId??null:row.away_club_id;
  const neutral=knockout&&row.home_policy==='neutral';
  const venue=knockout?(home&&!neutral?canonicalHomeStadium(home):null):matchSlotStadium(home!,row.stadium_name);
  if(f?.result&&receiptIds.get(f.id)!==row.public_id)return invalid();
  if(f?.result&&season===world.seasonNumber&&day>world.day)return invalid();
  fixtures.push({matchId:String(row.public_id),competitionId:row.competition_id,phaseId:row.phase_id,
   round:row.round_number,tieId:knockout?row.tie_id:null,leg:knockout?row.leg:null,
   homeClubId:home,awayClubId:away,participantA:knockout?JSON.parse(row.participant_a_json):null,
   participantB:knockout?JSON.parse(row.participant_b_json):null,neutral,venue,
   status:f?.result?'completed':home&&away?'scheduled':'awaiting_participants',result:f?.result??null});
 }
 if(leagueSlots.size||evidence.size||expected.size)return invalid();
 return finish(data?'published':committed.size?'partial':'unpublished',fixtures);
}
