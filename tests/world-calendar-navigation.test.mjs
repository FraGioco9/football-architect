import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Calendar has no competition filters and waits for an unknown first-paint week',()=>{
 const html=read('calendar/index.html');
 assert.doesNotMatch(html,/id="calendar-(filter|division|today)"/);
 assert.match(html,/<span id="calendar-week-value">Week<\/span>/);
 const preview=html.match(/class="calendar-week-row calendar-week-preview"[\s\S]*?<div class="calendar-week-row"/)?.[0]??'';
 for(const field of ['number','kind'])assert.equal(preview.split('app-skeleton-bar calendar-day-'+field).length-1,7);
 assert.doesNotMatch(preview,/\d\/7/);
});
test('Calendar return routing stays internal',()=>{
 const tab=read('assets/competition-tabs.js'),js=read('assets/world-calendar.js');
 assert.match(tab,/calendarReturn/);
 assert.match(tab,/u\.origin===window\.location\.origin/);
 assert.match(js,/calendarView/);
 assert.doesNotMatch(js,/\/app\/competitions/);
});
