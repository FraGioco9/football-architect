import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/world-calendar.js',import.meta.url),'utf8');

test('CAL-WEEK-INIT-01 first Season to Week uses current day only before manual week selection',()=>{
 assert.match(source,/let manualWeekSelected=false/);
 assert.match(source,/const enteringWeek=view==='week'&&state\.view!=='week'/);
 assert.match(source,/enteringWeek&&!manualWeekSelected\?\{view,day:currentWeekDay\(\)\}:\{view\}/);
});
test('CAL-WEEK-INIT-02 current day is valid and belongs to selected current season',()=>{
 assert.match(source,/current\.season===viewedSeason&&Number\.isInteger\(current\.day\)&&current\.day>=1&&current\.day<=56/);
 assert.match(source,/\?current\.day:state\.day/);
});
test('CAL-WEEK-INIT-03 explicit week dropdown, arrows, mouse and keyboard mark manual state',()=>{
 assert.match(source,/setWeek:n=>\{[^}]*manualWeekSelected=true/);
 assert.match(source,/get\('previous'\)[^\n]*manualWeekSelected=true/);
 assert.match(source,/get\('next'\)[^\n]*manualWeekSelected=true/);
 assert.match(source,/button\.addEventListener\('click',\(\)=>\{manualWeekSelected=true/);
 assert.match(source,/event\.preventDefault\(\);manualWeekSelected=true;change/);
});
test('CAL-WEEK-INIT-04 no persistent clock or simulation writes',()=>{
 const changed=source.slice(source.indexOf('let manualWeekSelected=false;'),source.indexOf('const kind=(d,w)'));
 assert.doesNotMatch(changed,/sessionStorage\.(?:setItem|removeItem)|localStorage|fetch\(|fa:dev-progress-change/);
 assert.match(source,/saveUrl\(true\)/);
});
test('CAL-WEEK-INIT-05 public and historical calendar do not borrow unrelated DEV progress',()=>{
 assert.match(source,/current\.season===viewedSeason/);
 assert.match(source,/\?current\.day:state\.day/);
});
