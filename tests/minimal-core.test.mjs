import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEAGUES,getLeagueClubs} from '../src/leagues.js';
import {SAVE_KEY,validDate,localToday,createSession,validSession,advanceSession,seasonLabel,readSession,writeSession,clubFor} from '../src/simulation.js';

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
 assert.equal(Object.keys(s).sort().join(','),'clubId,countryId,date,daysElapsed,startedAt,version');
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
  assert.equal(Object.keys(state).length,6);
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
