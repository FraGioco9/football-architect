import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {renderViewSkeleton,viewSkeletonFirstPaint,viewSkeletonScript} from '../tools/competition-view-skeletons.mjs';

const require=createRequire(import.meta.url);
const rulesView=require('../assets/competition-rules-view.js');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=JSON.parse(read('competitions/_shared/manifest.json'));

test('PAGE-LOAD-03C: all 18 routes publish canonical Rules and view-specific reserved shells',()=>{
 assert.equal(manifest.competitions.length,18);
 for(const definition of manifest.competitions){
  const slug=definition.slug,html=read('competitions/'+slug+'/index.html');
  assert.ok(html.includes('<section id="competition-panel-rules"'),slug+' first-paint Rules panel');
  assert.ok(html.includes(rulesView.renderRules(definition,'en')),slug+' exact canonical static Rules content');
  assert.equal((html.match(/id="competition-tab-(?:standings|postseason|fixtures|stats|history|rules|awards)"/g)||[]).length,7,slug+' permanent tabs');
  for(const view of ['stats','history','awards']){
   assert.ok(html.includes('id="competition-panel-'+view+'"'),slug+' permanent '+view+' panel');
   assert.ok(html.includes(renderViewSkeleton(definition,view)),slug+' '+view+' first-paint reserved layout');
   assert.ok(html.includes(viewSkeletonScript(view)),slug+' '+view+' canonical parser-time bootstrap');
  }
  assert.equal((html.match(/data-view-skeleton-first-paint=/g)||[]).length,3,slug+' three parser-time view bootstraps');
  assert.equal((html.match(/data-fa-competition-selected-panel-first-paint/g)||[]).length,1,slug+' parser-time selected panel correction');
 }
});

test('PAGE-LOAD-03C: parser-time selected view exclusively unhides its panel',()=>{
 const html=read('competitions/it-1/index.html');
 const startTag='<script data-fa-competition-selected-panel-first-paint>';
 const start=html.indexOf(startTag);
 const code=start<0?'':html.slice(start+startTag.length,html.indexOf('</script>',start));
 assert.ok(code,'the static parser-time view selector must exist');
 for(const view of ['standings','postseason','fixtures','stats','history','rules','awards']){
  const panels=['standings','postseason','fixtures','stats','history','rules','awards'].map(id=>({id:'competition-panel-'+id,hidden:id!=='standings'}));
  const document={documentElement:{dataset:{competitionView:view}},querySelectorAll:()=>panels};
  runInNewContext(code,{document});
  assert.deepEqual(panels.filter(p=>!p.hidden).map(p=>p.id),['competition-panel-'+view],view+' only its view visible');
 }
});

function inspectHistoryPrepaint({debugEnabled,devSeason,progress}){
 let removed=0,emptyShown=0;
 const rows=Array.from({length:4},(_,i)=>({dataset:{skeletonArchiveRow:String(i)},hidden:false,cloneNode(){return {dataset:{...this.dataset},hidden:false,cloneNode:this.cloneNode}}}));
 const archive={children:rows,querySelector:()=>rows[0],querySelectorAll:()=>[...rows],append:row=>rows.push(row)};
 const skeleton={dataset:{skeletonLastLeagueDay:'56',skeletonLeagueRounds:'30'},remove:()=>{removed++},replaceWith:()=>{},querySelector:sel=>sel==='.app-history-dev-archive'?archive:null};
 const empty={removeAttribute:()=>{emptyShown++}};
 const panel={hidden:true,querySelector:sel=>sel==='[data-competition-skeleton-root]'?skeleton:sel==='[data-history-empty]'?empty:null};
 const document={documentElement:{dataset:{faDevSeasons:'1,2,3,4',faDevCurrentSeason:String(devSeason),competitionView:'history'},removeAttribute:()=>{}},getElementById:()=>panel,querySelector:()=>({content:{cloneNode:()=>({})}})};
 const window={faDebugEnabled:debugEnabled,...(progress?{faFixturesInitialProgress:progress}:{})};
 runInNewContext('('+viewSkeletonFirstPaint.toString()+')("history")',{document,window});
 return {removed,emptyShown,rows:rows.map(row=>row.hidden)};
}

