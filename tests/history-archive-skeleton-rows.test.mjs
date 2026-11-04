import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Regression: the loading manager re-mounts templates independently of the
// first-paint script. It must reconcile rows on every subsequent load.
const source=readFileSync(new URL('../assets/standings-loading.js',import.meta.url),'utf8');
const match=source.match(/        const archive=current\.querySelector\('\.app-history-dev-archive'\);[\s\S]*?        }\n      }/);
assert.ok(match,'archive rows are reconciled during the loading lifecycle');
const resize=match[0].slice(0,-8);
function fakeArchive(){
 const rows=Array.from({length:4},(_,i)=>({dataset:{skeletonArchiveRow:String(i)},hidden:false,
   cloneNode(){return {dataset:{...this.dataset},hidden:false,cloneNode:this.cloneNode}}}));
 return {rows,querySelector(){return rows[0]},querySelectorAll(){return [...rows]},append(row){rows.push(row)}};
}
for(const [season,completed,expected] of [[2,1,1],[3,2,2],[4,3,3],[6,5,5],[7,6,6]]){
 test('archive loading rows match '+completed+' completed seasons',()=>{
  const archive=fakeArchive(),current={querySelector(){return archive}};
  runInNewContext('const current=ctx.current,completed=ctx.completed;'+resize,{ctx:{current,completed}});
  assert.equal(archive.rows.filter(row=>!row.hidden).length,expected);
  assert.equal(archive.rows.length,Math.max(4,completed));
  assert.deepEqual(archive.rows.map(row=>Number(row.dataset.skeletonArchiveRow)),Array.from({length:archive.rows.length},(_,i)=>i));
 });
}
test('archive loading rows contract after a later season regression',()=>{
 const archive=fakeArchive(),current={querySelector(){return archive}};
 const reconcile=completed=>runInNewContext('const current=ctx.current,completed=ctx.completed;'+resize,{ctx:{current,completed}});
 reconcile(5);reconcile(2);
 assert.equal(archive.rows.length,5);
 assert.equal(archive.rows.filter(row=>!row.hidden).length,2);
});

test('Season 0 uses the empty archive message instead of fabricated podium rows',()=>{
 const loading=readFileSync(new URL('../assets/standings-loading.js',import.meta.url),'utf8');
 const firstPaint=readFileSync(new URL('../tools/competition-view-skeletons.mjs',import.meta.url),'utf8');
 assert.match(loading,/season=Number\(root\.document\.documentElement\.dataset\.faDevCurrentSeason\?\?progress\.currentSeason\?\?1\)/);
 assert.match(loading,/if\(completed===0\)/);
 assert.match(firstPaint,/const completed=Math\.max\(0,/);
 assert.match(firstPaint,/if\(completed===0\)/);
 assert.match(firstPaint,/competitionHistoryEmpty/);
});


test('Season 0 uses the DEV archive shell rather than published Hall of Champions',()=>{
 const loading=readFileSync(new URL('../assets/standings-loading.js',import.meta.url),'utf8');
 const firstPaint=readFileSync(new URL('../tools/competition-view-skeletons.mjs',import.meta.url),'utf8');
 assert.match(loading,/history-preview/);
 assert.doesNotMatch(loading,/view==='history'&&preview&&season===0\)\{current\?\.remove\(\)/);
 assert.match(firstPaint,/if\(template&&skeleton\)skeleton\.replaceWith\(template\.content\.cloneNode\(true\)\)/);
 assert.match(firstPaint,/if\(completed===0\)/);
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
