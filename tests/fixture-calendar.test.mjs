import test from 'node:test';
import assert from 'node:assert/strict';
import {LEAGUES,getLeagueClubs} from '../src/leagues.js';
import {generateFixtureCalendar,generateCompetitionFixtures} from '../src/fixture-calendar.js';

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
