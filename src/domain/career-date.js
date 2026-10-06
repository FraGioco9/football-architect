// Real calendar support. Date-only values are handled in UTC to avoid timezone day shifts.
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;

export function isCareerDate(value){
  if(typeof value!=='string'||!ISO_DATE.test(value))return false;
  const [y,m,d]=value.split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}

export function todayISO(now=new Date()){
  const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,'0'),d=String(now.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(value,days){
  if(!isCareerDate(value)||!Number.isSafeInteger(days))throw new Error('CAREER_DATE_INVALID');
  const [y,m,d]=value.split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d+days));
  return date.toISOString().slice(0,10);
}

export function daysBetweenISO(from,to){
  if(!isCareerDate(from)||!isCareerDate(to))throw new Error('CAREER_DATE_INVALID');
  const [fy,fm,fd]=from.split('-').map(Number),[ty,tm,td]=to.split('-').map(Number);
  return Math.round((Date.UTC(ty,tm-1,td)-Date.UTC(fy,fm-1,fd))/86400000);
}

export function formatCareerDate(value,lang='it'){
  if(!isCareerDate(value))return '—';
  const [y,m,d]=value.split('-').map(Number);
  return new Intl.DateTimeFormat(lang==='en'?'en-GB':'it-IT',{
    weekday:'short',day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'
  }).format(new Date(Date.UTC(y,m-1,d)));
}

export function scheduleFixtureDates(fixtures,firstMatchDate){
  if(!Array.isArray(fixtures)||!isCareerDate(firstMatchDate))throw new Error('CAREER_FIXTURE_DATE_INVALID');
  for(let i=0;i<fixtures.length;i++){
    const date=addDaysISO(firstMatchDate,i*7);
    fixtures[i].date=date;
    for(const match of fixtures[i].matches??[])match.date=date;
  }
  return fixtures;
}

export function ensureCareerDates(w,{today=todayISO()}={}){
  if(!w||!Array.isArray(w.fixtures))throw new Error('CAREER_DATE_WORLD');
  const logicalDay=Number.isSafeInteger(w.careerDay)&&w.careerDay>=0
    ?w.careerDay
    :Number.isSafeInteger(w.advancedV1?.clockDay)&&w.advancedV1.clockDay>=0
      ?w.advancedV1.clockDay
      :Math.max(0,(Number.isSafeInteger(w.round)?w.round:0)*7);
  const rawStarted=typeof w.startedAt==='string'&&isCareerDate(w.startedAt.slice(0,10))?w.startedAt.slice(0,10):today;
  const current=isCareerDate(w.currentDate)?w.currentDate:addDaysISO(rawStarted,logicalDay);
  const seasonStart=isCareerDate(w.seasonStartDate)?w.seasonStartDate:addDaysISO(current,-Math.max(0,(Number.isSafeInteger(w.round)?w.round:0)*7));
  const first=isCareerDate(w.firstMatchDate)?w.firstMatchDate:addDaysISO(seasonStart,7);
  w.careerDay=logicalDay;
  w.currentDate=current;
  w.seasonStartDate=seasonStart;
  w.firstMatchDate=first;
  scheduleFixtureDates(w.fixtures,first);
  return w;
}

export function openNextSeasonDates(w){
  ensureCareerDates(w);
  w.seasonStartDate=w.currentDate;
  w.firstMatchDate=addDaysISO(w.currentDate,7);
  scheduleFixtureDates(w.fixtures,w.firstMatchDate);
  return w;
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

export function nextFixtureDate(w){
  return pendingFixtureDay(w)?.date??null;
}
