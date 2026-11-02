import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ids=['it','eng','es','de','fr','pt','nl','br'].flatMap(c=>[c+'-1',c+'-2']).concat(['int-1','int-2']);

test('fixture first paint has reserved full-grid rows with no provisional matchday or sporting data',()=>{
 for(const id of ids){
  const html=read('competitions/'+id+'/index.html');
  const count=id.startsWith('int-')?12:8;
  assert.match(html,/id="app-fixtures-toolbar" data-fixtures-state="pending"/,id);
  assert.match(html,/<span id="app-fixtures-round-number"><\/span>/,id);
  const list=html.match(/<ol id="app-fixtures-list"[^>]*data-fixtures-state="pending">([\s\S]*?)<\/ol>/)?.[1];
  assert.ok(list,id);
  assert.equal((list.match(/class="app-fixture-match app-fixture-pending-row"/g)||[]).length,count,id);
  assert.equal((list.match(/class="app-fixture-result"/g)||[]).length,count,id);
  assert.equal((list.match(/class="app-fixture-club"/g)||[]).length,count,id);
  assert.doesNotMatch(list,/data-club-crest=|<img|<a |Date TBD|Full time/,id);
 }
});

test('fixture dimensions are defined once for both loaded and pending cards',()=>{
 const css=read('assets/app.css');
 assert.match(css,/\.app-fixture-match\{box-sizing:border-box;min-height:112px;/);
 assert.match(css,/@media\(max-width:620px\)\{\.app-fixture-match\{min-height:184px;/);
 assert.doesNotMatch(css,/\.app-fixture-pending-row\{min-height:/);
});

test('source switching retains provenance and prevents stale selections',()=>{
 const source=read('assets/competition-fixtures.js');
 assert.match(source,/committedSeason!==navigation\.get\(\)\.season/);
 assert.match(source,/incomingSource!==committedSource/);
 assert.match(source,/fields\.round\.disabled=true/);
 assert.match(source,/committedSeason===route\.season/);
 assert.match(source,/detail\.revision!==context\.revision/);
 assert.match(source,/fields\.list\.dataset\.fixturesState='unavailable'/);
 assert.match(source,/committedSource=source/);
 const page=read('assets/competition-page.js');
 assert.match(page,/fa:competition-source-state/);
 assert.match(page,/fa:competition-context-committed/);
 const loader=read('assets/authoritative-season.mjs');
 assert.match(loader,/ticket===epoch/);
 assert.match(loader,/getContext\(\)\?\.revision===context\.revision/);
});

test('fixtures never publish a provisional matchday=1 while current matchday is unresolved',()=>{
 const source=read('assets/competition-fixtures.js');
 assert.doesNotMatch(source,/navigation\.defaultMatchday\(currentMatchday\?\?1\)/);
 assert.match(source,/if\(currentMatchday!==null\)navigation\.defaultMatchday\(currentMatchday\)/);
 assert.match(source,/rounds!==null&&currentMatchday!==null&&committedSeason===route\.season/);
});

test('A04: international and domestic competition headers expose the same metadata slots',()=>{
 for(const id of ids){
  const html=read('competitions/'+id+'/index.html');
  assert.match(html,/class="app-world-detail-meta"/,id);
  assert.match(html,/id="app-competition-country"/,id);
  assert.match(html,/id="app-competition-tier"/,id);
  assert.match(html,/id="app-competition-season"/,id);
  if(id.startsWith('int-')){
   assert.match(html,/id="app-competition-country" data-cup-copy="type">International<\/span>/,id);
   assert.doesNotMatch(html,/data-cup-copy="summary"/,id);
  }
 }
});

test('A04: season selector reserves its geometry without showing provisional Season 1',()=>{
 for(const id of ids.concat(['_shared'])){
  const html=read('competitions/'+id+'/index.html');
  assert.match(html,/<span id="app-competition-season-value"><\/span>/,id);
  assert.doesNotMatch(html,/<span id="app-competition-season-value">1<\/span>/,id);
 }
 const css=read('assets/app.css');
 assert.match(css,/\.app-competition-season \.language-control\{width:88px\}/);
 assert.match(css,/\.app-competition-season \.language-trigger\{width:100%;min-width:0;height:44px\}/);
 const router=read('assets/competition-tabs.js');
 assert.match(router,/seasonValue\.textContent=available\?state\.season/);
});

test('A04: shared competition heading reserves metadata and season value line geometry',()=>{
 const css=read('assets/app.css');
 assert.match(css,/\.app-world-detail-meta\{[^}]*min-height:1\.4em/);
 assert.match(css,/#app-competition-season-value\{[^}]*min-width:1ch;min-height:1em/);
 for(const id of ids){
  const html=read('competitions/'+id+'/index.html');
  assert.match(html,/class="app-world-detail-meta"/,id);
  assert.match(html,/<span id="app-competition-season-value"><\/span>/,id);
 }
});

test('A04: unresolved competition source retains verified standings and knockout rows',()=>{
 const source=read('assets/competition-page.js');
 assert.match(source,/if\(!context\.seasonData&&document\.querySelector\('\.app-world-standings'\)\?\.dataset\?\.standingsState!=='empty'\)return/);
 assert.match(source,/catch\{\/\* Rejected\/incomplete source must not erase the previously verified view\. \*\/\}/);
 assert.match(source,/if\(!data\)\{empty\(\);resetBracket\(\);return;\}/);
});

test('A04: pending source does not mutate knockout graph before data commit',()=>{
 const source=read('assets/competition-page.js');
 const refresh=source.indexOf('    function refresh(){',source.indexOf('  function bindSuppliedPanels('));
 const pending=source.indexOf("if(!context.seasonData&&document.querySelector",refresh);
 const knockout=source.indexOf('const nextGraph=JSON.stringify(',refresh);
 const bracket=source.indexOf('replacePostseason(definition)',refresh);
 assert.ok(refresh>=0&&pending>refresh&&knockout>pending&&bracket>knockout);
});

test('A04 international first-paint shell reserves knockout legs and correct match slots',()=>{
 for(const id of ['int-1','int-2']){
  const html=read('competitions/'+id+'/index.html');
  assert.match(html,/<script data-fixtures-first-paint>/);
  assert.match(html,/const ties=\{playoffs:4,quarterfinals:4,semifinals:2,final:1\}/);
  assert.match(html,/const legs=phase==='final'\?1:2/);
  assert.match(html,/if\(legs===2\)\{const section=document\.createElement\('li'\)/);
  assert.match(html,/list\.replaceChildren\(\.\.\.rows\)/);
 }
});
