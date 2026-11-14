import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');

test('#532 desktop player-table widths and static colgroup are unchanged',()=>{
 const css=read('assets/app.css'),html=read('players/index.html');
 assert.match(css,/\.app-players-table\{--app-players-flag-width:54px;--app-players-name-width:248px;--app-players-positions-width:200px;width:100%;min-width:782px/);
 assert.match(css,/\.app-players-table\[data-players-table-mode="attributes"\]\{min-width:982px\}/);
 assert.match(css,/html\[data-players-group="technical"\] \.app-players-table\[data-players-table-mode="attributes"\]\{min-width:1462px\}/);
 assert.match(html,/<colgroup><col class="app-players-flag-column"><col class="app-players-name-column"><col class="app-players-view-third-column"><\/colgroup>/);
 assert.match(css,/\.app-players-table thead th\{height:42px;padding-block:2px;[^}]*font-size:12px/);
 assert.match(css,/\.app-players-table tbody tr:not\(\.app-players-empty-row\)\{height:36px\}/);
 assert.equal((html.match(/class="app-players-loading-row"/g)||[]).length,5);
});

test('#532 responsive Overview and attribute groups preserve 4/8 readable statistic tracks',()=>{
 const css=read('assets/app.css'),roster=read('assets/club-page.css');
 assert.match(css,/@media\(max-width:720px\)\{\s*\.app-players-table-scroll\{overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch\}/);
 assert.match(css,/\.app-players-table\{--app-players-flag-width:32px;--app-players-name-width:128px;--app-players-positions-width:112px;min-width:484px\}/);
 assert.match(css,/\.app-players-table\[data-players-table-mode="attributes"\]\{min-width:648px\}/);
 assert.match(css,/html\[data-players-group="technical"\] \.app-players-table\[data-players-table-mode="attributes"\]\{min-width:1024px\}/);
 assert.match(css,/@media\(max-width:420px\)\{\s*\.app-players-table\{--app-players-flag-width:30px;--app-players-name-width:120px;--app-players-positions-width:104px;min-width:464px\}/);
 assert.match(css,/\.app-players-table\[data-players-table-mode="attributes"\]\{min-width:624px\}/);
 assert.match(css,/html\[data-players-group="technical"\] \.app-players-table\[data-players-table-mode="attributes"\]\{min-width:1000px\}/);
 assert.match(roster,/@media\(max-width:720px\)\{\.club-roster-table\[data-players-table-mode="attributes"\]\[data-roster-group="technical"\]\{min-width:1024px\}\}/);
 assert.match(roster,/@media\(max-width:420px\)\{\.club-roster-table\[data-players-table-mode="attributes"\]\[data-roster-group="technical"\]\{min-width:1000px\}\}/);
 for(const [flag,name,positions,overview,four,eight] of [
  [32,128,112,484,648,1024],[30,120,104,464,624,1000]
 ]){
  const remaining=overview-flag-name-positions;
  assert.ok(remaining*.28>=55,'Overview Age remains readable at phone width');
  assert.ok(remaining*.36>=70,'Overview Height and Foot remain readable');
  assert.ok((four-flag-name-positions)/4>=90,'four-attribute group stays readable');
  assert.ok((eight-flag-name-positions)/8>=90,'Technical group stays readable');
 }
});

test('#532 long text remains single-line without changing layout, first paint or sort',()=>{
 const css=read('assets/app.css');
 assert.match(css,/\.app-players-table tbody td:nth-child\(2\)\{white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/);
 assert.match(css,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link\)\{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/);
 assert.match(css,/\.app-players-table:not\(\[data-players-public\]\):not\(\[data-players-table-mode="attributes"\]\) tbody td:nth-child\(4\),\s*\.app-players-table\[data-players-public\]:not\(\[data-players-table-mode="attributes"\]\) tbody td:nth-child\(3\),\s*\.app-players-table\[data-players-table-mode="attributes"\] tbody td:nth-child\(3\)\{white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/);
 assert.match(css,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link,\.app-player-club-link\)::after\{[^}]*bottom:0;height:1px/,'underline stays in place');
 assert.match(css,/\.app-players-table \.(?:app-players-loading-row) td\{height:36px/);
 assert.match(css,/\.app-players-table-scroll\{[^}]*overflow-x:auto/);
});
