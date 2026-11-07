import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {renderViewSkeleton,viewSkeletonScript} from '../tools/competition-view-skeletons.mjs';

// Regression: the loading manager re-mounts templates independently of the
// first-paint script. It must reconcile rows on every subsequent load.
const source=readFileSync(new URL('../assets/standings-loading.js',import.meta.url),'utf8');
const match=source.match(/        const archive=current\.querySelector\('\.app-history-dev-archive'\);[\s\S]*?        }\n      }/);
assert.ok(match,'archive rows are reconciled during the loading lifecycle');
const resize=match[0].slice(0,-8);
function fakeArchive(){
 const rows=Array.from({length:1},(_,i)=>({dataset:{skeletonArchiveRow:String(i)},hidden:false,
   cloneNode(){return {dataset:{...this.dataset},hidden:false,cloneNode:this.cloneNode}}}));
 return {rows,querySelector(){return rows[0]},querySelectorAll(){return [...rows]},append(row){rows.push(row)}};
}
for(const [season,completed,expected] of [[2,1,1],[3,2,2],[4,3,3],[6,5,5],[7,6,6]]){
 test('archive loading rows match '+completed+' completed seasons',()=>{
  const archive=fakeArchive(),current={querySelector(){return archive}};
  runInNewContext('const current=ctx.current,completed=ctx.completed,knownSeason=ctx.knownSeason,knownCompleted=ctx.knownCompleted;'+resize,{ctx:{current,completed,knownSeason:completed+1,knownCompleted:true}});
  assert.equal(archive.rows.filter(row=>!row.hidden).length,expected);
  assert.equal(archive.rows.length,Math.max(1,completed));
  assert.deepEqual(archive.rows.map(row=>Number(row.dataset.skeletonArchiveRow)),Array.from({length:archive.rows.length},(_,i)=>i));
 });
}
test('archive loading rows contract after a later season regression',()=>{
 const archive=fakeArchive(),current={querySelector(){return archive}};
 const reconcile=completed=>runInNewContext('const current=ctx.current,completed=ctx.completed,knownSeason=ctx.knownSeason,knownCompleted=ctx.knownCompleted;'+resize,{ctx:{current,completed,knownSeason:completed+1,knownCompleted:true}});
 reconcile(5);reconcile(2);
 assert.equal(archive.rows.length,5);
 assert.equal(archive.rows.filter(row=>!row.hidden).length,2);
});

test('unresolved public season preserves exactly one archive slot until count is known',()=>{
 const archive=fakeArchive(),current={querySelector(){return archive}};
 runInNewContext('const current=ctx.current,completed=ctx.completed,knownSeason=undefined,knownCompleted=false;'+resize,{ctx:{current,completed:0}});
 assert.equal(archive.rows.length,1);
 assert.equal(archive.rows.filter(row=>!row.hidden).length,1);
});

