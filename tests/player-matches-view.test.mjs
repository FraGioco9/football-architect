import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderPlayerDetailPage} from '../tools/render-player-detail.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('#712 public Matches tab is between Stats and History, absent from Admin draft',()=>{
 const publicHtml=read('players/_shared/index.html'),preview=read('admin/players/preview/player/index.html');
 assert.equal(publicHtml,renderPlayerDetailPage(read('players/index.html'),'public'));
 assert.equal(preview,renderPlayerDetailPage(read('admin/players/preview/index.html'),'preview'));
 const tabs=[...publicHtml.matchAll(/data-detail-view="(overview|info|stats|matches|history|progression)"/g)].map(m=>m[1]);
 assert.deepEqual(tabs,['overview','info','stats','matches','history','progression']);
 assert.match(publicHtml,/data-detail-view="matches"[^>]*aria-controls="player-detail-matches-panel"/);
 assert.doesNotMatch(preview,/data-detail-view="matches"|data-detail-matches/);
 assert.match(publicHtml,/get\("view"\)==="matches"/);
});
test('#712 parser-time and hydrated Matches retain identical table track signatures',()=>{
 const html=read('players/_shared/index.html');
 const shell=html.match(/<section class="app-player-detail-matches"[\s\S]*?<\/section>/)?.[0];
 assert.ok(shell);
 assert.equal((shell.match(/data-player-matches-heading="/g)||[]).length,13);
 assert.equal((shell.match(/<col class="app-player-matches-col-/g)||[]).length,13);
 assert.equal((shell.match(/data-player-matches-loading/g)||[]).length,5);
 assert.equal((shell.match(/app-player-matches-value/g)||[]).length,65);
 assert.equal((shell.match(/app-player-matches-toggle-space/g)||[]).length,0);
 assert.equal((shell.match(/app-player-matches-skeleton-crest/g)||[]).length,10);
 assert.equal((shell.match(/<span class="app-player-matches-club">/g)||[]).length,10);
 assert.equal((shell.match(/class="club-fp-bar/g)||[]).length,65);
 assert.equal((shell.match(/class="app-skeleton-bar" style="width:/g)||[]).length,0);
 assert.equal((shell.match(/app-player-matches-row app-player-matches-loading/g)||[]).length,5);
 const css=read('assets/player-detail.css');
 assert.match(css,/\.app-player-matches-table tr\.app-player-matches-row\{height:56px\}/);
 assert.match(css,/grid-template-columns:minmax\(0,1\.3fr\) minmax\(0,1fr\) 58px 40px/);
 assert.match(css,/app-player-matches-row>:nth-child\(4\)/);
 assert.match(css,/app-player-matches-row>:nth-child\(6\)/);
 assert.match(css,/app-player-matches-row>:nth-child\(7\)/);
 assert.doesNotMatch(css,/app-player-matches-toggle-space/);
 assert.match(css,/\.app-player-matches-loading \.app-player-matches-skeleton-crest\{/);
 assert.match(css,/\.app-player-matches-loading \.club-fp-bar\{/);
 assert.match(css,/\.app-player-matches-loading \.app-player-matches-skeleton-crest::before\{/);
 assert.match(css,/\.app-player-matches-loading \.app-player-matches-value\{[\s\S]*?height:24px/);
 assert.match(css,/\.app-player-matches-loading \.app-player-matches-skeleton-crest\{[\s\S]*?margin-right:0/);
});
test('#712 API and UI use verified read, only canonical match routes, five languages',()=>{
 const worker=read('backend/src/index.ts'),sporting=read('backend/src/public-sporting-read-lineup-v1.ts');
 const ui=read('assets/player-matches.mjs'),controller=read('assets/player-detail.js');
 const proxy=read('tools/dev-admin-api-proxy.mjs'),pub=read('tools/publication-guard.mjs');
 assert.match(worker,/const playerMatches=url\.pathname\.match/);
 assert.match(worker,/readPublicPlayerMatchesLineupV1/);
 assert.match(sporting,/collectFrozenPlayerMatches\(playerId,selectedSeason,replay\.frozenMatches\.values\(\),metadata\)/);
 assert.match(sporting,/await unchanged\(db,world\)/);
 assert.match(ui,/link\.href='\/matches\/'\+item\.matchId/);
 assert.match(ui,/item\.side==='away'\?score\.awayGoals/);
 assert.match(ui,/tableTitles\[locale\(\)\]/);
 assert.match(ui,/if\(\['ready','error','unavailable'\]\.includes\(status\)\)return/);
 assert.match(ui,/visibleCount\+=20;render\(\)/);
 for(const lang of ['en','it','de','es','fr'])assert.match(ui,new RegExp(' '+lang+':\\{headers:'));
 assert.match(controller,/import\('\/assets\/player-matches\.mjs'\)/);
 assert.match(controller,/if\(view==='matches'\)void ensurePlayerMatches\(\)/);
 assert.match(proxy,/const playerMatchesRead=/);
 assert.match(pub,/assets\/player-matches\.mjs/);
 assert.match(pub,/"player-stats.mjs","player-matches.mjs","match-detail.js"/);
});

test('#720 Matches controls and row navigation follow shared site patterns',()=>{
 const html=read('players/_shared/index.html');
 const shell=html.match(/<section class="app-player-detail-matches"[\s\S]*?<\/section>/)?.[0];
 assert.ok(shell);
 const comp=shell.indexOf('data-player-matches-competition-control');
 const season=shell.indexOf('data-player-matches-season-control');
 assert.ok(comp>=0&&season>comp,'Competition precedes Season');
 assert.equal((shell.match(/role="combobox"/g)||[]).length,2);
 assert.equal((shell.match(/class="language-chevron"/g)||[]).length,2);
 assert.doesNotMatch(shell,/data-player-matches-(?:season|competition)-label/);
 assert.doesNotMatch(shell,/>H\/A<\/th>/);
 const ui=read('assets/player-matches.mjs'),fixture=read('assets/club-fixtures.js');
 assert.match(ui,/tr\.dataset\.playerMatchHref='\/matches\/'\+item\.matchId/);
 assert.match(ui,/window\.location\.assign\(row\.dataset\.playerMatchHref\)/);
 assert.match(ui,/event\.target\.closest\?\.\('a,button/);
 assert.doesNotMatch(ui,/app-player-matches-(?:toggle|chevron|details)/);
 assert.doesNotMatch(ui,/data-player-match-toggle|data-player-match-detail|aria-expanded.*match/);
 assert.match(ui,/const rows=filtered\.slice\(0,visibleCount\)\.map\(rowFor\);tbody\.replaceChildren\(\.\.\.rows\)/);
 assert.match(ui,/first\.append\(link\);tr\.append\(first\)/);
 assert.match(ui,/value\.toFixed\(2\)/);
 assert.match(ui,/fmt\(p\[metric\],metric\)/);
 assert.match(ui,/note\.textContent=message;return;/);
 for(const glyph of ['home','away','neutral']){
  assert.ok(ui.includes(glyph+':')&&fixture.includes(glyph+':'),'fixtures venue glyph '+glyph);
 }
 const css=read('assets/player-detail.css');
 assert.match(css,/\.app-player-matches-row\[data-player-match-href\]/);
 assert.match(css,/\.app-player-matches-venue-icon svg/);
 assert.doesNotMatch(css,/app-player-matches-(?:toggle|chevron|details)/);
 assert.match(css,/\.app-player-matches-match-link:is\(:hover,:focus-visible\)\{text-decoration:none\}/);
 assert.match(css,/var\(--fa-shell-accent\) 11%,var\(--surface\)/);
 assert.match(css,/\.app-player-matches-toolbar\{[^\n]*justify-content:flex-end/);
});

test('#720 Date header, localized shared tooltips and complete cached filter model',async()=>{
 const {filterPlayerMatches}=await import('../assets/player-matches.mjs');
 const matches=Array.from({length:120},(_,i)=>({
  matchId:String(120-i),season:i<60?2:1,
  competitionId:i%2?'IT-1':'int-1',day:30-i%30
 }));
 assert.equal(filterPlayerMatches(matches).length,120);
 assert.equal(filterPlayerMatches(matches,2).length,60);
 assert.equal(filterPlayerMatches(matches,1,'IT-1').length,30);
 assert.equal(filterPlayerMatches(matches,'all','int-1').length,60);
 assert.equal(filterPlayerMatches(matches,2,'IT-1')[0].matchId,'119');
 const html=read('players/_shared/index.html');
 assert.match(html,/data-player-matches-heading="0">Date<\/th>/);
 const ui=read('assets/player-matches.mjs'),css=read('assets/player-detail.css');
 for(const lang of ['en','it','de','es','fr'])
  assert.match(ui,new RegExp(' '+lang+':\\{headers:'));
 assert.match(ui,/app-players-nationality-tooltip app-player-stats-tooltip/);
 assert.match(ui,/data-player-matches-help/);
 assert.match(ui,/if\(index<=5\)\{/);
 assert.match(ui,/if\(!Number\.isSafeInteger\(index\)\|\|index<6\|\|index>=w\.headers\.length\)return/);
 assert.match(ui,/button=el\('button','','app-player-stats-header-trigger'\)/);
 assert.doesNotMatch(ui,/app-player-matches-header-trigger/);
 assert.match(ui,/trigger\.setAttribute\('aria-describedby',tip\.id\)/);
 assert.match(css,/\.app-player-stats-header-trigger\{/);
 assert.match(ui,/fetchMatches\(id,\{season:'all',competition:'all',limit:50,cursor\}\)/);
 assert.match(ui,/if\(seenCursors\.has\(cursor\)/);
 assert.match(ui,/gathered\.length!==total/);
 const selectHandler=ui.slice(ui.indexOf('const choose=value=>'),ui.indexOf('trigger.addEventListener(\'click\'',ui.indexOf('const choose=value=>')));
 assert.match(selectHandler,/visibleCount=20;render\(\)/);
 assert.doesNotMatch(selectHandler,/fetchMatches|load\(/);
 assert.match(ui,/const filtered=filterPlayerMatches\(items,season,competition\)/);
 assert.match(ui,/visibleCount\+=20;render\(\)/);
 assert.doesNotMatch(ui,/more\.addEventListener\([^\n]*load\(/);
});

test('#720 Matches panel is isolated to Matches view at first paint and after navigation',()=>{
 const css=read('assets/player-detail.css');
 const html=read('players/_shared/index.html');
 const controller=read('assets/player-detail.js');
 // These selectors are necessary because all tabpanels are present in the static shell.
 assert.match(css,/html\[data-player-detail-view="matches"\] \.app-player-detail-overview\{display:none\}/);
 assert.match(css,/html:not\(\[data-player-detail-view="matches"\]\) \.app-player-detail-matches\{display:none\}/);
 assert.match(css,/html:not\(\[data-player-detail-view="stats"\]\) \.app-player-detail-stats\{display:none\}/);
 assert.match(css,/html:not\(\[data-player-detail-view="info"\]\) \.app-player-detail-info-view\{display:none\}/);
 assert.match(html,/data-detail-panel="matches" data-detail-matches/);
 assert.match(html,/data-player-detail-first-paint/);
 assert.match(controller,/document\.documentElement\.dataset\.playerDetailView=view/);
});
