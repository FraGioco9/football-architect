import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../assets/world-calendar-model.js';
import '../assets/world-clock-adapter.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const clock=globalThis.faWorldClockAdapter;

test('A05-10 Calendar: viewed seasons do not mutate world time or create completed results',()=>{
 const snapshot={source:{kind:'dev',reference:'DEV only'},current:{season:2,day:25}};
 const frozen=JSON.stringify(snapshot);
 for(const season of [1,2,3]){
  const projection=clock.project(season,snapshot);
  assert.equal(projection.season,season);
  assert.equal(projection.days.length,56);
  assert.ok(projection.days.flatMap(day=>day.events).every(e=>e.competitions.every(c=>c.status===null)));
 }
 assert.equal(JSON.stringify(snapshot),frozen);
});

test('A05-10 Fixtures: clock consumption is competition-scoped and cannot authorize match outcomes',()=>{
 const fixtures=read('assets/competition-fixtures.js');
 const rules=read('assets/competition-rules.js');
 assert.match(fixtures,/faWorldCalendarModel\?\.projectCompetition/);
 assert.match(fixtures,/rules\.currentFixtureChoice\(definition,calendar/);
 assert.match(fixtures,/fa:world-clock-snapshot/);
 assert.match(rules,/event\.competitionIds\.includes\(definition\.id\)/);
 assert.match(rules,/current\.season!==calendar\.season/);
});

test('A05-10 Stats and History: results come from supplied validated contexts, not wall time',()=>{
 const stats=read('assets/competition-stats.js');
 const history=read('assets/competition-history.js');
 assert.match(stats,/seasonData/);
 assert.match(stats,/selectedSeason/);
 assert.doesNotMatch(stats,/Date\.now\(\)|new Date\(\)/);
 assert.match(history,/applyCanonicalHistory\(payload\)/);
 assert.match(history,/results=null/);
 assert.doesNotMatch(history,/Date\.now\(\)|new Date\(\)/);
});

test('A05-10: unavailable World Progress never authorizes time-reached completion',()=>{
 const p=clock.project(1,null);
 assert.ok(p.days.every(day=>day.relative===null));
 assert.ok(p.days.flatMap(day=>day.events).every(e=>e.competitions.every(c=>c.status===null)));
});
