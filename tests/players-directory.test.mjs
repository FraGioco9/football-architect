import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
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

test('Players #505 toolbar reserves the API-backed total beside the attribute groups',()=>{
 const html=read('players/index.html'),generator=read('tools/generate-app-pages.mjs');
 const code=read('assets/players-directory.js'),css=read('assets/app.css');
 assert.match(html,/<header class="app-players-header">[\s\S]*?id="players-title"[\s\S]*?<\/header>/);
 assert.match(html,/<div class="app-players-toolbar">[\s\S]*?class="app-players-groups"[\s\S]*?data-players-group="goalkeeping"[\s\S]*?data-players-count aria-live="polite"/);
 const header=html.match(/<header class="app-players-header">([\s\S]*?)<\/header>/)?.[1];
 assert.ok(header,'title header exists');
 assert.doesNotMatch(header,/data-players-count/);
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
 assert.match(css,/\.app-players-header\{min-width:0\}/);
 assert.match(css,/\.app-players-toolbar\{display:flex;[^}]*height:44px/);
 assert.match(css,/\.app-players-toolbar\{height:76px/);
});

test('Players two views retain shared canonical rows and approved four skill groups',()=>{
 const html=read('players/index.html'),renderer=read('assets/players-directory.js'),css=read('assets/app.css');
 const generator=read('tools/generate-app-pages.mjs');
 for(const group of ['physical','technical','mental','goalkeeping']){
  assert.ok(html.includes('data-players-group="'+group+'"'),group);
  assert.ok(renderer.includes(group+':['),group);
 }
 assert.doesNotMatch(html,/data-players-filter|app-players-filters/);
 assert.doesNotMatch(renderer,/data-players-filter|state\.nationality|state\.position/);
 assert.match(html,/class="app-players-table"/);
 assert.match(renderer,/history\[mode\]/);
 assert.match(renderer,/window\.addEventListener\('popstate'/);
 assert.match(renderer,/new URLSearchParams\(location\.search\)/);
 assert.match(renderer,/groups\[state\.group\]/);
 assert.match(renderer,/data\.count/);
 assert.doesNotMatch(css,/\.app-players-filters|\.app-players-filter-control/);
 assert.match(css,/\.app-players-tabs \.app-competition-tab\{[^}]*transition:background-color/);
 assert.doesNotMatch(css,/\.app-players-tabs \.app-competition-tab\[aria-selected="true"\]::after/);
 assert.match(generator,/data-players-first-paint/);
});

test('Players attribute group controls stay all visible without horizontal scrolling at desktop and mobile sizes',()=>{
 const css=read('assets/app.css');
 const html=read('players/index.html');
 assert.match(css,/\.app-players-groups\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\);grid-auto-rows:34px/);
 assert.match(css,/html:not\(\[data-players-view="attributes"\]\) \.app-players-groups\{visibility:hidden;pointer-events:none\}/);
 assert.match(css,/\.app-players-toolbar\{display:flex;[^}]*height:44px/);
 assert.match(css,/\.app-players-toolbar\{height:76px/);
 assert.match(css,/\.app-players-groups\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);grid-auto-rows:34px/);
 assert.match(css,/\.app-players-group\{[^}]*white-space:normal/);
 assert.match(html,/class="app-competition-tab app-players-group/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{/);
 for(const group of ['physical','technical','mental','goalkeeping'])
  assert.match(html,new RegExp('data-players-group="'+group+'"'));
});

test('Players first paint never selects or replaces the html root despite its state data attributes',()=>{
 const html=read('players/index.html');
 const generator=read('tools/generate-app-pages.mjs');
 const renderer=read('assets/players-directory.js');
 const script=html.match(/<script data-players-first-paint>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'first paint script must be part of the parser-created shell');
 for(const source of [script,renderer]){
  assert.doesNotMatch(source,/document\.querySelectorAll\(['"]\[data-players-(?:view|group)\]/);
  assert.ok(source.includes(".app-players-tabs [data-players-view]"));
  assert.ok(source.includes(".app-players-groups [data-players-group]"));
 }
 assert.ok(generator.includes('.app-players-tabs [data-players-view]'));
 assert.ok(generator.includes('.app-players-groups [data-players-group]'));
 for(const search of ['', '?view=attributes&group=goalkeeping']){
  const root={
   lang:'en',dataset:{},
   set textContent(_value){throw Error('Changing HTML root textContent deletes sidebar, styles and table')},
  };
  const element=(dataset={})=>({
   dataset,classList:{toggle(){}},setAttribute(){},textContent:'',options:[{textContent:''}]
  });
  const views=['overview','attributes'].map(playersView=>element({playersView}));
  const groups=['technical','mental','physical','goalkeeping'].map(playersGroup=>element({playersGroup}));
  const row={cells:[{},{},{},{},{},{}],deleteCell(i){this.cells.splice(i,1)},append(node){this.cells.push(node)}};
  const table={tHead:{rows:[row]},tBodies:[{rows:[{cells:[{colSpan:6}]}]}],dataset:{}};
  const document={
   documentElement:root,
   querySelectorAll(selector){
    if(selector==='[data-players-view]')return [root,...views];
    if(selector==='[data-players-group]')return [root,...groups];
    if(selector==='.app-players-tabs [data-players-view]')return views;
    if(selector==='.app-players-groups [data-players-group]')return groups;
    return [];
   },
   querySelector(selector){if(selector==='.app-players-table')return table;throw Error('Unexpected query '+selector)},
   createElement(){return {scope:'',textContent:''}}
  };
  runInNewContext(script,{document,location:{search},URLSearchParams});
  assert.equal(root.dataset.playersView,search?'attributes':'overview');
  assert.equal(root.dataset.playersGroup,search?'goalkeeping':'technical');
  assert.equal(views[0].textContent,'Overview');
  assert.equal(groups[0].textContent,'Technical');
  assert.equal(groups[3].textContent,'Goalkeeper');
  if(search)assert.equal(table.dataset.playersTableMode,'attributes');
 }
});

test('Players toolbar remains in document flow across main views and count is outside the hidden group',()=>{
 const html=read('players/index.html'),css=read('assets/app.css'),code=read('assets/players-directory.js');
 const toolbar=html.slice(html.indexOf('<div class="app-players-toolbar">'),html.indexOf('<div class="app-players-table-scroll"'));
 assert.equal((toolbar.match(/data-players-count/g)||[]).length,1);
 assert.equal((toolbar.match(/data-players-group="/g)||[]).length,4);
 assert.ok(toolbar.indexOf('</nav>')<toolbar.indexOf('data-players-count'),'count must be sibling of the view-specific group nav');
 assert.ok(css.includes('html:not([data-players-view="attributes"]) .app-players-groups{visibility:hidden;pointer-events:none}'));
 assert.doesNotMatch(css,/html:not\(\[data-players-view="attributes"\]\) \.app-players-groups\{display:none/);
 assert.match(code,/function changeView\(view\)\{[^}]*state\.view=view;syncUrl\(\);refresh\(\)/);
 assert.doesNotMatch(code,/data-players-filter|state\.nationality|state\.position/);
});

test('Players groups use Technical, Mental, Physical, Goalkeeper order while attribute names keep their historical field mapping',()=>{
 const html=read('players/index.html'),renderer=read('assets/players-directory.js'),generator=read('tools/generate-app-pages.mjs');
 const order=[...html.matchAll(/data-players-group="(technical|mental|physical|goalkeeping)"/g)].map(m=>m[1]);
 assert.deepEqual(order,['technical','mental','physical','goalkeeping']);
 assert.match(html,/data-players-group="technical">Technical<\/button>/);
 assert.match(html,/data-players-group="goalkeeping">Goalkeeper<\/button>/);
 assert.match(html,/group=Object\.hasOwn\(groups,params\.get\('group'\)\)\?params\.get\('group'\):'technical'/);
 assert.match(renderer,/group:Object\.hasOwn\(groups,p\.get\('group'\)\)\?p\.get\('group'\):'technical'/);
 assert.match(renderer,/if\(state\.view==='attributes'\)url\.searchParams\.set\('group',state\.group\)/);
 assert.match(html,/const keysAll=\['speed','strength','stamina','agility','passing'/i);
 assert.match(renderer,/const allAttrs=\['speed','strength','stamina','agility','passing'/i);
 assert.ok(generator.includes('data-players-group='),'generated HTML must retain group buttons');
});
test('Players public shell reserves exact common flag and name widths in every view, without moving total count',()=>{
 const html=read('players/index.html'),css=read('assets/app.css');
 const colgroup=html.match(/<colgroup>([\s\S]*?)<\/colgroup>/)?.[1];
 assert.ok(colgroup,'fixed first two columns exist from first paint');
 assert.match(colgroup,/col class="app-players-flag-column"/);
 assert.match(colgroup,/col class="app-players-name-column"/);
 assert.match(css,/--app-players-flag-width:54px;--app-players-name-width:248px/);
 assert.match(css,/col\.app-players-flag-column\{width:var\(--app-players-flag-width\)\}/);
 assert.match(css,/col\.app-players-name-column\{width:var\(--app-players-name-width\)\}/);
 assert.match(css,/\.app-players-table th:nth-child\(2\)\{width:var\(--app-players-name-width\);text-align:left\}/);
 assert.match(css,/\.app-players-table\[data-players-table-mode="attributes"\] :is\(th,td\):nth-child\(2\)\{width:var\(--app-players-name-width\);text-align:left\}/);
 assert.doesNotMatch(css,/\.app-players-table th:nth-child\(2\)\{width:35%/);
 assert.match(css,/\.app-players-count\{[^}]*display:flex;align-items:center;justify-content:flex-end;[^}]*width:132px;height:44px/);
 assert.match(css,/\.app-players-count-skeleton\{[^}]*width:98px;height:14px/);
 assert.match(css,/\.app-players-count\{align-self:flex-start;flex-basis:102px;min-width:102px;width:102px;margin-top:0/);
 assert.match(css,/html:not\(\[data-players-view="attributes"\]\) \.app-players-groups\{visibility:hidden;pointer-events:none\}/);
});
test('Players receives the shared protected Debug Settings widget without publishing private scripts',()=>{
 const html=read('players/index.html');
 const local=read('tools/dev-standings-preview.mjs');
 const client=read('tools/dev-standings-preview-client.mjs');
 const artifact=read('tools/dev-preview-artifact.mjs');
 assert.doesNotMatch(html,/src="\/__fa_dev__\/debug-settings\.mjs"/,'public page must not directly load private Debug');
 assert.match(local,/\['dashboard\/index\.html','settings\/index\.html','clubs\/index\.html','players\/index\.html'\]/);
 assert.match(client,/const sharedPath=.*players/);
 assert.match(client,/createDebugWidget\(\{page:validPath\?"standings":clubPath\?"clubs":/);
 assert.match(artifact,/admin\|competitions\|clubs\|players/);
 assert.match(artifact,/path==="players\/index\.html"/);
});

test('Players view and group slugs are explicit even for both default selections',()=>{
 const html=read('players/index.html'),code=read('assets/players-directory.js');
 assert.match(html,/href="\/players\?view=overview"/);
 assert.match(html,/href="\/players\?view=attributes&amp;group=technical"/);
 assert.match(code,/url\.searchParams\.set\('view',state\.view\)/);
 assert.match(code,/if\(state\.view==='attributes'\)url\.searchParams\.set\('group',state\.group\)/);
 assert.match(code,/syncControls\(\);syncUrl\('replaceState'\);load\(state\.page\)/,'default direct URL normalized without extra history entry');
 assert.match(code,/state=next;syncControls\(\);syncUrl\('replaceState'\)/,'Back/Forward also restores canonical URLs');
 const begin=code.indexOf("  function syncUrl(mode='pushState'){"),end=code.indexOf("  function syncControls(){",begin);
 assert.ok(begin>=0&&end>begin,'extract actual production URL helper');
 const run=(state,search)=>{
  let current=new URL('http://localhost:2000/players'+search);
  const location={href:current.href,pathname:current.pathname,search:current.search,hash:current.hash};
  const history={state:null,pushState(_state,_unused,next){current=new URL(next,current)},replaceState(_state,_unused,next){current=new URL(next,current)}};
  runInNewContext(code.slice(begin,end)+"\nsyncUrl('replaceState')",{state,location,history,URL});
  return current.pathname+current.search;
 };
 assert.equal(run({view:'overview',group:'technical',page:1},''),'/players?view=overview');
 assert.equal(run({view:'attributes',group:'technical',page:1},'?view=attributes'),'/players?view=attributes&group=technical');
 assert.equal(run({view:'attributes',group:'mental',page:2},'?view=overview&page=2'),'/players?view=attributes&group=mental&page=2');
 assert.equal(run({view:'overview',group:'physical',page:1},'?view=attributes&group=physical'),'/players?view=overview');
});
test('Players primary view controls are larger than the compact attribute subgroup controls',()=>{
 const css=read('assets/app.css');
 assert.match(css,/\.app-players-tabs \.app-competition-tab\{[^}]*flex:0 0 160px;width:160px;min-width:160px;max-width:160px;height:46px;min-height:46px/);
 assert.match(css,/\.app-players-groups\{[^}]*grid-auto-rows:34px;[^}]*max-width:472px/);
 assert.match(css,/\.app-players-group\{[^}]*height:34px;min-height:34px/);
 assert.match(css,/\.app-players-tabs \.app-competition-tab\{flex:0 0 calc\(\(100% - 4px\)\/2\);[^}]*height:44px;min-height:44px/);
 assert.match(css,/\.app-players-toolbar\{height:76px;align-items:flex-start/);
 assert.match(css,/\.app-players-groups\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);grid-auto-rows:34px/);
});

test('Players approved hybrid widths retain exact flag/name columns and distribute all remaining space proportionally',()=>{
 const html=read('players/index.html'),css=read('assets/app.css');
 const fixed='100% - var(--app-players-flag-width) - var(--app-players-name-width)';
 assert.match(html,/<colgroup><col class="app-players-flag-column"><col class="app-players-name-column"><\/colgroup>/);
 assert.match(css,/--app-players-flag-width:54px;--app-players-name-width:248px;width:100%;min-width:782px/);
 assert.match(css,/col\.app-players-flag-column\{width:var\(--app-players-flag-width\)\}/);
 assert.match(css,/col\.app-players-name-column\{width:var\(--app-players-name-width\)\}/);
 const overview=[['Age',3,0.17],['Positions',4,0.42],['Height',5,0.21],['Foot',6,0.20]];
 for(const [name,column,fraction] of overview)
  assert.ok(css.includes('.app-players-table th:nth-child('+column+'){width:calc(('+fixed+') * '+fraction.toFixed(2)+')}'),name+' must use a percentage of the flexible portion, not a percent of the whole table');
 assert.equal(overview.reduce((total,[,,fraction])=>total+Math.round(fraction*100),0),100);
 const attrSelector='.app-players-table[data-players-table-mode="attributes"] th:nth-child(n+3)';
 assert.ok(css.includes('.app-players-table[data-players-table-mode="attributes"]{min-width:782px}'));
 assert.ok(css.includes(attrSelector+'{width:calc(('+fixed+') / 4)}'));
 assert.ok(css.includes('html[data-players-group="technical"] .app-players-table[data-players-table-mode="attributes"]{min-width:1262px}'));
 assert.ok(css.includes('html[data-players-group="technical"] '+attrSelector+'{width:calc(('+fixed+') / 8)}'));
 assert.doesNotMatch(css,/\.app-players-table\[data-players-table-mode="attributes"\] :is\(th,td\):nth-child\(n\+3\)\{width:120px/);
 for(const total of [782,1262,1440,1920]){
  const variable=total-54-248;
  assert.ok(variable>=480);
  const widths=overview.map(([, ,fraction])=>variable*fraction);
  assert.ok(Math.abs(widths.reduce((sum,width)=>sum+width,0)-variable)<1e-8);
  assert.ok(Math.abs(variable/4*4-variable)<1e-8);
  assert.ok(Math.abs(variable/8*8-variable)<1e-8);
 }
 assert.equal(54+248+4*120,782,'four-attribute minimum remains readable');
 assert.equal(54+248+8*120,1262,'technical minimum avoids compressed headings');
});
