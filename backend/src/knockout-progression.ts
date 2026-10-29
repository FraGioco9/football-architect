import divisions from '../../data/divisions.json' with {type:'json'};
import {legacySeasonOneRules} from './calendar-rules-compat.ts';
import cups from '../../data/international-competitions.json' with {type:'json'};
import calendarModel from '../../assets/world-calendar-model.js';
import {requireApprovedSnapshot,canonicalHash,type ApprovedSnapshot} from './catalogue-snapshot.ts';
import {requireGeneratedSchedule,type InitialSchedule,type Fixture} from './initial-schedule.ts';
import {rankLeagueTable,type LeagueRow} from './league-standings.ts';
import {simulateTemporaryMatch,type TemporaryResult,type MatchContext} from './temporary-simulation.ts';
import {ApiError} from './errors.ts';
interface Participant {phaseId?:string;rank?:number;tieId?:string}
interface TieRule {id:string;participants:Participant[];legs:number;homePolicy:string;resolution:string}
interface PhaseRule {id:string;type:string;calendarEvents:string[];ties?:TieRule[]}
interface Definition {id:string;rules:{version:string;phases:PhaseRule[]}}
interface Marker {marker:string;round:number|null;phase:string;competitionIds:string[]}
const definitions=[...legacySeasonOneRules(divisions),...cups] as Definition[];
type Calendar={days:{day:number;events:Marker[]}[]};
const contexts=new WeakMap<InitialSchedule,{calendar:Calendar;events:ReadonlyMap<string,Marker&{day:number}>}>();
function calendarFor(state:Progression){const context=contexts.get(state.schedule);if(!context)throw new ApiError(422,'knockout_prerequisites_incomplete');return context;}
const fail=():never=>{throw new ApiError(422,'knockout_prerequisites_incomplete')};
const textCompare=(a:string,b:string)=>a<b?-1:a>b?1:0;
export interface KnockoutTie {
 schemaVersion:1;season:number;competitionId:string;phaseId:string;tieId:string;rulesVersion:string;
 sourceCalendarHash:string;sourceParticipantsHash:string;sourceRulesHash:string;leagueTableHash:string;
 homePolicy:string;resolution:string;originalRanks:{clubId:string;rank:number}[];dependencyResultIds:string[];
 fixtures:{fixture:Fixture;leg:number;neutral:boolean}[];
}
export interface Progression {
 snapshot:ApprovedSnapshot;schedule:InitialSchedule;lastDay:number;
 results:Map<string,TemporaryResult>;ties:Map<string,KnockoutTie>;tables:Map<string,readonly Readonly<LeagueRow>[]>;
}
export const tieKey=(t:Pick<KnockoutTie,'competitionId'|'phaseId'|'tieId'>)=>`${t.competitionId}:${t.phaseId}:${t.tieId}`;
export function createProgression(snapshot:ApprovedSnapshot,schedule:InitialSchedule):Progression{
 requireApprovedSnapshot(snapshot);requireGeneratedSchedule(schedule,snapshot);
 if(!Number.isSafeInteger(schedule.season)||schedule.season<1||schedule.season>1000000)return fail();
 const calendar=calendarModel.createSeason(schedule.season) as Calendar;
 contexts.set(schedule,{calendar,events:new Map(calendar.days.flatMap(d=>d.events.map(e=>[e.marker,{...e,day:d.day}])))});
 if(schedule.participantsHash!==snapshot.participantsHash||schedule.rulesHash!==snapshot.rulesHash)return fail();
 return {snapshot,schedule,lastDay:0,results:new Map(),ties:new Map(),tables:new Map()};
}
function tieMarkers(state:Progression,phase:PhaseRule,tie:TieRule):string[]{
 const {events}=calendarFor(state);
 const list=phase.calendarEvents.length>tie.legs&&tie.participants.some(p=>p.tieId)?phase.calendarEvents.slice(-tie.legs):phase.calendarEvents.slice(0,tie.legs);
 if(![1,2].includes(tie.legs)||list.length!==tie.legs||list.some(m=>!events.has(m)))return fail();return list;
}
async function leagueTable(state:Progression,competitionId:string){
 let table=state.tables.get(competitionId);if(table)return table;
 const binding=state.snapshot.bindings.find(b=>b.competitionId===competitionId);if(!binding)return fail();
 table=await rankLeagueTable(competitionId,binding.clubIds,state.schedule.fixtures.filter(f=>f.competitionId===competitionId),state.results,state.schedule.seed);
 state.tables.set(competitionId,table);return table;
}
async function resolveTie(state:Progression,definition:Definition,phase:PhaseRule,tie:TieRule):Promise<KnockoutTie>{
 const table=await leagueTable(state,definition.id),dependencies:string[]=[];
 const clubs=tie.participants.map(p=>{
  if(p.phaseId==='league'&&Number.isInteger(p.rank)&&p.rank!>0&&p.rank!<=table.length&&!p.tieId)return table[p.rank!-1].clubId;
  if(p.tieId&&!p.phaseId&&p.rank===undefined){
   const previous=[...state.ties.values()].filter(t=>t.competitionId===definition.id&&t.tieId===p.tieId);if(previous.length!==1)return fail();
   const final=previous[0].fixtures[previous[0].fixtures.length-1].fixture,result=state.results.get(final.id);
   if(!result?.winnerClubId||![final.homeClubId,final.awayClubId].includes(result.winnerClubId))return fail();
   dependencies.push(final.id);return result.winnerClubId;
  }return fail();
 });
 if(clubs.length!==2||clubs[0]===clubs[1]||clubs.some(c=>!table.some(r=>r.clubId===c)))return fail();
 const originalRanks=clubs.map(clubId=>({clubId,rank:table.find(r=>r.clubId===clubId)!.rank}));
 if(!['higherOriginalTableRank','neutral'].includes(tie.homePolicy)||tie.homePolicy==='neutral'&&tie.legs!==1)return fail();
 const best=originalRanks[0].rank<originalRanks[1].rank?clubs[0]:clubs[1],other=clubs.find(c=>c!==best)!;
 const {events}=calendarFor(state);
 const fixtures=tieMarkers(state,phase,tie).map((marker,i)=>{
  const event=events.get(marker)!;if(!event.competitionIds.includes(definition.id))return fail();
  const homeClubId=tie.homePolicy==='neutral'?clubs[0]:tie.legs===2&&i===0?other:best,awayClubId=clubs.find(c=>c!==homeClubId)!;
  return {fixture:{id:`season:${state.schedule.season}:${definition.id}:${marker}:${homeClubId}:${awayClubId}`,competitionId:definition.id,marker,day:event.day,round:event.round??13,homeClubId,awayClubId},leg:i+1,neutral:tie.homePolicy==='neutral'};
 });
 return {schemaVersion:1,season:state.schedule.season,competitionId:definition.id,phaseId:phase.id,tieId:tie.id,rulesVersion:definition.rules.version,
  sourceCalendarHash:state.schedule.calendarHash,sourceParticipantsHash:state.snapshot.participantsHash,sourceRulesHash:state.snapshot.rulesHash,leagueTableHash:await canonicalHash(table),homePolicy:tie.homePolicy,resolution:tie.resolution,originalRanks,dependencyResultIds:dependencies,fixtures};
}
/** Chronological reconstruction. A failed dependency leaves the caller state
 * untouched. Rules and tables determine participants; no caller readiness flag. */
