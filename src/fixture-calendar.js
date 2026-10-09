/**
 * CAL-02.1: deterministic home/away pairings only.
 * No kick-off dates, scores, standings, match engine or persistent data.
 */
import {COMPETITIONS,getCompetitionClubs} from './leagues.js';
import {validSession,sessionTime} from './simulation.js';
import {seasonOpeningYear} from './season-calendar.js';

const CLUB_COUNT=20;
const HALF_ROUNDS=CLUB_COUNT-1;

function seedFor(competitionId,seasonYear){
  // FNV-1a over an ASCII-only key; stable across browsers and Node.
  let hash=2166136261;
  for(const char of competitionId+':'+seasonYear){
    hash^=char.charCodeAt(0);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0 || 0x9e3779b9;
}

function permute(clubIds,competitionId,seasonYear){
  const ids=[...clubIds].sort((a,b)=>a-b);
  let seed=seedFor(competitionId,seasonYear);
  const next=()=>{
    seed^=seed<<13;
    seed^=seed>>>17;
    seed^=seed<<5;
    return seed>>>0;
  };
  for(let i=ids.length-1;i>0;i--){
    const j=next()%(i+1);
    [ids[i],ids[j]]=[ids[j],ids[i]];
  }
  return ids;
}

function validateInputs({competitionId,seasonYear,clubIds}){
  if(typeof competitionId!=='string'||!/^[A-Z][A-Z0-9_-]{0,63}$/.test(competitionId))throw new Error('Invalid competition');
  if(!Number.isSafeInteger(seasonYear)||seasonYear<1900||seasonYear>9000)throw new Error('Invalid season year');
  if(!Array.isArray(clubIds)||clubIds.length!==CLUB_COUNT||
     clubIds.some(id=>!Number.isSafeInteger(id)||id<1)||
     new Set(clubIds).size!==CLUB_COUNT)throw new Error('A division requires 20 distinct club IDs');
}

/**
 * Return 38 matchdays, each containing ten fixtures.
 * The second leg keeps matchday order and reverses the venue of each pairing.
 * Date/time allocation and rest constraints belong to CAL-02.2.
 */
export function generateFixtureCalendar({competitionId,seasonYear,clubIds}={}){
  validateInputs({competitionId,seasonYear,clubIds});
  const ring=permute(clubIds,competitionId,seasonYear);
  const firstLeg=[];
  for(let round=0;round<HALF_ROUNDS;round++){
    const fixtures=[];
    for(let i=0;i<CLUB_COUNT/2;i++){
      const left=ring[i],right=ring[CLUB_COUNT-1-i];
      const homeLeft=i===0?round%2===0:(round+i)%2===0;
      fixtures.push(Object.freeze({
        homeClubId:homeLeft?left:right,
        awayClubId:homeLeft?right:left
      }));
    }
    firstLeg.push(fixtures);
    ring.splice(1,0,ring.pop());
  }

  const matchdays=Array.from({length:HALF_ROUNDS*2},(_,index)=>{
    const number=index+1;
    const returnLeg=index>=HALF_ROUNDS;
    const fixtures=firstLeg[index%HALF_ROUNDS].map(pair=>{
      const homeClubId=returnLeg?pair.awayClubId:pair.homeClubId;
      const awayClubId=returnLeg?pair.homeClubId:pair.awayClubId;
      return Object.freeze({
        id:`${competitionId}:${seasonYear}:${number}:${homeClubId}-${awayClubId}`,
        competitionId,seasonYear,matchday:number,homeClubId,awayClubId
      });
    });
    return Object.freeze({number,fixtures:Object.freeze(fixtures)});
  });
  return Object.freeze({competitionId,seasonYear,matchdays:Object.freeze(matchdays)});
}

/** Enumerated competition IDs (IT-1, ENG-1, etc.) come from the DIV-02 catalog. */
export function generateCompetitionFixtures(competitionId,seasonYear){
  if(!COMPETITIONS.some(competition=>competition.id===competitionId))throw new Error('Unknown competition');
  return generateFixtureCalendar({
    competitionId,seasonYear,
    clubIds:getCompetitionClubs(competitionId).map(club=>club.id)
  });
}

/**
 * CAL-02.2: shared worldwide kick-off rules, including Brazil.
 * All timestamps use a fixed 24-hour simulated day in UTC; this is NOT a
 * conversion to the machine's timezone or the real stadium timezone.
 */
const FIXTURE_DAY_MS=86400000;
const MIN_FIXTURE_REST_MS=72*3600000;
const WEEKEND_KICKOFFS=Object.freeze({
 '-1':Object.freeze(['20:45']), // Friday before the anchor Saturday
 '0':Object.freeze(['12:30','15:00','18:00','20:45']),
 '1':Object.freeze(['12:30','15:00','18:00','20:45']),
 '2':Object.freeze(['20:45']) // Monday after the anchor Saturday
});
const MIDWEEK_KICKOFFS=Object.freeze(['18:30','20:45']);

/** Only scheduling conflicts, never unexpected programming errors, permit fallback. */
export class FixtureSchedulingConflict extends Error {
 constructor(message){super(message);this.name='FixtureSchedulingConflict';}
}

/** Pure selector: injected callbacks make the automatic recovery path testable. */
export function withFixtureFallback(varied,conservative){
 try{return varied();}
 catch(error){
  if(!(error instanceof FixtureSchedulingConflict))throw error;
  return conservative();
 }
}

function legalFixtureDay(timestamp,seasonYear){
 const date=new Date(timestamp).toISOString().slice(0,10);
 return timestamp>=Date.UTC(seasonYear,7,15) &&
  timestamp<=Date.UTC(seasonYear+1,4,31) &&
  !(date>=seasonYear+'-12-24'&&date<=(seasonYear+1)+'-01-02');
}

function seasonSaturdayAnchors(seasonYear){
 const saturdays=[];
 for(let stamp=Date.UTC(seasonYear,7,15);stamp<=Date.UTC(seasonYear+1,4,31);stamp+=FIXTURE_DAY_MS){
  if(new Date(stamp).getUTCDay()===6&&legalFixtureDay(stamp,seasonYear))saturdays.push(stamp);
 }
 if(saturdays.length<38)throw new Error('Not enough legal Saturdays for 38 matchdays');
 // Use the whole season, rather than bunching fixtures at the beginning.
 return Array.from({length:38},(_,i)=>saturdays[Math.floor(i*(saturdays.length-1)/37)]);
}

function kickoffSlots(anchor,seasonYear,kind,previousKind){
 let windows;
 if(kind==='conservative')windows=[[0,WEEKEND_KICKOFFS[0]]];
 else if(kind==='Tuesday'||kind==='Wednesday'||kind==='Thursday'){
  windows=[[{Tuesday:3,Wednesday:4,Thursday:5}[kind],MIDWEEK_KICKOFFS]];
 }else if(previousKind==='Thursday'){
  // Thu 20:45 -> Sun 20:45 is exactly 72 hours.
  windows=[[1,['20:45']],[2,WEEKEND_KICKOFFS[2]]];
 }else if(previousKind==='Wednesday'){
  // Wed 20:45 -> Sun 12:30 is >72 hours.
  windows=[[1,WEEKEND_KICKOFFS[1]],[2,WEEKEND_KICKOFFS[2]]];
 }else windows=[[-1,WEEKEND_KICKOFFS[-1]],[0,WEEKEND_KICKOFFS[0]],
               [1,WEEKEND_KICKOFFS[1]],[2,WEEKEND_KICKOFFS[2]]];
 return windows.flatMap(([offset,times])=>{
  const stamp=anchor+offset*FIXTURE_DAY_MS;
  if(!legalFixtureDay(stamp,seasonYear))return [];
  const date=new Date(stamp).toISOString().slice(0,10);
  return times.map(time=>({date,time}));
 });
}

function assignFixtureKickoffs(source,conservative){
 const {competitionId,seasonYear}=source,anchors=seasonSaturdayAnchors(seasonYear);
 const seed=seedFor(competitionId,seasonYear);
 const selected=[6+(seed%4),12+((seed>>>3)%4),23+((seed>>>7)%4),30+((seed>>>11)%4)];
 const midweekDays=['Tuesday','Wednesday','Thursday','Tuesday'];
 const midweeks=new Map(selected.map((round,i)=>[round,midweekDays[(i+seed%3)%4]]));
 const matchdays=source.matchdays.map((round,i)=>{
  const kind=conservative?'conservative':(midweeks.get(i)||'weekend');
  const previousKind=conservative?null:midweeks.get(i-1);
  const slots=kickoffSlots(anchors[i],seasonYear,kind,previousKind);
  if(!slots.length)throw new FixtureSchedulingConflict('No legal kick-off slots');
  const offset=seedFor(competitionId,seasonYear+i+1)%slots.length;
  const fixtures=round.fixtures.map((fixture,j)=>
   Object.freeze({...fixture,...slots[(j+offset)%slots.length]}));
  return Object.freeze({number:round.number,fixtures:Object.freeze(fixtures)});
 });
 return Object.freeze({competitionId,seasonYear,matchdays:Object.freeze(matchdays)});
}

function verifyScheduledKickoffs(calendar){
 const {seasonYear,matchdays}=calendar;
 let previousRoundEnd=-Infinity;
 const lastByClub=new Map();
 for(const round of matchdays){
  let roundFirst=Infinity,roundLast=-Infinity;
  for(const fixture of round.fixtures){
   const {date,time}=fixture;
   const stamp=Date.parse(date+'T'+time+':00Z');
   if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==date||
       !legalFixtureDay(Date.parse(date+'T00:00:00Z'),seasonYear)){
    throw new Error('Kick-off outside the universal season');
   }
   const weekday=new Date(stamp).getUTCDay();
   const allowed=weekday===0||weekday===6?WEEKEND_KICKOFFS[1]:
    weekday===5||weekday===1?WEEKEND_KICKOFFS[-1]:
    MIDWEEK_KICKOFFS;
   if(!allowed.includes(time))throw new Error('Unapproved kick-off time');
   roundFirst=Math.min(roundFirst,stamp);
   roundLast=Math.max(roundLast,stamp);
   for(const id of [fixture.homeClubId,fixture.awayClubId]){
    if(lastByClub.has(id)&&stamp-lastByClub.get(id)<MIN_FIXTURE_REST_MS)
     throw new FixtureSchedulingConflict('Insufficient 72-hour rest for club '+id);
    lastByClub.set(id,stamp);
   }
  }
  if(roundFirst-previousRoundEnd<MIN_FIXTURE_REST_MS)
   throw new FixtureSchedulingConflict('Overlapping matchdays');
  previousRoundEnd=roundLast;
 }
 return calendar;
}

