import test from 'node:test';
import assert from 'node:assert/strict';
import {LEAGUES,getLeagueClubs} from '../src/leagues.js';
import {generateFixtureCalendar,generateCompetitionFixtures,scheduleCompetitionFixtures} from '../src/fixture-calendar.js';

function verifySeason(countryId,year){
  const competitionId=countryId+'-1';
  const calendar=generateCompetitionFixtures(competitionId,year);
  const ids=new Set(getLeagueClubs(countryId).map(club=>club.id));
  const home=new Map([...ids].map(id=>[id,0]));
  const away=new Map([...ids].map(id=>[id,0]));
  const opponents=new Map();
  const fixtureIds=new Set();

  assert.equal(calendar.competitionId,competitionId);
  assert.equal(calendar.seasonYear,year);
  assert.equal(calendar.matchdays.length,38);
  assert.ok(Object.isFrozen(calendar));
  assert.ok(Object.isFrozen(calendar.matchdays));

  for(const [index,day] of calendar.matchdays.entries()){
    assert.equal(day.number,index+1);
    assert.equal(day.fixtures.length,10);
    assert.ok(Object.isFrozen(day));
    assert.ok(Object.isFrozen(day.fixtures));
    const playing=new Set();
    for(const fixture of day.fixtures){
      assert.ok(Object.isFrozen(fixture));
      assert.equal(fixture.competitionId,competitionId);
      assert.equal(fixture.seasonYear,year);
      assert.equal(fixture.matchday,index+1);
      assert.ok(ids.has(fixture.homeClubId));
      assert.ok(ids.has(fixture.awayClubId));
      assert.notEqual(fixture.homeClubId,fixture.awayClubId);
      assert.ok(!playing.has(fixture.homeClubId),'Club plays twice on one matchday');
      assert.ok(!playing.has(fixture.awayClubId),'Club plays twice on one matchday');
      playing.add(fixture.homeClubId);
      playing.add(fixture.awayClubId);
      assert.ok(!fixtureIds.has(fixture.id),'Duplicate fixture ID');
      fixtureIds.add(fixture.id);
      home.set(fixture.homeClubId,home.get(fixture.homeClubId)+1);
      away.set(fixture.awayClubId,away.get(fixture.awayClubId)+1);
      const unordered=[fixture.homeClubId,fixture.awayClubId].sort((a,b)=>a-b).join(':');
      const seen=opponents.get(unordered)||[];
      seen.push(fixture);
      opponents.set(unordered,seen);
      assert.deepEqual(Object.keys(fixture).sort(),
        ['awayClubId','competitionId','homeClubId','id','matchday','seasonYear'].sort(),
        'CAL-02.1 must not introduce dates, results or match state');
    }
    assert.equal(playing.size,20);
  }

  assert.equal(fixtureIds.size,380);
  assert.equal(opponents.size,190);
  for(const id of ids){
    assert.equal(home.get(id),19,`home games for ${id}`);
    assert.equal(away.get(id),19,`away games for ${id}`);
  }
  for(const pair of opponents.values()){
    assert.equal(pair.length,2);
    assert.equal(pair[0].matchday<=19,true);
    assert.equal(pair[1].matchday,pair[0].matchday+19);
    assert.equal(pair[0].homeClubId,pair[1].awayClubId);
    assert.equal(pair[0].awayClubId,pair[1].homeClubId);
  }
  return calendar;
}

test('CAL-02.1: eight countries have 38 matchdays and 380 balanced, complete fixtures across years',()=>{
  assert.equal(LEAGUES.length,8);
  for(const league of LEAGUES){
    for(const year of [2026,2027,2028,2032])verifySeason(league.id,year);
  }
});

