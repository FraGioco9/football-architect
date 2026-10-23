import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('CAL-IMP-04 canonical filters and no invented Today',()=>{const html=read('calendar/index.html'),js=read('assets/world-calendar.js');for(const s of ['all','national','international','sovereign','federation'])assert.match(html,new RegExp('value="'+s+'"'));assert.match(html,/id="calendar-today" disabled/);assert.match(js,/competitionIds\.includes\('int-1'\)/);assert.match(js,/competitionIds\.includes\('int-2'\)/)});
test('CAL-IMP-04 restores a validated internal URL',()=>{const tab=read('assets/competition-tabs.js'),js=read('assets/world-calendar.js');assert.match(tab,/calendarReturn/);assert.match(tab,/u\.origin===window\.location\.origin/);assert.match(js,/calendarView/);assert.match(js,/e\.round<=30/);assert.doesNotMatch(js,/\/app\/competitions/)})
