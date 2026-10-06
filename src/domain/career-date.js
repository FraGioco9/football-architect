// Real calendar support. Date-only values are handled in UTC to avoid timezone day shifts.
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const CAREER_CALENDAR_VERSION=2;

const PROFILES=Object.freeze({
  IT:{preseason:[7,1],first:[8,20],weekendDays:[0,6],weekendTimes:['12:30','15:00','18:00','20:45'],midweekTimes:['18:30','20:45']},
  ENG:{preseason:[7,1],first:[8,14],weekendDays:[6,0],weekendTimes:['12:30','15:00','17:30','20:00'],midweekTimes:['19:45','20:00']},
  ES:{preseason:[7,4],first:[8,14],weekendDays:[0,6],weekendTimes:['14:00','16:15','18:30','21:00'],midweekTimes:['19:00','21:00']},
  DE:{preseason:[7,1],first:[8,20],weekendDays:[6,0],weekendTimes:['15:30','18:30','20:30'],midweekTimes:['18:30','20:30']},
  FR:{preseason:[7,1],first:[8,14],weekendDays:[0,6],weekendTimes:['15:00','17:00','20:45'],midweekTimes:['19:00','21:00']},
  NL:{preseason:[6,29],first:[8,7],weekendDays:[0,6],weekendTimes:['12:15','14:30','16:45','20:00'],midweekTimes:['18:45','20:00']},
  PT:{preseason:[7,1],first:[8,7],weekendDays:[0,6],weekendTimes:['15:30','18:00','20:30','21:15'],midweekTimes:['18:45','20:30']},
  BR:{preseason:[1,2],first:[2,1],weekendDays:[0,6],weekendTimes:['16:00','18:30','20:00','21:30'],midweekTimes:['19:00','21:30']}
});
const DEFAULT_PROFILE=PROFILES.IT;

function profile(countryId){return PROFILES[countryId]??DEFAULT_PROFILE;}
function hash(...parts){
  let h=2166136261;
  for(const ch of parts.join('|')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}
function pick(list,...parts){return list[hash(...parts)%list.length];}
function dateParts(value){return value.split('-').map(Number);}
function isoDate(year,month,day){return new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10);}
function weekday(value){const [y,m,d]=dateParts(value);return new Date(Date.UTC(y,m-1,d)).getUTCDay();}
function nextWeekdayOnOrAfter(value,targetDay){
  const delta=(targetDay-weekday(value)+7)%7;
  return addDaysISO(value,delta);
}
function inferYear(value){return isCareerDate(value)?Number(value.slice(0,4)):null;}

