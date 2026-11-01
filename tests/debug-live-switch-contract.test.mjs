import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('Debug toggle broadcasts live source updates without a page reload',()=>{
 const widget=read('../tools/dev-debug-widget.mjs');
 assert.match(widget,/fa:debug-mode-change/);
 assert.doesNotMatch(widget,/location\.reload\(/);
});
test('competition and calendar listeners react to Debug toggle in place',()=>{
 const dev=read('../tools/dev-standings-preview-client.mjs');
 const competition=read('../assets/competition-page.js');
 const calendar=read('../assets/calendar-simplified.js');
 const world=read('../assets/world-calendar.js');
 for(const body of [dev,competition,calendar,world])assert.match(body,/fa:debug-mode-change/);
 assert.match(competition,/sourceState==='loading'/);
});
