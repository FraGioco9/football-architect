import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEAGUES,getLeagueClubs,COUNTRIES,COMPETITIONS,countryById,competitionById,getCountryCompetitions,isSelectableCompetition,getCountryClubs,getCompetitionClubs,getClub} from '../src/leagues.js';
import {SAVE_KEY,DEFAULT_TIME,validDate,validTime,localToday,createSession,validSession,advanceSession,advanceMinutes,sessionTime,seasonLabel,seasonNumber,readSession,writeSession,clubFor} from '../src/simulation.js';
import {seasonOpeningYear,preseasonStart,seasonCalendar,transferMarket,transferMarketFor} from '../src/season-calendar.js';
import {layout,simulationPage,calendarPage} from '../src/ui-pages.js';
import {nextScheduledClubFixture,scheduleCompetitionFixtures,createFixtureCalendarCache} from '../src/fixture-calendar.js';

test('eight real countries each expose 20 invented clubs with unique identities',()=>{
 assert.equal(LEAGUES.length,8);
 assert.equal(new Set(LEAGUES.map(x=>x.id)).size,8);
 for(const league of LEAGUES){
  const clubs=getLeagueClubs(league.id);
  assert.equal(clubs.length,20,league.id);
  assert.equal(new Set(clubs.map(c=>c.id)).size,20);
  assert.ok(clubs.every(c=>c.name&&c.city&&c.countryId===league.id));
 }
});
test('create session requires a real listed club and stores only minimal fields',()=>{
 const s=createSession('IT',2,'2026-10-08');
 assert.equal(s.clubId,2);assert.equal(s.countryId,'IT');
 assert.equal(s.date,'2026-10-08');assert.ok(validSession(s));
 assert.equal(Object.keys(s).sort().join(','),'clubId,countryId,date,daysElapsed,startedAt,time,version');
 assert.equal(s.time,'08:00');
 assert.throws(()=>createSession('UNLISTED',2,'2026-10-08'));
 assert.throws(()=>createSession('IT',21,'2026-10-08'));
 assert.ok(clubFor(s)?.name.includes('Bologna'));
});
test('advancing the calendar does not generate matches, fixtures, scores or results',()=>{
 let s=createSession('IT',1,'2026-10-08');
 for(const days of [1,7,30,365])s=advanceSession(s,days);
 assert.equal(s.daysElapsed,403);
 assert.equal(s.date,'2027-11-15');
 assert.equal(seasonLabel(s.date),'2027/28');
 assert.ok(!JSON.stringify(s).match(/fixture|match|result|score|leagueTable/i));
 assert.ok(validSession(s));
});
test('leap days and July season boundaries are correct',()=>{
 assert.equal(advanceSession(createSession('FR',5,'2028-02-28'),1).date,'2028-02-29');
 assert.equal(advanceSession(createSession('FR',5,'2028-02-28'),2).date,'2028-03-01');
 assert.equal(seasonLabel('2026-06-30'),'2025/26');
 assert.equal(seasonLabel('2026-07-01'),'2026/27');
 assert.equal(localToday(new Date(2026,9,8)),'2026-10-08');
});
test('storage keeps only a new isolated key and rejects corrupt data without deleting it',()=>{
 const data=new Map([['football-architect:career:v1','old-save-unchanged']]);
 const store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 assert.equal(readSession(store),null);
 const s=createSession('BR',9,'2026-10-08');
 writeSession(store,s);
 assert.deepEqual(readSession(store),s);
 assert.equal(data.get('football-architect:career:v1'),'old-save-unchanged');
 data.set(SAVE_KEY,'{invalid');
 assert.equal(readSession(store),null);
 assert.equal(data.get(SAVE_KEY),'{invalid');
});
test('saved states reject impossible or manipulated dates and arbitrary hidden game data',()=>{
 const s=createSession('NL',3,'2026-10-08');
 for(const change of [{date:'2026-11-08'},{daysElapsed:2},{countryId:'ZZ'},{fixtures:[]},{version:2}]){
  assert.equal(validSession({...s,...change}),false,JSON.stringify(change));
 }
 assert.equal(validDate('2026-02-30'),false);
 assert.throws(()=>advanceSession(s,0));
 assert.throws(()=>advanceSession(s,366));
});
test('all eight countries can advance a whole decade without any game events',()=>{
 for(const league of LEAGUES){
  let state=createSession(league.id,20,'2026-10-08');
  for(let i=0;i<10;i++)state=advanceSession(state,365);
  assert.equal(state.daysElapsed,3650);
  assert.ok(validSession(state));
  assert.equal(Object.keys(state).length,7);
 }
});
test('HTML contains only the required minimal application modules',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('/src/main.js'));
 assert.ok(html.includes('/src/styles.css'));
 assert.ok(!html.match(/match-|addon|dashboard|roadmap|issue/i));
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.ok(!server.includes('router.js'));
 assert.ok(server.includes("'/simulation'"));
 // Missing imported JS modules leave the server's static loading screen visible.
 assert.match(server, /\['\/src\/season-calendar\.js','text\/javascript; charset=utf-8'\]/);
 assert.match(readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),/from '\.\/season-calendar\.js'/);
});

