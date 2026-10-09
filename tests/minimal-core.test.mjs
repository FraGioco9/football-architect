import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEAGUES,getLeagueClubs,COUNTRIES,COMPETITIONS,countryById,competitionById,getCountryClubs,getCompetitionClubs,getClub} from '../src/leagues.js';
import {SAVE_KEY,DEFAULT_TIME,validDate,validTime,localToday,createSession,validSession,advanceSession,advanceMinutes,sessionTime,seasonLabel,seasonNumber,readSession,writeSession,clubFor} from '../src/simulation.js';
import {seasonOpeningYear,preseasonStart,seasonCalendar,transferMarket,transferMarketFor} from '../src/season-calendar.js';
import {simulationPage} from '../src/ui-pages.js';

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
  assert.match(html,lang==='it'?/Partite e orari non sono ancora programmati/:/Fixtures and kick-off times are not yet scheduled/);
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
