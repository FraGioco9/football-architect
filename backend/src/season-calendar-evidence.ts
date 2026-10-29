/** Season 1 design-calendar evidence. Not a fixture/scheduling engine. */
import calendarModel from '../../assets/world-calendar-model.js';
import approval from '../catalogues/season-1.approval.json' with {type:'json'};
import {canonicalHash} from './catalogue-snapshot.ts';
import {ApiError} from './errors.ts';

type Marker={id:string;marker:string;family:string;phase:string;round:number|null;competitionIds:string[]};
type Day={id:string;day:number;kind:string;pairing:string|null;events:Marker[]};
export type CalendarEvidence=Readonly<{
 season:number;calendarVersion:string;calendarHash:string;calendarJson:string;
}>;
const countryIds=['IT','ENG','ES','DE','FR','PT','NL','BR'];
const domestic=countryIds.flatMap(country=>[country+'-1',country+'-2']);
const international=['int-1','int-2'];
const allDays=new Set<number>();
const hasExact=(actual:string[],expected:string[])=>actual.length===expected.length&&expected.every((x,i)=>actual[i]===x);
const fail=():never=>{throw new ApiError(422,'calendar_invalid')};

/** Derives and checks design event markers, never football fixtures or results. */
export async function buildSeasonOneCalendarEvidence():Promise<CalendarEvidence>{
 try{
  const source=calendarModel.createSeason(1) as {schemaVersion:number;model:string;season:number;days:Day[]};
  const days=source.days;
  if(source.schemaVersion!==1||source.season!==1||source.model!=='WORLD-TIME-QA-06'||
     !Array.isArray(days)||days.length!==56)return fail();
  const national:Marker[]=[],cups:Marker[]=[];
  for(let i=0;i<days.length;i++){
   const day=days[i];
   if(day.day!==i+1||day.id!==`season:1:day:${i+1}`||!Array.isArray(day.events))return fail();
   for(const event of day.events){
    if(event.id!==`season:1:${event.marker}`||!Array.isArray(event.competitionIds))return fail();
    if(event.family==='national'){
     if(!hasExact(event.competitionIds,domestic))return fail();
     national.push(event);
    }else if(event.family==='international'){
     if(!hasExact(event.competitionIds,event.marker==='FEDERATION-FINAL'?['int-2']:event.marker==='SOVEREIGN-FINAL'?['int-1']:international))return fail();
     cups.push(event);
    }else return fail();
   }
   if(day.events.length>0)allDays.add(day.day);
   if(day.events.length>2||((day.events.length===0)!==(day.kind!=='official')))return fail();
  }
  if(national.length!==32||cups.length!==14)return fail();
  for(let i=0;i<32;i++){
   const e=national[i];
   if(e.marker!==`N${String(i+1).padStart(2,'0')}`||e.round!==i+1||e.phase!==(i<30?'league':'postseason'))return fail();
  }
  for(let i=0;i<12;i++){
   const e=cups[i];
   if(e.marker!==`I${String(i+1).padStart(2,'0')}`||e.round!==i+1)return fail();
  }
  if(cups[12].marker!=='FEDERATION-FINAL'||cups[13].marker!=='SOVEREIGN-FINAL'||days[55].kind!=='transition')return fail();
  const calendarHash=await canonicalHash(JSON.parse(JSON.stringify(source)));
  if(calendarHash!==approval.calendarHash)return fail();
  return {season:1,calendarVersion:'WORLD-TIME-QA-06',calendarHash,calendarJson:JSON.stringify(source)};
 }catch{throw new ApiError(422,'calendar_invalid')}
}