test('CAL-01: new careers start in the latest July preseason, never on an arbitrary current day',()=>{
 assert.equal(preseasonStart('2026-10-09'),'2026-07-01');
 assert.equal(preseasonStart('2026-07-01'),'2026-07-01');
 assert.equal(preseasonStart('2027-01-12'),'2026-07-01');
 assert.equal(preseasonStart('2028-06-30'),'2027-07-01');
 assert.equal(preseasonStart('2028-07-01'),'2028-07-01');
 assert.equal(seasonOpeningYear('2027-02-05'),2026);
 for(const bad of ['not-a-date','2027-02-30','2026-13-01',''])assert.throws(()=>preseasonStart(bad));
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/session:createSession\(draft\.countryId,draft\.clubId,preseasonStart\(localToday\(\)\)\)/);
});

test('CAL-01: derived calendar distinguishes preseason, season and break at exact ISO day boundaries',()=>{
 const expectations=[
  ['2026-07-01','preseason',1],
  ['2026-08-14','preseason',1],
  ['2026-08-15','season',1],
  ['2026-12-31','season',1],
  ['2027-01-01','season',1],
  ['2027-05-31','season',1],
  ['2027-06-01','offseason',1],
  ['2027-06-30','offseason',1],
  ['2027-07-01','preseason',1]
 ];
 for(const [date,phase,season] of expectations){
  const calendar=seasonCalendar(date,date<'2027-07-01'?'2026-07-01':'2027-07-01');
  assert.equal(calendar.phase,phase,date);
  assert.equal(calendar.season,season,date);
  assert.equal(calendar.preseasonStart,(date<'2027-07-01'?'2026':'2027')+'-07-01');
  assert.ok(Object.isFrozen(calendar));
 }
});

test('CAL-01: leap years and long advances preserve the valid clock-aware v1 save shape',()=>{
 let state=createSession('IT',2,preseasonStart('2028-05-20'));
 assert.equal(state.startedAt,'2027-07-01');
 const originalKeys=Object.keys(state).sort();
 const original={...state};
 for(let n=0;n<3;n++)state=advanceSession(state,365);
 assert.deepEqual(Object.keys(state).sort(),originalKeys);
 assert.equal(validSession(state),true);
 assert.equal(validSession(original),true);
 assert.equal(seasonCalendar('2028-02-29').phase,'season');
 assert.equal(seasonCalendar('2028-02-29','2027-07-01').season,1);
 assert.equal(original.startedAt,'2027-07-01');
 assert.ok(!('fixtures' in state));
 assert.ok(!('matchResults' in state));
});

