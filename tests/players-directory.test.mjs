import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isAllowlistedPublicPath,planPublicFiles} from '../tools/publication-guard.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Players static shell loads the D1 directory renderer and reserves the empty table row',()=>{
 const html=read('players/index.html');
 assert.match(html,/src="\/assets\/players-directory\.js" defer/);
 assert.match(html,/data-players-status role="status"/);
 assert.doesNotMatch(html,/data-app-i18n="playersDirectoryHeading">No players available/);
 for(const header of ['playersNationality','playersColumnPlayer','playersColumnAge','playersColumnPositions','playersColumnHeight','playersColumnFoot'])
  assert.ok(html.includes(header));
 const generator=read('tools/generate-app-pages.mjs');
 assert.match(generator,/players-directory\.js/);
 assert.match(generator,/data-players-status/);
});
test('renderer is read-only, sanitizes output and uses only documented public fields',()=>{
 const code=read('assets/players-directory.js');
 assert.match(code,/fetch\('\/api\/players\/page\/'/);
 assert.match(code,/credentials:'omit'/);
 assert.match(code,/textContent=/);
 assert.doesNotMatch(code,/innerHTML|\/api\/admin\/players/);
 assert.match(code,/app-players-nationality-flag/);
});

test('Players script is served by the local allowlist and included in publication artifacts',()=>{
 const asset='assets/players-directory.js';
 assert.equal(isAllowlistedPublicPath(asset),true,'local DEV HTTP server must not return 404 for Players renderer');
 assert.ok(planPublicFiles().includes(asset),'public static bundle must include Players renderer');
 assert.equal(isAllowlistedPublicPath('assets/players-directory-private.js'),false,'no broad assets/* allowance');
});

test('Players #505 header reserves the API-backed total on first paint without empty view tabs',()=>{
 const html=read('players/index.html'),generator=read('tools/generate-app-pages.mjs');
 const code=read('assets/players-directory.js'),css=read('assets/app.css');
 assert.match(html,/<header class="app-players-header">[\s\S]*?id="players-title"[\s\S]*?data-players-count aria-live="polite"/);
 assert.match(html,/class="app-players-count-skeleton" aria-hidden="true"/);
 assert.match(generator,/app-players-header/);
 assert.match(generator,/data-players-count/);
 assert.match(html,/class="app-competition-tabs app-players-tabs"/);
 assert.match(html,/data-players-view="overview"/);
 assert.match(html,/data-players-view="attributes"/);
 assert.match(html,/data-players-first-paint/);
 assert.match(code,/lastCount=data\.count;renderCount\(lastCount\)/);
 assert.match(code,/new Intl\.NumberFormat/);
 for(const locale of ['en','de','es','fr','it'])assert.ok(code.includes(locale+":{one:'"),locale);
 assert.match(css,/\.app-players-header\{display:flex/);
 assert.match(css,/@media\(max-width:620px\)\{\.app-players-header/);
});

test('Players two views retain shared canonical rows and approved four skill groups',()=>{
 const html=read('players/index.html'),renderer=read('assets/players-directory.js'),css=read('assets/app.css');
 const generator=read('tools/generate-app-pages.mjs');
 for(const group of ['physical','technical','mental','goalkeeping']){
  assert.ok(html.includes('data-players-group="'+group+'"'),group);
  assert.ok(renderer.includes(group+':['),group);
 }
 assert.match(html,/data-players-filter="nationality"/);
 assert.match(html,/data-players-filter="position"/);
 assert.match(html,/class="app-players-table"/);
 assert.match(renderer,/history\[mode\]/);
 assert.match(renderer,/window\.addEventListener\('popstate'/);
 assert.match(renderer,/new URLSearchParams\(\)/);
 assert.match(renderer,/groups\[state\.group\]/);
 assert.match(renderer,/data\.count/);
 assert.match(css,/\.app-players-filter-control select\{/);
 assert.match(css,/\.app-players-tabs \.app-competition-tab\[aria-selected="true"\]::after/);
 assert.match(generator,/data-players-first-paint/);
});

test('Players attribute group controls stay all visible without horizontal scrolling at desktop and mobile sizes',()=>{
 const css=read('assets/app.css');
 const html=read('players/index.html');
 assert.match(css,/\.app-players-groups\{display:grid;grid-template-columns:repeat\(4,minmax\(0,160px\)\)/);
 assert.match(css,/\.app-players-groups\{[^}]*overflow:visible/);
 assert.match(css,/@media\(max-width:620px\)\{\.app-players-filters/);
 assert.ok(css.includes(".app-players-groups{grid-template-columns:repeat(2,minmax(0,1fr))}"),"four tabs must be laid out as two columns on mobile");
 assert.match(css,/\.app-players-group\{[^}]*white-space:normal/);
 for(const group of ['physical','technical','mental','goalkeeping'])
  assert.match(html,new RegExp('data-players-group="'+group+'"'));
});
