import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('assets/app.css');

test('Fixtures crest skeleton shares the centered 64px / 56px logo slots',()=>{
 const rules=[...css.matchAll(/#competition-panel-fixtures \.app-fixtures-skeleton-crest\{([^}]*)\}/g)].map(match=>match[1]);
 const rule=rules.find(value=>value.includes('flex:0 0 64px'));
 assert.ok(rule,'Fixtures skeleton crest slot must exist');
 assert.match(rule,/display:grid;/,'the skeleton is a centered grid, not a block anchored to the left');
 assert.match(rule,/place-items:center;/,'the circle is centered on both axes');
 assert.match(rule,/flex:0 0 64px;width:64px;height:64px/,'desktop skeleton slot has the real crest dimensions');
 assert.match(css,/\.app-fixture-club \.app-world-club-crest-placeholder\{flex-basis:64px;width:64px;height:64px\}/,
  'real desktop crest uses the same geometry');
 assert.match(css,/#competition-panel-fixtures \.app-fixtures-skeleton-crest::before\{[\s\S]*?width:85%;height:auto;aspect-ratio:1;/,
  'skeleton circle uses the shared crest loading primitive');
 assert.match(css,/@media\(max-width:620px\)\{\.app-fixture-match[^}]*\}\.app-fixture-club[^}]*\}\.app-fixture-club \.app-world-club-crest-placeholder\{flex-basis:56px;width:56px;height:56px\}/,
  'real mobile crest is 56px');
 assert.match(css,/#competition-panel-fixtures \.app-fixtures-skeleton-crest\{flex-basis:56px;width:56px;height:56px\}/,
  'mobile skeleton matches the real 56px slot');
 assert.doesNotMatch(css,/#competition-panel-fixtures \.app-fixtures-skeleton-crest\{display:block;/,
  'later rules must not undo centered grid layout');
});

test('Fixtures loading rows use the same home/away crest positions',()=>{
 for(const path of ['competitions/_shared/index.html','competitions/it-1/index.html','competitions/int-1/index.html']){
  const html=read(path);
  const row=html.match(/<li class="app-fixture-match" data-skeleton-fixture>(.*?)<\/li>/)?.[1];
  assert.ok(row,path+' contains a first-paint fixture row');
  assert.match(row,/<div class="app-fixture-club app-fixture-home"><span class="app-fixtures-skeleton-crest"><\/span>/,
   path+' preserves the home crest host');
  assert.match(row,/<div class="app-fixture-club"><span class="app-fixtures-skeleton-crest"><\/span>/,
   path+' preserves the away crest host');
 }
});
