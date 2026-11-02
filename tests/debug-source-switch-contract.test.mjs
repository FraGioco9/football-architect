import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {DEBUG_SEASON_BOOTSTRAP} from '../tools/dev-preview-artifact.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
function bootstrap(enabled,season='3'){
 const storage=new Map([['football-architect:standings-dev-season',season],['football-architect:local-debug-visible',enabled?'1':'0']]);
 const document={documentElement:{dataset:{}}};
 runInNewContext(DEBUG_SEASON_BOOTSTRAP.replace(/^<script>/,'').replace(/<\/script>$/,''),{
  document,sessionStorage:{getItem:k=>storage.has(k)?storage.get(k):null}
 });
 return document.documentElement.dataset;
}
test('Debug OFF never exposes local Season 3 or DEV season options to competition first paint',()=>{
 const data=bootstrap(false);assert.equal(data.faDevCurrentSeason,undefined);assert.equal(data.faDevSeasons,undefined);
});
test('Debug ON enables local Season 3 and DEV season selector before first paint',()=>{
 const data=bootstrap(true);assert.equal(data.faDevCurrentSeason,'3');assert.equal(data.faDevSeasons,'1,2,3,4,5');
});
test('local fixture changes are guarded while the new source hydrates',()=>{
 const dev=read('../tools/dev-standings-preview-client.mjs');
 const server=read('../tools/dev-standings-preview.mjs');
 assert.match(dev,/faDevSwitching/);
 assert.doesNotMatch(server,/<style>html\[data-fa-dev-switching/);
 assert.doesNotMatch(server,/<style>html\[data-fa-dev-source-pending/);
});
test('popup is enabled for all local HTML, including account, except specialized pages',()=>{
 const server=read('../tools/dev-standings-preview.mjs');
 assert.match(server,/debug-global\.mjs/);
 assert.match(server,/type===TYPES\["\.html"\]/);
 const widget=read('../tools/dev-debug-widget.mjs');
 assert.match(widget,/football-architect:local-debug-visible/);
 assert.match(widget,/fa:debug-mode-change/);
});
test('public calendar depends on global state when Debug OFF',()=>{
 const calendar=read('../assets/calendar-simplified.js');
 const world=read('../assets/world-calendar.js');
 assert.match(calendar,/football-architect:local-debug-visible/);
 assert.match(world,/football-architect:local-debug-visible/);
 assert.match(world,/publicWorld\?\.seasonNumber>0/);
});
