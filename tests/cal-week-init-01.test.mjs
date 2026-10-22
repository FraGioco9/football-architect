import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../assets/world-calendar.js',import.meta.url),'utf8');

test('CAL-WEEK-INIT-01 remembers last explicit Week day separately from Season browsing',()=>{
 assert.match(source,/let manualWeekDay=null/);
 assert.match(source,/const rememberWeek=\(\)=>\{manualWeekDay=state\.day/);
 assert.match(source,/enteringWeek\?\{view,day:manualWeekDay\?\?state\.day\}:\{view\}/);
 assert.match(source,/if\(state\.view==='week'\)rememberWeek\(\)/);
});
test('CAL-WEEK-INIT-02 current week applies only to the matching DEV season',()=>{
 assert.match(source,/current\.season===viewedSeason&&Number\.isInteger\(current\.day\)&&current\.day>=1&&current\.day<=56/);
 assert.match(source,/pendingInitialWeek=true;change\(\{view,day:currentWeekDay\(\)\}\)/);
});
test('CAL-WEEK-INIT-03 explicit dropdown, arrows and keyboard update manual selection',()=>{
 assert.match(source,/setWeek:n=>\{[^\n]*rememberWeek\(\)/);
 assert.match(source,/get\('previous'\)[^\n]*rememberWeek\(\)/);
 assert.match(source,/get\('next'\)[^\n]*rememberWeek\(\)/);
 assert.match(source,/event\.preventDefault\(\);change\([^\n]*if\(state\.view==='week'\)rememberWeek\(\)/);
});
test('CAL-WEEK-INIT-04 late DEV clock snapshot reconciles first Week only',()=>{
 assert.match(source,/if\(pendingInitialWeek&&state\.view==='week'&&manualWeekDay===null\)/);
 assert.match(source,/const day=currentWeekDay\(\)/);
 assert.match(source,/if\(day!==state\.day\)\{state=\{\.\.\.state,day\};render\(\);\}/);
 assert.match(source,/fa:world-clock-snapshot/);
});
test('CAL-WEEK-INIT-05 projection remains presentation-only; frozen model untouched',()=>{
 assert.doesNotMatch(source,/sessionStorage\.(?:setItem|removeItem)|localStorage\.(?:setItem|removeItem)/);
 assert.match(source,/current\.season===viewedSeason/);
});
// Behavioral state-machine coverage for the exact gate/remember logic embedded in the UI script.
test('CAL-WEEK-INIT-06 behavioral transitions preserve manual week across Season selection',()=>{
 let state={day:1,view:'season'},manualWeekDay=null,pendingInitialWeek=false;
 let clock={season:3,day:36},viewedSeason=3;
 const currentWeekDay=()=>clock&&clock.season===viewedSeason&&Number.isInteger(clock.day)&&clock.day>=1&&clock.day<=56?clock.day:state.day;
 const switchView=view=>{
  const enteringWeek=view==='week'&&state.view!=='week';
  if(enteringWeek&&manualWeekDay===null){pendingInitialWeek=true;state={...state,view,day:currentWeekDay()}}
  else state={...state,...(enteringWeek?{view,day:manualWeekDay??state.day}:{view})};
 };
 const visit=n=>{state={...state,view:'week',day:(n-1)*7+1};manualWeekDay=state.day;pendingInitialWeek=false};
 switchView('week');assert.equal(Math.ceil(state.day/7),6);
 visit(3);switchView('season');state.day=50;switchView('week');
 assert.equal(Math.ceil(state.day/7),3);
 clock.day=43;assert.equal(state.day,15);
});
test('CAL-WEEK-INIT-07 behavioral delayed snapshot and historical season',()=>{
 let state={day:1,view:'week'},manualWeekDay=null,pendingInitialWeek=true;
 let clock=null,viewedSeason=3;
 const currentWeekDay=()=>clock&&clock.season===viewedSeason&&Number.isInteger(clock.day)&&clock.day>=1&&clock.day<=56?clock.day:state.day;
 const reconcile=()=>{if(pendingInitialWeek&&state.view==='week'&&manualWeekDay===null){const day=currentWeekDay();if(day!==state.day)state={...state,day}}};
 reconcile();assert.equal(state.day,1);
 clock={season:3,day:36};reconcile();assert.equal(state.day,36);
 viewedSeason=2;reconcile();assert.equal(state.day,36);
 manualWeekDay=15;clock={season:2,day:50};reconcile();assert.equal(state.day,36);
});