test('PAGE-LOAD-03C: Debug OFF uses the global world, never stale local Season 0',()=>{
 const actual=inspectHistoryPrepaint({debugEnabled:false,devSeason:0,progress:{currentSeason:2,day:1}});
 assert.equal(actual.removed,0,'pending global History remains in its reserved structure');
 assert.equal(actual.emptyShown,0,'local Season 0 never leaks into public History');
 assert.deepEqual(actual.rows,[false,true,true,true],'global Season 2 reserves one completed season');
});

test('PAGE-LOAD-03C: unknown public clock remains pending; isolated Season 0 may be empty',()=>{
 const unknown=inspectHistoryPrepaint({debugEnabled:false,devSeason:0});
 assert.equal(unknown.removed,0);
 assert.equal(unknown.emptyShown,0,'unknown public season is not confirmed empty');
 assert.deepEqual(unknown.rows,[false,false,false,false],'unknown clock retains reserved archive bars');
 const isolated=inspectHistoryPrepaint({debugEnabled:true,devSeason:0});
 assert.equal(isolated.removed,1,'explicit isolated Season 0 has a confirmed static-empty state');
 assert.equal(isolated.emptyShown,1);
});

test('PAGE-LOAD-03C: loading lifecycle shares the same isolated/public History rule',()=>{
 const source=read('assets/standings-loading.js');
 assert.match(source,/if\(view==='history'&&preview&&season===0\)/);
 assert.match(source,/knownSeason=\(preview\?/);
 assert.doesNotMatch(source,/season===0\|\|root\.faDebugEnabled===false/);
});

test('QA-05: the real History panel and its skeleton paint before other competition panels',()=>{
 for(const competition of manifest.competitions){
  const html=read('competitions/'+competition.slug+'/index.html');
  const history=html.indexOf('id="competition-panel-history"');
  const standings=html.indexOf('id="competition-panel-standings"');
  const skeleton=html.indexOf('data-competition-skeleton-root="history-preview"',history);
  const ready=html.indexOf('data-fa-history-first-paint-ready',history);
  assert.ok(history>0&&history<skeleton&&skeleton<ready&&ready<standings,
   competition.slug+' true History skeleton is revealed before Standings HTML');
  const preview=renderViewSkeleton(competition,'history');
  assert.ok(html.slice(history,standings).includes(preview),competition.slug+' sole History skeleton reserves the actual panel geometry');
  assert.ok(html.slice(history,standings).includes('document.getElementById("competition-panel-history").hidden=false'),
   competition.slug+' parser-time History panel is unhidden before the other tabs');
  assert.equal((html.match(/id="competition-panel-history"/g)||[]).length,1,competition.slug+' exactly one real History panel');
  assert.doesNotMatch(html,/app-history-first-paint|data-fa-history-early-ready|data-fa-history-early-handoff/,
   competition.slug+' never uses a temporary History shell and a synchronous handoff');
  assert.doesNotMatch(html,/historyFinalLeagueTable|app-view-skeleton-history-table/,
   competition.slug+' no History final table skeleton');
  const css=html.match(/<style data-fa-competition-shell>([^<]+)<\/style>/)?.[1]||'';
  const visibilityGuard='html[data-fa-competition-prepaint]:not([data-competition-view="history"]) body{visibility:hidden}';
  assert.ok(css.includes(visibilityGuard),competition.slug+' History must not be blocked by the body prepaint gate');
  assert.ok(!css.includes('html[data-fa-competition-prepaint] body{visibility:hidden}'),
   competition.slug+' no blanket body hiding');
  assert.ok(html.indexOf('id="competition-tab-history"')<history,competition.slug+' static tabs precede History content');
 }
 assert.doesNotMatch(read('competitions/_shared/index.html'),/historyFinalLeagueTable|app-view-skeleton-history-table/);
 assert.doesNotMatch(read('assets/authoritative-history.mjs'),/section\.append\(table\)|make\('table'\)|Final league table/);
});