test('Season 0 uses the empty archive message instead of fabricated podium rows',()=>{
 const loading=readFileSync(new URL('../assets/standings-loading.js',import.meta.url),'utf8');
 const firstPaint=readFileSync(new URL('../tools/competition-view-skeletons.mjs',import.meta.url),'utf8');
 assert.match(loading,/knownSeason=\(preview\?/);
 assert.match(loading,/season=Number\(knownSeason\?\?1\)/);
 assert.match(loading,/if\(completed===0&&knownCompleted\)/);
 assert.match(firstPaint,/const completed=Math\.max\(0,/);
 assert.match(firstPaint,/if\(completed===0&&knownCompleted\)/);
 assert.match(firstPaint,/competitionHistoryEmpty/);
});


test('Season 0 uses the DEV archive shell rather than published Hall of Champions',()=>{
 const loading=readFileSync(new URL('../assets/standings-loading.js',import.meta.url),'utf8');
 const firstPaint=readFileSync(new URL('../tools/competition-view-skeletons.mjs',import.meta.url),'utf8');
 assert.match(loading,/history-preview/);
 assert.doesNotMatch(loading,/view==='history'&&preview&&season===0\)\{current\?\.remove\(\)/);
 assert.match(firstPaint,/if\(template&&skeleton\)skeleton\.replaceWith\(template\.content\.cloneNode\(true\)\)/);
 assert.match(firstPaint,/if\(completed===0&&knownCompleted\)/);
});

test('Static Season 0 History uses the same archive wrapper and panel spacing as other seasons',()=>{
 const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 const renderer=readFileSync(new URL('../tools/render-competition-page.mjs',import.meta.url),'utf8');
 const loading=readFileSync(new URL('../assets/standings-loading.js',import.meta.url),'utf8');
 assert.ok(css.includes('.app-competition-panel{margin-top:14px;min-width:0'));
 assert.doesNotMatch(css,/data-fa-history-static="true"\\] #competition-panel-history\\{margin-top:/);
 assert.match(renderer,/app-world-standings app-view-skeleton-history-archive"><p class="app-competition-empty-row"/);
 assert.match(css,/\.app-history-empty\[hidden\]/);
});

test('Static Season 0 History retains the final archive geometry and record labels on every route',()=>{
 const slugs=['br','de','eng','es','fr','it','nl','pt'].flatMap(country=>[country+'-1',country+'-2']).concat(['int-1','int-2']);
 for(const slug of slugs){
  const html=readFileSync(new URL('../competitions/'+slug+'/index.html',import.meta.url),'utf8');
  const start=html.indexOf('<div class="app-history-empty" data-history-empty>');
  assert.ok(start>=0,slug+' includes the static empty-state structure');
  const record=html.slice(start,start+16000);
  assert.match(record,/<div class="app-world-standings app-view-skeleton-history-archive"><p class="app-competition-empty-row"/,slug+' archive matches loaded History spacing');
  assert.match(record,/data-history-record-scope="season" aria-pressed="true" data-app-i18n="historySeasonRecords">Season<\/button>/,slug+' final Season label');
  assert.match(record,/data-history-record-scope="all-time" aria-pressed="false" data-app-i18n="historyAllTimeRecords">All-time<\/button>/,slug+' final All-time label');
  assert.ok(record.includes('data-history-team-empty')&&record.includes('data-history-player-empty'),slug+' static empty records');
 }
});

// The generated initial markup must use the current renderer, not an outdated
// authoritative-only History shell with a separately updated template.
test('History initial skeleton and all view bootstrap scripts match the shared renderer',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url),'utf8'));
 for(const competition of manifest.competitions){
  const html=readFileSync(new URL('../competitions/'+competition.slug+'/index.html',import.meta.url),'utf8');
  const sectionStart=html.indexOf('id="competition-panel-history"');
  const emptyStart=html.indexOf('<div class="app-history-empty" data-history-empty>',sectionStart);
  assert.ok(sectionStart>=0&&emptyStart>sectionStart,competition.id+' History panel boundaries');
  assert.ok(html.slice(sectionStart,emptyStart).includes(renderViewSkeleton(competition,'history')),
   competition.id+' History initial shell is generated from current preview renderer');
  for(const view of ['stats','history','awards'])
   assert.ok(html.includes(viewSkeletonScript(view)),competition.id+' '+view+' uses current first-paint bootstrap');
 }
});


test('Archive skeleton never guesses four rows and only adds separators between visible rows',()=>{
 const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 const generator=readFileSync(new URL('../tools/competition-view-skeletons.mjs',import.meta.url),'utf8');
 const loading=readFileSync(new URL('../assets/standings-loading.js',import.meta.url),'utf8');
 assert.match(generator,/Array\.from\(\{length:1\},\(_,i\)=>'<li data-skeleton-archive-row=/);
 assert.match(generator,/const needed=knownCompleted\?Math\.max\(1,completed\):1/);
 assert.match(loading,/const needed=knownCompleted\?Math\.max\(1,completed\):1/);
 assert.match(css,/\.app-view-skeleton-history-archive \.app-history-dev-archive li\{border-bottom:0\}/);
 assert.match(css,/\.app-view-skeleton-history-archive \.app-history-dev-archive li:not\(\[hidden\]\)~li:not\(\[hidden\]\)\{border-top:1px solid var\(--line\)\}/);
 const archive=fakeArchive(),current={querySelector(){return archive}};
 // A known season alone is insufficient when its day/matchday is unknown.
 runInNewContext('const current=ctx.current,completed=2,knownSeason=3,knownCompleted=false;'+resize,{ctx:{current}});
 assert.equal(archive.rows.length,1);
 assert.equal(archive.rows.filter(row=>!row.hidden).length,1);
});

test('History has Historical records before Season archive in loading and empty shells on every route',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url),'utf8'));
 for(const slug of [...manifest.competitions.map(c=>c.slug),'_shared']){
  const html=readFileSync(new URL('../competitions/'+slug+'/index.html',import.meta.url),'utf8');
  const positions=[...html.matchAll(/data-competition-skeleton-root="history-preview"/g)].map(m=>m.index);
  assert.equal(positions.length,2,slug+' includes initial and template preview skeleton');
  for(const start of positions){
   const shell=html.slice(start,start+18000);
   const records=shell.indexOf('data-app-i18n="historyHistoricalRecords"');
   const archive=shell.indexOf('data-app-i18n="historySeasonArchive"');
   assert.ok(records>0&&archive>records,slug+' loading History puts records ahead of archive');
   assert.ok(!shell.slice(0,archive+2000).includes('data-skeleton-archive-row="1"'),
    slug+' unresolved skeleton initially contains a single archive row');
  }
  const empty=html.indexOf('<div class="app-history-empty" data-history-empty>');
  const area=html.slice(empty,empty+18000);
  assert.ok(empty>0&&area.indexOf('data-app-i18n="historyHistoricalRecords"')<area.indexOf('data-app-i18n="historySeasonArchive"'),
   slug+' static empty History puts records ahead of archive');
 }
});