test('CAL-02.1: deterministic across calls and independent of club input ordering',()=>{
  const original=getLeagueClubs('IT').map(club=>club.id);
  const props={competitionId:'IT-1',seasonYear:2026,clubIds:original};
  const first=generateFixtureCalendar(props);
  assert.deepEqual(first,generateFixtureCalendar(props));
  assert.deepEqual(first,generateFixtureCalendar({...props,clubIds:[...original].reverse()}));
  assert.deepEqual(first,generateCompetitionFixtures('IT-1',2026));
  assert.notDeepEqual(first,generateFixtureCalendar({...props,seasonYear:2027}));
  assert.notDeepEqual(first,generateFixtureCalendar({...props,competitionId:'IT-2'}));
  assert.deepEqual(original,getLeagueClubs('IT').map(club=>club.id),'Input club IDs must not be modified');
});

test('CAL-02.1: malformed competitions, years and clubs fail instead of returning partial schedules',()=>{
  const ids=Array.from({length:20},(_,i)=>i+1);
  const props={competitionId:'IT',seasonYear:2026,clubIds:ids};
  for(const bad of [
    {...props,competitionId:''},{...props,competitionId:'it'},
    {...props,seasonYear:2026.5},{...props,seasonYear:1899},
    {...props,clubIds:ids.slice(1)},{...props,clubIds:[...ids.slice(1),1.25]},
    {...props,clubIds:[...ids.slice(1),2]},
    {...props,clubIds:[...ids.slice(1),-1]}
  ])assert.throws(()=>generateFixtureCalendar(bad));
  assert.throws(()=>generateFixtureCalendar());
  assert.throws(()=>generateCompetitionFixtures('UNKNOWN',2026));
  assert.throws(()=>generateCompetitionFixtures('IT-2',2026));
});

test('CAL-02.1: fixture generator is pure and does not touch CAL-01 persistence or the clock',()=>{
  const fixture=generateCompetitionFixtures('BR-1',2026).matchdays[0].fixtures[0];
  assert.ok(!('date' in fixture));
  assert.ok(!('time' in fixture));
  assert.ok(!('score' in fixture));
  assert.ok(!('result' in fixture));
});

const FIXTURE_DAY=86400000;
const DATE_SLOTS=Object.freeze({
 0:['12:30','15:00','18:00','20:45'],
 1:['20:45'],2:['18:30','20:45'],3:['18:30','20:45'],
 4:['18:30','20:45'],5:['20:45'],
 6:['12:30','15:00','18:00','20:45']
});
function inspectScheduledCalendar(competitionId,year,strategy='varied'){
 const source=generateCompetitionFixtures(competitionId,year);
 const calendar=scheduleCompetitionFixtures(competitionId,year,{strategy});
 assert.ok(Object.isFrozen(calendar));
 assert.ok(Object.isFrozen(calendar.matchdays));
 assert.equal(calendar.matchdays.length,38);
 const visits=new Map();
 let count=0,previousRoundEnd=-Infinity,midweekRounds=0;
 const usedDays=new Set();
 for(let i=0;i<38;i++){
  const round=calendar.matchdays[i],old=source.matchdays[i];
  assert.equal(round.number,old.number);
  assert.ok(Object.isFrozen(round));
  assert.ok(Object.isFrozen(round.fixtures));
  assert.equal(round.fixtures.length,10);
  let first=Infinity,last=-Infinity,midweek=false;
  for(let j=0;j<10;j++){
   const f=round.fixtures[j],original=old.fixtures[j];
   assert.ok(Object.isFrozen(f));
   const {date,time,...pairing}=f;
   assert.deepEqual(pairing,original);
   assert.deepEqual(Object.keys(f).sort(),
    ['id','competitionId','seasonYear','matchday','homeClubId','awayClubId','date','time'].sort());
   assert.match(date,/^\d{4}-\d{2}-\d{2}$/);
   assert.match(time,/^\d{2}:\d{2}$/);
   const stamp=Date.parse(date+'T'+time+':00Z'),dayStamp=Date.parse(date+'T00:00:00Z');
   assert.ok(Number.isFinite(stamp));
   assert.equal(new Date(dayStamp).toISOString().slice(0,10),date);
   assert.ok(dayStamp>=Date.UTC(year,7,15)&&dayStamp<=Date.UTC(year+1,4,31));
   assert.ok(!(date>=year+'-12-24'&&date<=(year+1)+'-01-02'));
   const weekday=new Date(stamp).getUTCDay();
   assert.ok(DATE_SLOTS[weekday].includes(time),'Unexpected slot '+date+' '+time);
   usedDays.add(weekday);
   if([2,3,4].includes(weekday))midweek=true;
   if(strategy==='conservative')assert.equal(weekday,6);
   first=Math.min(first,stamp);last=Math.max(last,stamp);
   for(const clubId of [f.homeClubId,f.awayClubId]){
    const prior=visits.get(clubId);
    if(prior!==undefined)assert.ok(stamp-prior>=72*3600000,'Insufficient club rest');
    visits.set(clubId,stamp);
   }
   count++;
  }
  assert.ok(first-previousRoundEnd>=72*3600000,'Overlapping rounds');
  previousRoundEnd=last;
  if(midweek)midweekRounds++;
 }
 assert.equal(count,380);
 assert.equal(visits.size,20);
 if(strategy==='varied'){
  assert.equal(midweekRounds,4,'Four midweek matchdays expected');
  for(const weekday of [2,3,4])assert.ok(usedDays.has(weekday),'Missing midweek day '+weekday);
  assert.ok(usedDays.has(6)&&usedDays.has(0),'Weekend dates missing');
 }
 return calendar;
}