export async function processSportingDay(state:Progression,day:number):Promise<{results:TemporaryResult[];newTies:KnockoutTie[]}>{
 if(!Number.isInteger(day)||day!==state.lastDay+1||day<1||day>56)return fail();
 const working:Progression={...state,results:new Map(state.results),ties:new Map(state.ties),tables:new Map(state.tables)};
 const {calendar}=calendarFor(state);
 const markerDay=calendar.days[day-1],newTies:KnockoutTie[]=[],due:Fixture[]=state.schedule.fixtures.filter(f=>f.day===day);
 const planned=new Map<string,{tie:KnockoutTie;leg:number;neutral:boolean}>();
 for(const event of markerDay.events)if(event.phase!=='league')for(const competitionId of event.competitionIds){
  const definition=definitions.find(d=>d.id===competitionId);if(!definition)return fail();
  const binding=state.snapshot.bindings.find(b=>b.competitionId===competitionId);if(binding?.rulesVersion!==definition.rules.version)return fail();
  for(const phase of definition.rules.phases.filter(p=>p.type==='knockout'&&p.calendarEvents.includes(event.marker)))for(const rule of phase.ties??[]){
   const markers=tieMarkers(state,phase,rule);if(!markers.includes(event.marker))continue;
   const key=tieKey({competitionId,phaseId:phase.id,tieId:rule.id});let tie=working.ties.get(key);
   if(!tie){if(markers[0]!==event.marker)return fail();tie=await resolveTie(working,definition,phase,rule);working.ties.set(key,tie);newTies.push(tie)}
   for(const item of tie.fixtures.filter(f=>f.fixture.day===day)){due.push(item.fixture);planned.set(item.fixture.id,{tie,leg:item.leg,neutral:item.neutral})}
  }
 }
 const order=new Map(markerDay.events.map((e,i)=>[e.marker,i]));
 due.sort((a,b)=>(order.get(a.marker)!-order.get(b.marker)!)||a.competitionId.localeCompare(b.competitionId,'en')||a.id.localeCompare(b.id,'en'));
 if(new Set(due.map(f=>f.id)).size!==due.length)return fail();
 const results:TemporaryResult[]=[];
 for(const f of due){
  if(working.results.has(f.id))return fail();
  const plan=planned.get(f.id);let context:MatchContext={mode:'regulation'};
  if(plan?.tie.fixtures.length===1)context=plan.neutral?{mode:'single-knockout',neutral:true}:{mode:'single-knockout'};
  else if(plan?.leg===2){
   const first=plan.tie.fixtures[0].fixture,score=working.results.get(first.id);
   if(!score||first.homeClubId!==f.awayClubId||first.awayClubId!==f.homeClubId)return fail();
   context={mode:'second-leg',firstLegHomeGoals:score.homeGoals,firstLegAwayGoals:score.awayGoals};
  }
  const result=await simulateTemporaryMatch(f,working.schedule.seed,context);results.push(result);working.results.set(f.id,result);
 }
 state.results=working.results;state.ties=working.ties;state.tables=working.tables;state.lastDay=day;
 return {results,newTies};
}