test('CAL-01: seasonal panel is bilingual, responsive and never invents fixtures or results',()=>{
 const meta={managerName:'QA Test',countryId:'IT',clubId:2};
 const preseason=createSession('IT',2,'2026-07-01');
 for(const lang of ['it','en']){
  const html=simulationPage(meta,preseason,lang,false);
  assert.match(html,/class="panel fa-season-calendar"/);
  assert.match(html,/class="fa-season-milestones"/);
  assert.equal((html.match(/class="fa-season-milestone /g)||[]).length,3);
  assert.equal((html.match(/class="fa-season-milestone is-current"/g)||[]).length,1);
  assert.match(html,lang==='it'?/Calendario stagionale/:/Season calendar/);
  assert.match(html,lang==='it'?/Prestagione/:/Preseason/);
  assert.match(html,lang==='it'?/Date e orari delle partite sono programmati/:/Match dates and kick-off times are scheduled/);
  assert.ok(!html.includes('data-action="play-match"'));
 }
 const summer=simulationPage(meta,createSession('IT',2,'2027-06-15'),'en',false);
 assert.match(summer,/Summer break/);
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.fa-season-milestones\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:620px\)\{\.fa-season-milestones\{grid-template-columns:minmax\(0,1fr\)/);
});


test('CAL-01 clock: 1 July 08:00 new session, hourly advance and midnight rollover',()=>{
 let s=createSession('IT',2,'2026-07-01');
 assert.equal(s.time,DEFAULT_TIME);
 assert.equal(sessionTime(s),'08:00');
 assert.equal(seasonNumber(s),1);
 s=advanceMinutes(s,60);
 assert.equal(s.time,'09:00');assert.equal(s.daysElapsed,0);
 s=advanceMinutes(s,15*60);
 assert.equal(s.time,'00:00');assert.equal(s.date,'2026-07-02');
 assert.equal(s.daysElapsed,1);
 s=advanceMinutes(s,7*60+30);
 assert.equal(s.time,'07:30');
 assert.equal(advanceSession(s,1).time,'07:30');
 assert.equal(validSession(s),true);
 assert.equal(seasonNumber(advanceSession(createSession('IT',2,'2026-07-01'),365)),2);
});
test('CAL-01 transfer window: July/August through 31 August midnight, and all January',()=>{
 const scenarios=[
  ['2026-06-30','23:59',null,false],
  ['2026-07-01','00:00','summer',true],
  ['2026-08-31','23:59','summer',true],
  ['2026-09-01','00:00',null,false],
  ['2026-12-31','23:59',null,false],
  ['2027-01-01','00:00','winter',true],
  ['2027-01-31','23:59','winter',true],
  ['2027-02-01','00:00',null,false],
  ['2028-02-29','12:00',null,false]
 ];
 for(const [date,time,window,open] of scenarios){
  const market=transferMarket(date,time);
  assert.equal(market.window,window,date+' '+time);
  assert.equal(market.open,open,date+' '+time);
  assert.ok(Object.isFrozen(market));
 }
 assert.equal(transferMarket('2026-08-31','23:59').closesAt,'2026-09-01T00:00');
 assert.equal(transferMarket('2027-01-31','23:59').closesAt,'2027-02-01T00:00');
 const aug=advanceMinutes(createSession('IT',2,'2026-08-31','23:59'),1);
 assert.equal(aug.date,'2026-09-01');assert.equal(aug.time,'00:00');
 assert.equal(transferMarketFor(aug).open,false);
 const jan=advanceMinutes(createSession('DE',6,'2027-01-31','23:59'),1);
 assert.equal(transferMarketFor(jan).open,false);
 assert.equal(transferMarketFor(createSession('IT',2,'2026-07-01')).open,true);
 assert.throws(()=>transferMarket('2026-09-01','24:00'));
});
test('CAL-01 season numbering depends only on career start, not real-world season names',()=>{
 const s=createSession('FR',1,'2026-07-01');
 for(const [date,expected] of [['2026-07-01',1],['2027-06-30',1],['2027-07-01',2],
  ['2028-06-30',2],['2028-07-01',3],['2029-07-01',4],['2030-07-01',5]]){
  const days=Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(s.date+'T00:00:00Z'))/86400000);
  let advanced=s;
  let remaining=days;
  while(remaining>0){const amount=Math.min(365,remaining);advanced=advanceSession(advanced,amount);remaining-=amount;}
  assert.equal(seasonNumber(advanced),expected,date);
  assert.equal(seasonCalendar(date,s.startedAt).season,expected,date);
 }
});
test('CAL-01 legacy snapshots stay valid, display 08:00, and upgrade only when time advances',()=>{
 const legacy={version:1,countryId:'IT',clubId:2,startedAt:'2026-08-15',date:'2026-08-16',daysElapsed:1};
 assert.equal(validSession(legacy),true);
 assert.equal(sessionTime(legacy),'08:00');
 const next=advanceMinutes(legacy,60);
 assert.deepEqual(legacy,{version:1,countryId:'IT',clubId:2,startedAt:'2026-08-15',date:'2026-08-16',daysElapsed:1});
 assert.equal(next.time,'09:00');
 assert.equal(validSession(next),true);
 for(const bad of ['-1:00','24:00','23:60','8:00','25:59'])assert.equal(validTime(bad),false);
 assert.throws(()=>createSession('IT',2,'2026-07-01','24:00'));
 assert.equal(validSession({...next,time:'24:00'}),false);
 assert.equal(validSession({...legacy,untrusted:true}),false);
});
test('CAL-01 UI: real clock and market status with Season 1/2, never year-labelled seasons',()=>{
 const meta={managerName:'QA',countryId:'IT',clubId:2};
 const july=createSession('IT',2,'2026-07-01');
 const it=simulationPage(meta,july,'it',false);
 assert.match(it,/Stagione 1/);
 assert.match(it,/08:00/);
 assert.match(it,/Calciomercato/);
 assert.match(it,/Mercato estivo/);
 assert.match(it,/fa-transfer-status is-open/);
 assert.match(it,/data-action="hour"/);
 assert.doesNotMatch(it,/2026\/27|2027\/28/);
 const en=simulationPage(meta,advanceSession(july,365),'en',false);
 assert.match(en,/Season 2/);
 assert.match(en,/Summer transfer window/);
 assert.match(en,/08:00/);
 const closed=simulationPage(meta,createSession('IT',2,'2026-10-09'),'it',false);
 assert.match(closed,/fa-transfer-status is-closed/);
 assert.match(closed,/Calciomercato chiuso/);
 const ui=readFileSync(new URL('../src/ui-pages.js',import.meta.url),'utf8');
 assert.doesNotMatch(ui,/seasonLabel\(/);
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.fa-transfer-periods\{display:grid/);
 assert.match(css,/@media\(max-width:620px\)\{\.fa-transfer-periods/);
});

test('startup screen restores the pre-reset visual identity without adding legacy game modules',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(html, /<div id="app"><div class="boot" role="status" aria-live="polite">Football <strong>Architect<\/strong><span>Caricamento…<\/span><\/div><\/div>/);
 assert.match(css, /#app > \.boot\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/);
 assert.match(css, /#app > \.boot strong\s*\{[^}]*color:\s*#42d7ac;/);
 assert.match(css, /#app > \.boot span\s*\{[^}]*font-size:\s*12px;/);
 assert.doesNotMatch(html, /match-|addon|dashboard|roadmap|issue/i);
});

test('DIV-02: eight countries map to sixteen distinct named competitions',()=>{
 const secondNames={
  IT:'Lega delle Città',ENG:'Shield League',ES:'Liga de las Regiones',
  DE:'Vereinsliga',FR:'Ligue des Régions',PT:'Liga Atlântica',
  NL:'Bondsklasse',BR:'Liga das Regiões'
 };
 assert.equal(COUNTRIES.length,8);
 assert.equal(COMPETITIONS.length,16);
 assert.equal(new Set(COMPETITIONS.map(c=>c.id)).size,16);
 assert.deepEqual(COUNTRIES.map(c=>c.id),LEAGUES.map(l=>l.id));
 assert.ok(Object.isFrozen(COUNTRIES));
 assert.ok(Object.isFrozen(COMPETITIONS));
 for(const legacy of LEAGUES){
  const country=countryById(legacy.id);
  assert.deepEqual(country.country,legacy.country);
  assert.equal(country.flag,legacy.flag);
  assert.ok(Object.isFrozen(country));
  assert.ok(Object.isFrozen(country.country));
  const first=competitionById(legacy.id+'-1');
  const second=competitionById(legacy.id+'-2');
  assert.deepEqual(COMPETITIONS.filter(c=>c.countryId===legacy.id).map(c=>c.id),[
   legacy.id+'-1',legacy.id+'-2'
  ]);
  assert.deepEqual(getCountryCompetitions(legacy.id).map(c=>c.id),[legacy.id+'-1',legacy.id+'-2']);
  assert.equal(isSelectableCompetition(legacy.id,first.id),true);
  assert.equal(isSelectableCompetition(legacy.id,second.id),false);
  assert.deepEqual([first.tier,second.tier],[1,2]);
  assert.equal(first.name,legacy.competition);
  assert.equal(second.name,secondNames[legacy.id]);
  assert.equal(first.clubCount,20);
  assert.equal(second.clubCount,0);
  assert.equal(first.capacity,20);
  assert.equal(second.capacity,20);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(second));
 }
});

test('DIV-02: all 160 original club identities and existing session schemas remain valid',()=>{
 let count=0;
 for(const legacy of LEAGUES){
  const countryClubs=getCountryClubs(legacy.id);
  const firstClubs=getCompetitionClubs(legacy.id+'-1');
  const former=getLeagueClubs(legacy.id);
  assert.deepEqual(countryClubs,former);
  assert.deepEqual(firstClubs,former);
  assert.deepEqual(getCompetitionClubs(legacy.id+'-2'),[]);
  assert.deepEqual(countryClubs.map(c=>c.id),Array.from({length:20},(_,i)=>i+1));
  for(const club of countryClubs){
   assert.deepEqual(getClub(legacy.id,club.id),club);
   count++;
  }
  const session=createSession(legacy.id,20,'2026-07-01');
  assert.equal(validSession(session),true);
  assert.equal('competitionId' in session,false);
  assert.equal('divisionId' in session,false);
  const legacySnapshot={version:1,countryId:legacy.id,clubId:1,
   startedAt:'2026-07-01',date:'2026-07-01',daysElapsed:0};
  assert.equal(validSession(legacySnapshot),true);
  assert.equal(clubFor(legacySnapshot).id,1);
 }
 assert.equal(count,160);
 assert.equal(LEAGUES.length,8); // DIV-04 alone may change the UI.
});

test('DIV-02: new lookup API rejects unknown IDs without falling back to Italy',()=>{
 assert.equal(countryById('IT-1'),null);
 assert.equal(countryById('XX'),null);
 assert.equal(competitionById('IT'),null);
 assert.equal(competitionById('IT-3'),null);
 assert.equal(competitionById('XX-1'),null);
 assert.deepEqual(getCountryCompetitions('XX'),[]);
 assert.equal(isSelectableCompetition('XX','IT-1'),false);
 assert.equal(isSelectableCompetition('ENG','IT-1'),false);
 assert.equal(isSelectableCompetition('IT','IT'),false);
 assert.equal(isSelectableCompetition('IT','IT-2'),false);
 assert.throws(()=>getCountryClubs('XX'),RangeError);
 assert.throws(()=>getCountryClubs(undefined),RangeError);
 assert.throws(()=>getCompetitionClubs('XX-1'),RangeError);
 assert.throws(()=>getCompetitionClubs('IT'),RangeError);
 assert.equal(getClub('XX',1),null);
 assert.equal(getClub('IT',0),null);
 assert.equal(getClub('IT',21),null); // DIV-03 not implemented.
 assert.equal(getClub('IT',1)?.countryId,'IT');
 assert.equal(getLeagueClubs().length,20); // Legacy API contract unchanged.
});

test('CAL-02.3: chronological next kickoff stays selected at equality and moves after one minute',()=>{
 const year=2026,country='IT',calendar=scheduleCompetitionFixtures('IT-1',year);
 const all=calendar.matchdays.flatMap(d=>d.fixtures);
 const first=[...all].sort((a,b)=>(a.date+'T'+a.time).localeCompare(b.date+'T'+b.time)||a.id.localeCompare(b.id))[0];
 const start=createSession(country,first.homeClubId,first.date,first.time);
 assert.equal(nextScheduledClubFixture(start).id,first.id);
 const next=advanceMinutes(start,1);
 assert.notEqual(nextScheduledClubFixture(next).id,first.id);
 assert.deepEqual(Object.keys(next).sort(),Object.keys(start).sort());
 assert.equal(validSession(next),true);
});

test('CAL-02.3: before kickoff, after kickoff and long advances never create results',()=>{
 const calendar=scheduleCompetitionFixtures('FR-1',2026);
 const fixture=calendar.matchdays.flatMap(d=>d.fixtures).find(f=>f.homeClubId===4||f.awayClubId===4);
 const at=createSession('FR',4,fixture.date,fixture.time);
 const before=advanceMinutes(createSession('FR',4,fixture.date,'00:00'),
  Number(fixture.time.slice(0,2))*60+Number(fixture.time.slice(3))-1);
 assert.equal(nextScheduledClubFixture(before).id,fixture.id);
 assert.equal(nextScheduledClubFixture(at).id,fixture.id);
 const after=advanceMinutes(at,1);
 assert.notEqual(nextScheduledClubFixture(after).id,fixture.id);
 const yearsLater=advanceSession(createSession('FR',4,'2026-07-01'),365);
 assert.ok(nextScheduledClubFixture(yearsLater));
 assert.equal(validSession(yearsLater),true);
 for(const state of [before,at,after,yearsLater]){
  assert.ok(!('fixtures' in state)&&!('results' in state)&&!('matchResults' in state));
 }
});

test('CAL-02.3: winter pause, June and July select the next scheduled game',()=>{
 for(const country of ['IT','BR']){
  for(const [date,time,year] of [
   ['2026-12-24','08:00',2026],['2027-01-02','23:00',2026],
   ['2027-06-01','00:00',2027],['2027-06-30','23:59',2027],
   ['2027-07-01','08:00',2027],['2028-02-29','12:00',2027]
  ]){
   const state=createSession(country,2,date,time);
   const item=nextScheduledClubFixture(state);
   assert.ok(item,country+' '+date);
   assert.equal(item.seasonYear,year);
   assert.ok(item.date+'T'+item.time>=state.date+'T'+time);
   assert.ok(!('score' in item)&&!('result' in item));
  }
 }
});

test('CAL-02.3: legacy saves and saved session schema remain untouched',()=>{
 const modern=createSession('IT',2,'2026-07-01');
 const legacy={...modern};delete legacy.time;
 assert.equal(validSession(legacy),true);
 assert.equal(nextScheduledClubFixture(legacy).id,nextScheduledClubFixture(modern).id);
 const original={...modern};
 const fixture=nextScheduledClubFixture(modern);
 assert.deepEqual(modern,original);
 assert.ok(Object.isFrozen(fixture));
 assert.deepEqual(Object.keys(modern).sort(),
 ['version','countryId','clubId','startedAt','date','daysElapsed','time'].sort());
});

test('CAL-02.3: bounded cache is keyed by competition and season without cross-career leakage',()=>{
 const calls=[];
 const generated=(id,year)=>{calls.push(id+':'+year);return Object.freeze({id,year});};
 const cache=createFixtureCalendarCache(2,generated);
 const it=cache('IT-1',2026);
 assert.strictEqual(cache('IT-1',2026),it);
 const br=cache('BR-1',2026);
 assert.notStrictEqual(br,it);
 assert.strictEqual(cache('IT-1',2026),it); // refreshed LRU
 cache('IT-1',2027); // evicts BR
 assert.strictEqual(cache('IT-1',2026),it);
 assert.notStrictEqual(cache('BR-1',2026),br);
 assert.equal(calls.length,4);
 assert.throws(()=>createFixtureCalendarCache(0),/cache size/);
});

test('CAL-02.3: projected match renders only a scheduled preview in IT and EN',()=>{
 const state=createSession('IT',2,'2026-07-01');
 const fixture=nextScheduledClubFixture(state);
 const meta={managerName:'Test Manager',countryId:'IT',clubId:2};
 for(const lang of ['it','en']){
  const html=simulationPage(meta,state,lang,false,fixture);
  assert.match(html,/class="panel fa-next-fixture"/);
  assert.match(html,lang==='it'?/Prossima partita/:/Next match/);
  assert.match(html,lang==='it'?/PROGRAMMATA/:/SCHEDULED/);
  assert.ok(html.includes(fixture.time));
  assert.ok(!html.includes('data-action="play-match"'));
  assert.doesNotMatch(html,/\b(?:score|live|final score)\b|risultati|classifica/i);
 }
});


test('CAL-02.4: 38 matchdays and all 380 immutable scheduled fixtures are visible by round',()=>{
 const calendar=scheduleCompetitionFixtures('IT-1',2026);
 const state=createSession('IT',2,'2026-10-01');
 const meta={countryId:'IT',clubId:2,managerName:'Tester'};
 let total=0;
 for(let round=1;round<=38;round++){
  const html=calendarPage(meta,state,'it',calendar,{view:'round',filter:'all',month:'2026-10',round});
  assert.match(html,/Giornata /);
  assert.match(html,/Incontri · 10/);
  assert.equal((html.match(/<li class="fa-fixture-item(?: is-club)?">/g)||[]).length,10);
  assert.doesNotMatch(html,/\bscore\b|classifica|risultati/i);
  total+=10;
 }
 assert.equal(total,380);
});

test('CAL-02.4: my club shows exactly one immutable fixture per round',()=>{
 const calendar=scheduleCompetitionFixtures('BR-1',2028);
 const state=createSession('BR',8,'2028-10-01');
 const meta={countryId:'BR',clubId:8,managerName:'Manager'};
 let shown=0;
 for(let round=1;round<=38;round++){
  const html=calendarPage(meta,state,'en',calendar,{view:'round',filter:'club',month:'2028-10',round});
  assert.match(html,/Matches · 1/);
  shown+=(html.match(/<li class="fa-fixture-item(?: is-club)?">/g)||[]).length;
 }
 assert.equal(shown,38);
 assert.ok(!('fixtures' in state));
});

test('CAL-02.4: month view has correct number of days, chronology and daylight-independent markers',()=>{
 const calendar=scheduleCompetitionFixtures('IT-1',2027),meta={countryId:'IT',clubId:3},state=createSession('IT',3,'2028-02-29');
 for(const [month,days] of [['2027-09',30],['2028-02',29],['2028-04',30],['2028-05',31],['2028-06',30]]){
  const html=calendarPage(meta,state,'it',calendar,{view:'month',filter:'all',month});
  assert.equal((html.match(/data-action="fixture-day"/g)||[]).length,days);
  assert.ok(html.includes('data-action="fixture-month-prev"'));
  assert.ok(html.includes('data-action="fixture-month-next"'));
 }
 const feb=calendarPage(meta,state,'en',calendar,{view:'month',filter:'all',month:'2028-02'});
 assert.match(feb,/data-date="2028-02-29"/);
 const selected=calendarPage(meta,state,'en',calendar,{view:'month',filter:'all',month:'2028-02',day:'2028-02-29'});
 assert.match(selected,/data-action="fixture-day-clear"/);
 assert.match(selected,/aria-pressed="true"/);
});

test('CAL-02.4: month and day filters are subsets of the deterministic fixture inventory',()=>{
 const cal=scheduleCompetitionFixtures('FR-1',2026),meta={countryId:'FR',clubId:4},state=createSession('FR',4,'2026-07-01');
 const fixtures=cal.matchdays.flatMap(d=>d.fixtures);
 const month='2026-10';
 const dates=[...new Set(fixtures.filter(f=>f.date.startsWith(month)).map(f=>f.date))];
 const all=calendarPage(meta,state,'en',cal,{view:'month',month,filter:'all'});
 const mine=calendarPage(meta,state,'en',cal,{view:'month',month,filter:'club'});
 const inMonth=fixtures.filter(f=>f.date.startsWith(month));
 const myCount=inMonth.filter(f=>f.homeClubId===4||f.awayClubId===4).length;
 assert.equal((all.match(/<li class="fa-fixture-item(?: is-club)?">/g)||[]).length,inMonth.length);
 assert.equal((mine.match(/<li class="fa-fixture-item(?: is-club)?">/g)||[]).length,myCount);
 for(const date of dates){
  const day=calendarPage(meta,state,'en',cal,{view:'month',month,day:date,filter:'all'});
  assert.equal((day.match(/<li class="fa-fixture-item(?: is-club)?">/g)||[]).length,fixtures.filter(f=>f.date===date).length);
 }
 const winter=calendarPage(meta,state,'en',cal,{view:'month',month:'2026-12',day:'2026-12-25',filter:'all'});
 assert.match(winter,/No matches in this selection/);
});

test('CAL-02.4: bilingual controls, selection styling, no match simulation and untouched save',()=>{
 const state=createSession('PT',1,'2026-08-01'),snapshot=JSON.stringify(state);
 const meta={countryId:'PT',clubId:1,managerName:'Coach'};
 const calendar=scheduleCompetitionFixtures('PT-1',2026);
 const it=calendarPage(meta,state,'it',calendar,{view:'month',filter:'club',month:'2026-08'});
 const en=calendarPage(meta,state,'en',calendar,{view:'round',filter:'all',month:'2026-08',round:1});
 assert.match(it,/Calendario partite/);
 assert.match(it,/La mia squadra/);
 assert.match(it,/Tutte le partite/);
 assert.match(en,/Match calendar/);
 assert.match(en,/All matches/);
 assert.match(en,/Rounds/);
 const shell=layout(it,'it',null,false,{route:'/calendar',meta,state,playing:false});
 assert.match(shell,/data-action="career-dashboard"/);
 assert.match(shell,/data-action="fixture-open"/);
 assert.doesNotMatch(it,/data-action="play-match"|data-action="simulate-match"|matchEngine/i);
 assert.equal(JSON.stringify(state),snapshot);
 assert.ok(calendar.matchdays.every(d=>Object.isFrozen(d.fixtures)));
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/case 'fixture-open'/);
 assert.match(source,/case 'fixture-month-prev'/);
 assert.match(source,/case 'fixture-day'/);
 assert.match(source,/case 'fixture-round-next'/);
 assert.match(source,/fixtureCalendarFor\(loaded.state.countryId\+'-1',seasonYear\)/);
});

test('CAL-02.4: responsive 320/390 contracts keep a 7-column grid with no nested scrolling',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.fa-fixture-calendar-grid\{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:390px\)\{/);
 assert.match(css,/\.fa-fixture-day\{min-height:40px/);
 assert.doesNotMatch(css,/\.fa-fixture-(?:results|items|calendar)\s*\{[^}]*overflow-y:\s*(?:auto|scroll)/);
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.ok(server.includes("'/calendar'"));
});


test('UX-SHELL: routes and source avoid restoring pre-reset match engine',()=>{
 const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.ok(src.includes("'/dashboard'"));
 assert.ok(server.includes("'/dashboard'"));
 assert.doesNotMatch(src,/simulateMatch|playMatchday|matchEngine|newSeason/);
 assert.doesNotMatch(server,/\/match\/\d|\/squad|\/training|\/tactics/);
});