export function isCareerDate(value){
  if(typeof value!=='string'||!ISO_DATE.test(value))return false;
  const [y,m,d]=dateParts(value);
  const date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
export function isCareerKickoff(value){return typeof value==='string'&&ISO_TIME.test(value);}

export function todayISO(now=new Date()){
  const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,'0'),d=String(now.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(value,days){
  if(!isCareerDate(value)||!Number.isSafeInteger(days))throw new Error('CAREER_DATE_INVALID');
  const [y,m,d]=dateParts(value);
  return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10);
}

export function daysBetweenISO(from,to){
  if(!isCareerDate(from)||!isCareerDate(to))throw new Error('CAREER_DATE_INVALID');
  const [fy,fm,fd]=dateParts(from),[ty,tm,td]=dateParts(to);
  return Math.round((Date.UTC(ty,tm-1,td)-Date.UTC(fy,fm-1,fd))/86400000);
}

export function formatCareerDate(value,lang='it'){
  if(!isCareerDate(value))return '—';
  const [y,m,d]=dateParts(value);
  return new Intl.DateTimeFormat(lang==='en'?'en-GB':'it-IT',{
    weekday:'short',day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'
  }).format(new Date(Date.UTC(y,m-1,d)));
}
export function formatCareerDateTime(date,kickoff,lang='it'){
  const formatted=formatCareerDate(date,lang);
  return isCareerKickoff(kickoff)?`${formatted} · ${kickoff}`:formatted;
}

export function careerCampaignYear(referenceDate,countryId='IT'){
  if(!isCareerDate(referenceDate))throw new Error('CAREER_DATE_INVALID');
  const [year,month]=dateParts(referenceDate);
  if(countryId==='BR')return year;
  return month>=7?year:year-1;
}
export function careerPreseasonStart(countryId,seasonYear){
  const p=profile(countryId),[month,day]=p.preseason;
  return isoDate(seasonYear,month,day);
}
export function careerFirstLeagueDate(countryId,seasonYear,{seed=0,season=1}={}){
  const p=profile(countryId),[month,day]=p.first;
  const target=isoDate(seasonYear,month,day);
  const preferred=pick(p.weekendDays,'first-weekend',seed,season,countryId);
  return nextWeekdayOnOrAfter(target,preferred);
}

function sizedRoundTargets(length,fractions,count,{seed,season,countryId,label,min=2,max=length-1}){
  const targets=[];
  for(let i=0;i<count;i++){
    const base=Math.round((length-1)*fractions[i])+1;
    const jitter=(hash(label,seed,season,countryId,i)%3)-1;
    let value=Math.max(min,Math.min(max,base+jitter));
    while(targets.includes(value)&&value<max)value++;
    while(targets.includes(value)&&value>min)value--;
    targets.push(value);
  }
  return targets.sort((a,b)=>a-b);
}

function calendarShape(length,{seed=0,season=1,countryId='IT'}={}){
  const midweekCount=length>=30?4:length>=20?2:1;
  const breakCount=length>=30?6:length>=20?3:2;
  const midweekFractions=[.14,.36,.59,.82];
  const breakFractions=[.20,.31,.45,.61,.76,.91];
  const midweeks=new Set(sizedRoundTargets(length,midweekFractions,midweekCount,{seed,season,countryId,label:'midweek'}));
  const breaks=sizedRoundTargets(length,breakFractions,breakCount,{seed,season,countryId,label:'break',min:3,max:length-1})
    .filter(round=>!midweeks.has(round)&&!midweeks.has(round-1));
  return {midweeks,breaks:new Set(breaks)};
}

function kickoffPool(countryId,slot){const p=profile(countryId);return slot==='midweek'?p.midweekTimes:p.weekendTimes;}
function decorateMatches(round,{seed,season,countryId}){
  const pool=kickoffPool(countryId,round.slot);
  const offset=hash('kickoff',seed,season,countryId,round.round)%pool.length;
  for(let i=0;i<(round.matches??[]).length;i++){
    const match=round.matches[i],kickoff=pool[(offset+i)%pool.length];
    match.date=round.date;
    match.kickoff=kickoff;
    match.datetime=`${round.date}T${kickoff}:00`;
  }
}

export function scheduleFixtureDates(fixtures,firstMatchDate,{seed=0,season=1,countryId='IT'}={}){
  if(!Array.isArray(fixtures)||!fixtures.length||!isCareerDate(firstMatchDate))throw new Error('CAREER_FIXTURE_DATE_INVALID');
  const p=profile(countryId),shape=calendarShape(fixtures.length,{seed,season,countryId});
  let date=firstMatchDate;
  for(let i=0;i<fixtures.length;i++){
    const round=fixtures[i],number=i+1,isMidweek=shape.midweeks.has(number);
    if(i>0){
      if(isMidweek){
        const midweekDay=pick([2,3,4],'midweek-day',seed,season,countryId,number);
        date=nextWeekdayOnOrAfter(addDaysISO(date,2),midweekDay);
      }else{
        const weekendDay=pick(p.weekendDays,'weekend-day',seed,season,countryId,number);
        date=nextWeekdayOnOrAfter(addDaysISO(date,3),weekendDay);
        if(shape.breaks.has(number))date=addDaysISO(date,7);
      }
    }
    round.date=date;
    round.slot=isMidweek?'midweek':'weekend';
    decorateMatches(round,{seed,season,countryId});
  }
  return fixtures;
}

function decorateLegacyFixtureTimes(fixtures,{seed=0,season=1,countryId='IT'}={}){
  for(const round of fixtures){
    if(!isCareerDate(round.date))continue;
    const dow=weekday(round.date),isMidweek=[1,2,3,4,5].includes(dow);
    round.slot=isMidweek?'midweek':'weekend';
    decorateMatches(round,{seed,season,countryId});
  }
}

export function initializeCareerCalendar(w,{today=todayISO()}={}){
  if(!w||!Array.isArray(w.fixtures))throw new Error('CAREER_DATE_WORLD');
  const seasonYear=careerCampaignYear(today,w.countryId);
  const seasonStartDate=careerPreseasonStart(w.countryId,seasonYear);
  const firstMatchDate=careerFirstLeagueDate(w.countryId,seasonYear,{seed:w.seed,season:w.season});
  w.calendarModelVersion=CAREER_CALENDAR_VERSION;
  w.seasonCalendarYear=seasonYear;
  w.careerDay=0;
  w.currentDate=seasonStartDate;
  w.seasonStartDate=seasonStartDate;
  w.firstMatchDate=firstMatchDate;
  scheduleFixtureDates(w.fixtures,firstMatchDate,{seed:w.seed,season:w.season,countryId:w.countryId});
  return w;
}

export function ensureCareerDates(w,{today=todayISO()}={}){
  if(!w||!Array.isArray(w.fixtures))throw new Error('CAREER_DATE_WORLD');
  if(w.calendarModelVersion===CAREER_CALENDAR_VERSION&&isCareerDate(w.currentDate)&&isCareerDate(w.seasonStartDate)&&isCareerDate(w.firstMatchDate)){
    const missingSchedule=w.fixtures.some(r=>!isCareerDate(r.date)||!['weekend','midweek'].includes(r.slot)||r.matches?.some(m=>!isCareerDate(m.date)||!isCareerKickoff(m.kickoff)));
    if(missingSchedule)scheduleFixtureDates(w.fixtures,w.firstMatchDate,{seed:w.seed,season:w.season,countryId:w.countryId});
    return w;
  }

  // New worlds have no established career date yet: start from a real preseason.
  if(!isCareerDate(w.currentDate))return initializeCareerCalendar(w,{today});

  // Legacy dated saves are never rewound. Preserve their current schedule for the
  // active season, add kickoff metadata, then switch to the realistic generator
  // at the next rollover.
  const logicalDay=Number.isSafeInteger(w.careerDay)&&w.careerDay>=0
    ?w.careerDay
    :Number.isSafeInteger(w.advancedV1?.clockDay)&&w.advancedV1.clockDay>=0
      ?w.advancedV1.clockDay
      :Math.max(0,(Number.isSafeInteger(w.round)?w.round:0)*7);
  w.careerDay=logicalDay;
  w.seasonStartDate=isCareerDate(w.seasonStartDate)?w.seasonStartDate:addDaysISO(w.currentDate,-logicalDay);
  w.firstMatchDate=isCareerDate(w.firstMatchDate)?w.firstMatchDate:(w.fixtures.find(r=>isCareerDate(r.date))?.date??addDaysISO(w.seasonStartDate,7));
  w.seasonCalendarYear=Number.isSafeInteger(w.seasonCalendarYear)?w.seasonCalendarYear:(inferYear(w.seasonStartDate)??careerCampaignYear(today,w.countryId));
  if(w.fixtures.every(r=>isCareerDate(r.date)))decorateLegacyFixtureTimes(w.fixtures,{seed:w.seed,season:w.season,countryId:w.countryId});
  else scheduleFixtureDates(w.fixtures,w.firstMatchDate,{seed:w.seed,season:w.season,countryId:w.countryId});
  w.calendarModelVersion=CAREER_CALENDAR_VERSION;
  return w;
}

export function nextSeasonCalendarPlan(w){
  ensureCareerDates(w);
  let seasonYear=(Number.isSafeInteger(w.seasonCalendarYear)?w.seasonCalendarYear:inferYear(w.seasonStartDate)??careerCampaignYear(w.currentDate,w.countryId))+1;
  let seasonStartDate=careerPreseasonStart(w.countryId,seasonYear);
  while(seasonStartDate<=w.currentDate){seasonYear++;seasonStartDate=careerPreseasonStart(w.countryId,seasonYear);}
  const firstMatchDate=careerFirstLeagueDate(w.countryId,seasonYear,{seed:w.seed,season:w.season+1});
  return {seasonYear,seasonStartDate,firstMatchDate,days:daysBetweenISO(w.currentDate,seasonStartDate)};
}

export function openNextSeasonDates(w,{plan=null}={}){
  if(!plan)ensureCareerDates(w);
  const next=plan??nextSeasonCalendarPlan(w);
  if(!next||!Number.isSafeInteger(next.days)||next.days<0||!isCareerDate(next.seasonStartDate)||!isCareerDate(next.firstMatchDate))throw new Error('CAREER_OFFSEASON_DATE');
  w.calendarModelVersion=CAREER_CALENDAR_VERSION;
  w.seasonCalendarYear=next.seasonYear;
  w.currentDate=next.seasonStartDate;
  w.seasonStartDate=next.seasonStartDate;
  w.firstMatchDate=next.firstMatchDate;
  scheduleFixtureDates(w.fixtures,next.firstMatchDate,{seed:w.seed,season:w.season,countryId:w.countryId});
  return next;
}

export function advanceCareerDate(w){
  ensureCareerDates(w);
  w.currentDate=addDaysISO(w.currentDate,1);
  w.careerDay++;
  return w.currentDate;
}

export function pendingFixtureDay(w){
  ensureCareerDates(w);
  return w.fixtures?.[w.round]??null;
}

export function fixtureIsDue(w){
  const fixture=pendingFixtureDay(w);
  return Boolean(fixture&&isCareerDate(fixture.date)&&fixture.date<=w.currentDate);
}

export function nextFixtureDate(w){return pendingFixtureDay(w)?.date??null;}
