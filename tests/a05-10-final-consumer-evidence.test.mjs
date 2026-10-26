import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../assets/world-calendar-model.js';
import '../assets/world-clock-adapter.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const adapter=globalThis.faWorldClockAdapter;

test('A05-10 final: Fixtures scopes its current and event-driven world projections to one competition',()=>{
 const fixtures=source('assets/competition-fixtures.js');
 assert.equal((fixtures.match(/faWorldCalendarModel\?\.projectCompetition\(window\.faCompetitionContext\.selectedSeason,definition\.id\)/g)||[]).length,2);
 assert.match(fixtures,/fa:world-clock-snapshot/);
 assert.match(fixtures,/rules\.currentFixtureChoice\(definition,calendar,event\.detail\)/);
});

test('A05-10 final: Calendar renders global day context, not per-competition results',()=>{
 const calendar=source('assets/world-calendar.js');
 assert.match(calendar,/clockAdapter\.project\(1,clockSnapshot\)/);
 assert.match(calendar,/clockAdapter\?\.normalize\(raw\)/);
 assert.doesNotMatch(calendar,/clockAdapter\.projectCompetition\(/);
 const full=adapter.project(1,null);
 assert.equal(full.days.length,56);
 assert.ok(full.days.some(day=>day.events.some(event=>event.competitionIds.length>1)));
});

test('A05-10 final: Stats consumes selected season provider context, not clock-derived outcomes',()=>{
 const stats=source('assets/competition-stats.js');
 assert.match(stats,/const current=context\?\.seasonData/);
 assert.match(stats,/context\.selectedSeason/);
 assert.doesNotMatch(stats,/faWorldClockSnapshot|faDevWorldClockSnapshot|fa:world-clock-snapshot|projectCompetition/);
});

test('A05-10 final: History displays canonical records only after validated provider application',()=>{
 const history=source('assets/competition-history.js');
 assert.match(history,/applyCanonicalHistory\(payload\)\{const checked=compute\(payload\);results=checked;render\(\);\}/);
 assert.match(history,/results=null/);
 assert.doesNotMatch(history,/faWorldClockSnapshot|faDevWorldClockSnapshot|fa:world-clock-snapshot|projectCompetition/);
});

test('A05-10 final: world progression and viewed season remain independent and result-free',()=>{
 const snapshot={source:{kind:'dev',reference:'DEV test'},current:{season:3,day:22}};
 const before=JSON.stringify(snapshot);
 for(const viewed of [1,3,4]){
  const global=adapter.project(viewed,snapshot);
  const scoped=adapter.projectCompetition(viewed,'int-1',snapshot);
  assert.equal(global.days.length,56);assert.equal(scoped.days.length,56);
  assert.ok(scoped.days.flatMap(day=>day.events).every(event=>event.competitions.length===1&&event.competitions[0].competitionId==='int-1'&&event.competitions[0].status===null));
 }
 assert.equal(JSON.stringify(snapshot),before);
 assert.equal(adapter.normalize(null).current,null);
});