test('CAL-02.2: universal slots and exact 72h rest across eight countries and leap years',()=>{
 for(const league of LEAGUES){
  for(const year of [2026,2027,2028,2032,2099,2100])
   inspectScheduledCalendar(league.id+'-1',year);
 }
});

test('CAL-02.2: conservative Saturday-only fallback passes every hard invariant',()=>{
 for(const league of LEAGUES)
  for(const year of [2026,2028,2100])
   inspectScheduledCalendar(league.id+'-1',year,'conservative');
});

test('CAL-02.2: dates are deterministic and CAL-02.1 data stays unchanged',()=>{
 const source=generateCompetitionFixtures('IT-1',2026);
 const first=scheduleCompetitionFixtures('IT-1',2026);
 assert.deepEqual(first,scheduleCompetitionFixtures('IT-1',2026));
 assert.notDeepEqual(first,scheduleCompetitionFixtures('IT-1',2027));
 assert.deepEqual(source,generateCompetitionFixtures('IT-1',2026));
 const brazil=scheduleCompetitionFixtures('BR-1',2026);
 assert.ok(brazil.matchdays.some(d=>d.fixtures.some(f=>typeof f.date==='string'&&typeof f.time==='string')));
 assert.ok(brazil.matchdays.every(d=>d.fixtures.every(f=>!('score' in f)&&!('result' in f))));
});

test('CAL-02.2: a full 400-year Gregorian cycle remains schedulable',()=>{
 for(let year=2000;year<2400;year++){
  const calendar=scheduleCompetitionFixtures('IT-1',year);
  assert.equal(calendar.matchdays.length,38);
  const fallback=scheduleCompetitionFixtures('IT-1',year,{strategy:'conservative'});
  assert.equal(fallback.matchdays.length,38);
  for(const item of [calendar,fallback]){
   for(let i=1;i<38;i++){
    const prev=Math.max(...item.matchdays[i-1].fixtures.map(f=>Date.parse(f.date+'T'+f.time+':00Z')));
    const next=Math.min(...item.matchdays[i].fixtures.map(f=>Date.parse(f.date+'T'+f.time+':00Z')));
    assert.ok(next-prev>=72*3600000);
   }
  }
 }
});

test('CAL-02.2: invalid seasons or incomplete second divisions cannot be scheduled',()=>{
 assert.throws(()=>scheduleCompetitionFixtures('IT-2',2026));
 assert.throws(()=>scheduleCompetitionFixtures('INVALID',2026));
 assert.throws(()=>scheduleCompetitionFixtures('IT-1',2026.5));
 assert.throws(()=>scheduleCompetitionFixtures('IT-1',2026,{strategy:'unknown'}));
});
