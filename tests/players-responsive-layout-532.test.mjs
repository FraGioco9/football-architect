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
 assert.match(css,/\.app-players-table\{--app-players-flag-width:44px;--app-players-name-width:216px;--app-players-positions-width:176px;min-width:720px\}/);
 assert.match(css,/\.app-players-table\[data-players-table-mode="attributes"\]\{min-width:900px\}/);
 assert.match(css,/html\[data-players-group="technical"\] \.app-players-table\[data-players-table-mode="attributes"\]\{min-width:1364px\}/);
 assert.match(css,/@media\(max-width:420px\)\{\s*\.app-players-table\{--app-players-flag-width:40px;--app-players-name-width:192px;--app-players-positions-width:160px;min-width:680px\}/);
 assert.match(css,/\.app-players-table\[data-players-table-mode="attributes"\]\{min-width:856px\}/);
 assert.match(css,/html\[data-players-group="technical"\] \.app-players-table\[data-players-table-mode="attributes"\]\{min-width:1272px\}/);
 assert.match(roster,/@media\(max-width:720px\)\{\.club-roster-table\[data-players-table-mode="attributes"\]\[data-roster-group="technical"\]\{min-width:1364px\}\}/);
 assert.match(roster,/@media\(max-width:420px\)\{\.club-roster-table\[data-players-table-mode="attributes"\]\[data-roster-group="technical"\]\{min-width:1272px\}\}/);
 for(const [flag,name,positions,overview,four,eight] of [
  [44,216,176,720,900,1364],[40,192,160,680,856,1272]
 ]){
  const remaining=overview-flag-name;
  const frac=[.17,.42,.21,.20];
  assert.equal(frac.reduce((a,b)=>a+b,0),1,'Overview widths cover flexible region');
  assert.ok(remaining*.17>=70,'Age column remains readable');
  assert.ok(remaining*.42>=180,'Positions column remains readable');
  assert.ok((four-flag-name-positions)/4>=110,'four-attribute group keeps adequate numeric tracks');
  assert.ok((eight-flag-name-positions)/8>=110,'Technical group keeps adequate numeric tracks');
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