/**
 * Create a calendar without changing CAL-02.1 pairings or fixture IDs.
 * 'conservative' is a documented safe option (also tests the fallback path).
 * The default first tries varied weekend and midweek dates, then a proven
 * Saturday-only plan if the varied layout ever breaks hard constraints.
 */
export function scheduleCompetitionFixtures(competitionId,seasonYear,{strategy='varied'}={}){
 if(strategy!=='varied'&&strategy!=='conservative')throw new Error('Unknown fixture strategy');
 const source=generateCompetitionFixtures(competitionId,seasonYear);
 if(strategy==='conservative')return verifyScheduledKickoffs(assignFixtureKickoffs(source,true));
 return withFixtureFallback(
  ()=>verifyScheduledKickoffs(assignFixtureKickoffs(source,false)),
  ()=>verifyScheduledKickoffs(assignFixtureKickoffs(source,true))
 );
}

/** Find the next fixture for the current saved career, without simulating it. */
export function nextScheduledClubFixture(state,calendarFor=scheduleCompetitionFixtures){
 if(!validSession(state))throw new Error('Invalid calendar session');
 const competitionId=state.countryId+'-1';
 const now=state.date+'T'+sessionTime(state);
 const currentYear=seasonOpeningYear(state.date);
 for(const year of [currentYear,currentYear+1]){
  const calendar=calendarFor(competitionId,year);
  let next=null,nextAt=null;
  for(const day of calendar.matchdays)for(const fixture of day.fixtures){
   if(fixture.homeClubId!==state.clubId&&fixture.awayClubId!==state.clubId)continue;
   const at=fixture.date+'T'+fixture.time;
   // Equality is intentional: a scheduled event remains until the clock passes kickoff.
   if(at<now||(nextAt!==null&&at>=nextAt))continue;
   next=fixture;nextAt=at;
  }
  if(next)return next;
 }
 return null;
}

/** Four immutable seasonal calendars at most, never persisted to IndexedDB. */
export function createFixtureCalendarCache(maxEntries=4,generate=scheduleCompetitionFixtures){
 if(!Number.isSafeInteger(maxEntries)||maxEntries<1)throw new Error('Invalid fixture cache size');
 const cache=new Map();
 return (competitionId,seasonYear)=>{
  const key=competitionId+':'+seasonYear;
  if(cache.has(key)){
   const calendar=cache.get(key);
   cache.delete(key);cache.set(key,calendar);
   return calendar;
  }
  const calendar=generate(competitionId,seasonYear);
  cache.set(key,calendar);
  if(cache.size>maxEntries)cache.delete(cache.keys().next().value);
  return calendar;
 };
}
