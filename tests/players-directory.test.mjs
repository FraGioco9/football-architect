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
 assert.match(code,/fetch\('\/api\/players\?'\+query\.toString\(\)/);
 assert.doesNotMatch(code,/\/api\/players\/page\//,'legacy pagination URL must not remain');
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
 assert.match(html,/class="app-players-count-placeholder" aria-hidden="true"/);
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
 assert.match(css,/\.app-players-toolbar\{height:44px;align-items:center/);
});

test('Players two views retain shared canonical rows and approved four skill groups',()=>{
 const html=read('players/index.html'),renderer=read('assets/players-directory.js'),css=read('assets/app.css');
 const generator=read('tools/generate-app-pages.mjs');
 for(const group of ['physical','technical','mental','goalkeeping']){
  assert.ok(html.includes('data-players-group="'+group+'"'),group);
  assert.ok(renderer.includes(group+':['),group);
 }
 assert.match(html,/class="app-players-filters"/);
 assert.match(renderer,/data-players-filter/);
 assert.match(html,/class="app-players-table"/);
 assert.match(renderer,/history\[mode\]/);
 assert.match(renderer,/window\.addEventListener\('popstate'/);
 assert.match(renderer,/new URLSearchParams\(location\.search\)/);
 assert.match(renderer,/groups\[state\.group\]/);
 assert.match(renderer,/data\.count/);
 assert.match(css,/\.app-players-filters\{display:grid/);
 assert.match(css,/\.app-players-tabs \.app-competition-tab\{[^}]*transition:background-color/);
 assert.doesNotMatch(css,/\.app-players-tabs \.app-competition-tab\[aria-selected="true"\]::after/);
 assert.match(generator,/data-players-first-paint/);
});

test('Players attribute groups use one horizontally scrollable mobile strip and keep the count outside',()=>{
 const css=read('assets/app.css');
 const html=read('players/index.html');
 assert.match(css,/\.app-players-groups\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\);grid-auto-rows:34px/);
 assert.match(css,/html:not\(\[data-players-view="attributes"\]\) \.app-players-groups\{visibility:hidden;pointer-events:none\}/);
 assert.match(css,/\.app-players-toolbar\{display:flex;[^}]*height:44px/);
 assert.match(css,/\.app-players-toolbar\{height:44px;align-items:center;gap:8px\}/,'mobile toolbar returns to one reserved row');
 assert.match(css,/\.app-players-groups\{display:flex;align-items:center;gap:4px;[^}]*overflow-x:auto;overflow-y:hidden;scrollbar-width:none/,'mobile groups scroll as one unwrapped strip');
 assert.match(css,/\.app-players-groups::-webkit-scrollbar\{display:none\}/,'hide the mobile group scrollbar like Club Roster');
 assert.match(css,/\.app-players-groups\{--app-tabs-fade-left:0px;--app-tabs-fade-right:0px;[^}]*mask-image:linear-gradient/,'mobile tabs inherit the conditional Club Roster mask');
 assert.match(css,/\.app-players-groups\[data-can-scroll-left="true"\]\{--app-tabs-fade-left:16px\}/);
 assert.match(css,/\.app-players-groups\[data-can-scroll-right="true"\]\{--app-tabs-fade-right:16px\}/);
 const script=read('assets/players-directory.js');
 assert.match(script,/groupBar\.dataset\.canScrollLeft=String\(maximum>1&&groupBar\.scrollLeft>1\)/);
 assert.match(script,/groupBar\.dataset\.canScrollRight=String\(maximum>1&&groupBar\.scrollLeft<maximum-1\)/);
 assert.match(script,/groupBar\?\.addEventListener\('scroll',syncGroupTabEdges,\{passive:true\}\)/);
 assert.match(script,/window\.addEventListener\('resize',syncGroupTabEdges,\{passive:true\}\)/);
 assert.match(css,/\.app-players-group\{flex:0 0 calc\(40% - 3\.2px\);[^}]*min-height:34px;height:34px;[^}]*white-space:nowrap/,'groups keep one row and expose a partial third');
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
 for(const search of ['', '?view=attributes&group=technical', '?view=attributes&group=mental', '?view=attributes&group=physical', '?view=attributes&group=goalkeeping']){
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
   createElement(){return {scope:'',textContent:'',dataset:{},append(child){this.textContent+=child?.textContent||'';},setAttribute(){},classList:{add(){}}}},
   createElementNS(){return {textContent:'',append(){},setAttribute(){},classList:{add(){}}}}
  };
  runInNewContext(script,{document,location:{search},URLSearchParams});
  assert.equal(root.dataset.playersView,search?'attributes':'overview');
  const group=new URLSearchParams(search).get('group')||'technical';
  assert.equal(root.dataset.playersGroup,group);
  assert.equal(views[0].textContent,'Overview');
  assert.equal(groups[0].textContent,'Technical');
  assert.equal(groups[3].textContent,'Goalkeeper');
  if(search){
   const expected=group==='technical'?11:7; // flag + name + Positions + 8/4 skills
   assert.equal(table.dataset.playersTableMode,'attributes');
   assert.equal(row.cells.length,expected);
   assert.equal(row.cells[2].textContent,'Positions','Positions must be third before the attributes');
   assert.equal(table.tBodies[0].rows[0].cells[0].colSpan,expected);
  } else assert.equal(row.cells.length,6,'Overview remains unchanged');
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
 assert.match(code,/function changeView\(view\)\{/);assert.match(code,/state\.view=view;/);assert.match(code,/if\(sortCleared\)load\(1\);else refresh\(\)/);
 assert.match(code,/function applyFilters\(\)/);
 assert.match(code,/const canonicalNumber=\(raw,min,max\)=>/,'age and height queries are canonicalized before Apply');
});

test('Players groups use Technical, Mental, Physical, Goalkeeper order while attribute names keep their historical field mapping',()=>{
 const html=read('players/index.html'),renderer=read('assets/players-directory.js'),generator=read('tools/generate-app-pages.mjs');
 const order=[...html.matchAll(/data-players-group="(technical|mental|physical|goalkeeping)"/g)].map(m=>m[1]);
 assert.deepEqual(order,['technical','mental','physical','goalkeeping']);
 assert.match(html,/data-players-group="technical">Technical<\/button>/);
 assert.match(html,/data-players-group="goalkeeping">Goalkeeper<\/button>/);
 assert.match(html,/group=Object\.hasOwn\(groups,params\.get\('group'\)\)\?params\.get\('group'\):'technical'/);
 assert.match(renderer,/group=Object\.hasOwn\(groups,p\.get\('group'\)\)\?p\.get\('group'\):'technical'/);
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
 assert.match(css,/\.app-players-count-placeholder\{[^}]*width:98px;height:14px/);
 assert.match(css,/\.app-players-count\{align-self:center;flex-basis:102px;min-width:102px;width:102px;margin-top:0/);
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
 assert.match(code,/syncControls\(\);revealActiveGroup\(\);syncUrl\('replaceState'\);load\(state\.page\)/,'default direct URL normalized without extra history entry');
 assert.match(code,/state=next;syncControls\(\);syncUrl\('replaceState'\)/,'Back/Forward also restores canonical URLs');
  const begin=code.indexOf("  function syncUrl(mode='pushState'){"),end=code.indexOf("  const filterSections=",begin);
 assert.ok(begin>=0&&end>begin,'extract actual production URL helper');
 const run=(state,search)=>{
  let current=new URL('http://localhost:2000/players'+search);
  const location={href:current.href,pathname:current.pathname,search:current.search,hash:current.hash};
  const history={state:null,pushState(_state,_unused,next){current=new URL(next,current)},replaceState(_state,_unused,next){current=new URL(next,current)}};
  runInNewContext(code.slice(begin,end)+"\nsyncUrl('replaceState')",{state,location,history,URL,filterKeys:['nationality','position','ageMin','ageMax','foot']});
  return current.pathname+current.search;
 };
 assert.equal(run({view:'overview',group:'technical',page:1},''),'/players?view=overview');
 assert.equal(run({view:'attributes',group:'technical',page:1},'?view=attributes'),'/players?view=attributes&group=technical');
 assert.equal(run({view:'attributes',group:'mental',page:2},'?view=overview&page=2'),'/players?view=attributes&group=mental&offset=50');
 assert.equal(run({view:'overview',group:'physical',page:1},'?view=attributes&group=physical'),'/players?view=overview');
 assert.equal(run({view:'attributes',group:'technical',page:2,filters:{nationality:'ITA',foot:'right'}},'?page=1'),'/players?view=attributes&group=technical&nationality=ITA&foot=right&offset=50');
 assert.equal(run({view:'overview',group:'technical',page:3},'?page=3'),'/players?view=overview&offset=100');
 assert.equal(run({view:'overview',group:'technical',page:1},'?page=2'),'/players?view=overview','obsolete page URL is scrubbed');
});
test('Players primary view controls are larger than the compact attribute subgroup controls',()=>{
 const css=read('assets/app.css');
 assert.match(css,/\.app-players-tabs \.app-competition-tab\{[^}]*display:flex;align-items:center;justify-content:center;[^}]*flex:0 0 136px;width:136px;min-width:136px;max-width:136px;height:40px;min-height:40px/);
 assert.match(css,/\.app-players-groups\{[^}]*grid-auto-rows:34px;[^}]*max-width:472px/);
 assert.match(css,/\.app-players-group\{[^}]*height:34px;min-height:34px/);
 assert.match(css,/\.app-players-tabs \.app-competition-tab\{flex:0 0 min\(136px,calc\(\(100% - 4px\)\/2\)\);[^}]*height:40px;min-height:40px/);
 assert.match(css,/\.app-players-toolbar\{height:44px;align-items:center/,'mobile subview toolbar reserves one row');
 assert.match(css,/\.app-players-groups\{display:flex;align-items:center;gap:4px;[^}]*overflow-x:auto/,'mobile subgroup controls scroll in one row');
});

test('#532 public Overview renders Flag Player Positions Age Height Foot Club and a crest',()=>{
 const html=read('players/index.html'),gen=read('tools/generate-app-pages.mjs'),js=read('assets/players-directory.js'),css=read('assets/app.css');
 const head=html.slice(html.indexOf('<table class="app-players-table"'),html.indexOf('</thead>',html.indexOf('<table class="app-players-table"')));
 assert.deepEqual([...head.matchAll(/data-players-sort="([^"]+)"/g)].map(m=>m[1]),['nationality','name','positions','age','height','foot']);
 assert.ok(head.indexOf('data-players-sort="foot"')<head.indexOf('app-players-club-col'));
 assert.equal((html.match(/colspan="7"/g)||[]).length,5);
 assert.match(js,/const cols=\(\)=>state\.view==='attributes'\?3\+groups\[state\.group\]\.length:7/);
 assert.match(js,/addHeader\(t\.columns\[2\],'positions'\);\s*addHeader\(t\.columns\[1\],'age'\);addHeader\(t\.columns\[3\],'height'\);addHeader\(t\.columns\[4\],'foot'\)/);
 assert.match(js,/if\(state\.view==='overview'\)\{\s*cell\(tr,positionsShown\.join\(', '\)\|\|'—'\)/);
 assert.match(js,/clubCell\(tr,player\);\s*\}else \{/);
 assert.match(css,/\.app-players-table\[data-players-public\]:not\(\[data-players-table-mode="attributes"\]\) col\.app-players-view-third-column\{width:var\(--app-players-positions-width\)\}/);
 assert.match(css,/\.app-players-table\[data-players-table-mode="attributes"\] col\.app-players-view-third-column\{width:var\(--app-players-positions-width\)\}/);
 assert.match(html,/while\(row\.cells\.length>2\)row\.deleteCell\(2\)/);
 assert.match(js,/fetch\('\/clubs\/_shared\/manifest\.json',\{credentials:'omit',cache:'force-cache'\}\)/);
 assert.match(js,/Object\.hasOwn\(catalog,key\)\|\|catalog\[key\]!==path/);
 assert.match(js,/crest\.dataset\.playerClubCrest=player\.clubKey/);
 assert.match(js,/link\.href='\/clubs\/'\+country\.toLowerCase\(\)\+'\/'\+id\+'\/overview'/);
 assert.match(css,/\.app-players-club-content\{display:flex;align-items:center;[^}]*height:28px;gap:8px/);
 assert.match(css,/\.app-players-club-crest\{[^}]*width:24px;height:24px;object-fit:contain/);
 assert.match(css,/\.app-players-club-mark\{[^}]*flex:0 0 24px;width:24px;height:24px;overflow:hidden/);
 assert.match(css,/\.app-players-club-mark::before\{[^}]*width:20px;height:23px/);
 assert.match(js,/image\.src='\/'\+path;image\.alt='';image\.width=24;image\.height=24/);
 assert.match(css,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link,\.app-player-club-link\)::after\{[^}]*bottom:0;height:1px/);
 assert.doesNotMatch(css,/\.app-players-table \.app-player-club-link:hover\{text-decoration:underline/);
 assert.ok(gen.indexOf('data-players-sort=\\\"foot')<gen.indexOf('app-players-club-col'));
});
test('Players approved hybrid widths retain exact flag/name columns and distribute all remaining space proportionally',()=>{
 const html=read('players/index.html'),css=read('assets/app.css');
 const fixed='100% - var(--app-players-flag-width) - var(--app-players-name-width)';
 assert.match(html,/<colgroup><col class="app-players-flag-column"><col class="app-players-name-column"><col class="app-players-view-third-column"><\/colgroup>/);
 assert.match(css,/--app-players-flag-width:54px;--app-players-name-width:248px;--app-players-positions-width:200px;width:100%;min-width:782px/);
 assert.match(css,/col\.app-players-flag-column\{width:var\(--app-players-flag-width\)\}/);
 assert.match(css,/col\.app-players-name-column\{width:var\(--app-players-name-width\)\}/);
 const overview=[['Age',3,0.17],['Positions',4,0.42],['Height',5,0.21],['Foot',6,0.20]];
 for(const [name,column,fraction] of overview)
  assert.ok(css.includes('.app-players-table th:nth-child('+column+'){width:calc(('+fixed+') * '+fraction.toFixed(2)+')}'),name+' must use a percentage of the flexible portion, not a percent of the whole table');
 assert.equal(overview.reduce((total,[,,fraction])=>total+Math.round(fraction*100),0),100);
 const attrSelector='.app-players-table[data-players-table-mode="attributes"] th:nth-child(n+3)';
 const attrFixed=fixed+' - var(--app-players-positions-width)';
 const attrSelector4='.app-players-table[data-players-table-mode="attributes"] th:nth-child(n+4)';
 assert.ok(css.includes('--app-players-positions-width:200px'));
 assert.ok(css.includes('.app-players-table[data-players-table-mode="attributes"]{min-width:982px}'));
 assert.ok(css.includes('.app-players-table[data-players-table-mode="attributes"] col.app-players-view-third-column{width:var(--app-players-positions-width)}'));
 assert.ok(css.includes('.app-players-table[data-players-table-mode="attributes"] th:nth-child(3){width:var(--app-players-positions-width)}'));
 assert.ok(css.includes(attrSelector4+'{width:calc(('+attrFixed+') / 4)}'));
 assert.ok(css.includes('html[data-players-group="technical"] .app-players-table[data-players-table-mode="attributes"]{min-width:1462px}'));
 assert.ok(css.includes('html[data-players-group="technical"] '+attrSelector4+'{width:calc(('+attrFixed+') / 8)}'));
 assert.doesNotMatch(css,/\.app-players-table\[data-players-table-mode="attributes"\] :is\(th,td\):nth-child\(n\+3\)\{width:120px/);
 for(const total of [782,1262,1440,1920]){
  const variable=total-54-248;
  assert.ok(variable>=480);
  const widths=overview.map(([, ,fraction])=>variable*fraction);
  assert.ok(Math.abs(widths.reduce((sum,width)=>sum+width,0)-variable)<1e-8);
  assert.ok(Math.abs(variable/4*4-variable)<1e-8);
  assert.ok(Math.abs(variable/8*8-variable)<1e-8);
 }
 assert.equal(54+248+200+4*120,982,'four-attribute minimum remains readable with Positions');
 assert.equal(54+248+200+8*120,1462,'technical minimum avoids compressed headings with Positions');
});


test('Players Attributes always show fixed-width Positions after the name without changing public skill keys',()=>{
 const html=read('players/index.html'),css=read('assets/app.css'),renderer=read('assets/players-directory.js'),generator=read('tools/generate-app-pages.mjs');
 assert.match(html,/class="app-players-view-third-column"/,'third slot must be reserved in static colgroup');
 assert.match(html,/addSort\(positions,'positions',\{en:'Positions',it:'Posizioni',de:'Positionen',es:'Posiciones',fr:'Postes'\}\[locale\]\|\|'Positions'\)/);
 assert.match(html,/row\.append\(positions\);\s*for\(const key of keys\)/,'Positions must precede stats on first paint');
 assert.match(html,/colSpan=keys\.length\+3/);
 assert.match(renderer,/const cols=\(\)=>state\.view==='attributes'\?3\+groups\[state\.group\]\.length:7/);
 assert.match(renderer,/addHeader\(t\.columns\[2\],'positions'\);\s*for\(const key of groups\[state\.group\]\)addHeader\(attributeName\(key\),key\)/);
 assert.match(renderer,/const positionsShown=\[player\.primary_position,\.\.\.\(Array\.isArray\(player\.secondary_positions\)\?player\.secondary_positions:\[\]\)\]\.filter\(Boolean\)/);
 assert.match(renderer,/else \{\s*cell\(tr,positionsShown\.join\(', '\)\|\|'—'\);\s*for\(const key of groups\[state\.group\]\)/);
 assert.match(css,/--app-players-positions-width:200px/);
 assert.ok(generator.includes('app-players-view-third-column')&&generator.includes('row.append(positions)'));
 for(const label of ['GK positioning','Posizionamento portiere','Torwartstellung','Posición de portero','Placement gardien']){
  assert.ok(!renderer.includes('|'+label+'|'),label+' must not remain as a visible skill label');
  assert.ok(!html.includes('|'+label+'|'),label+' must not remain in first paint');
 }
 for(const [locale,term] of [['en','Positioning'],['it','Posizionamento'],['de','Stellungsspiel'],['es','Colocación'],['fr','Placement']]){
  const attributeDefinitions=renderer.slice(renderer.indexOf(' const attrLabels={'),renderer.indexOf(' const labels={'));
  const labels=attributeDefinitions.match(new RegExp(''+locale+":'([^']+)'"))?.[1];
  assert.ok(labels&&labels.includes('|'+term+'|'),'GK positioning label in '+locale);
 }
 assert.match(renderer,/goalkeeping:\['gk_reflexes','gk_handling','gk_positioning','gk_aerial'\]/);
 assert.match(renderer,/data-players-filter/,'#512 filters are present');
});

test('Attributes widths remain proportional after 54px flag, 248px player and fixed 200px Positions',()=>{
 const css=read('assets/app.css');
 const remaining='100% - var(--app-players-flag-width) - var(--app-players-name-width) - var(--app-players-positions-width)';
 assert.ok(css.includes('.app-players-table[data-players-table-mode="attributes"] th:nth-child(n+4){width:calc(('+remaining+') / 4)}'));
 assert.ok(css.includes('html[data-players-group="technical"] .app-players-table[data-players-table-mode="attributes"] th:nth-child(n+4){width:calc(('+remaining+') / 8)}'));
 for(const group of [{name:'Technical',count:8,min:1462},{name:'Mental',count:4,min:982},{name:'Physical',count:4,min:982},{name:'Goalkeeper',count:4,min:982}]){
  assert.equal(group.min,54+248+200+group.count*120,group.name+' minimum widths');
  for(const total of [group.min,1800]){
   const available=total-54-248-200;
   assert.ok(available/group.count>=120);
   assert.equal(group.count*(available/group.count),available);
  }
 }
});


test('Positions is left-aligned in Overview and all Attributes groups; stats remain centered',()=>{
 const css=read('assets/app.css'),renderer=read('assets/players-directory.js');
 assert.match(css,/\.app-players-table:not\(\[data-players-table-mode="attributes"\]\) :is\(th,td\):nth-child\(4\)\{text-align:left\}/,'Overview header and body including static first paint');
 assert.match(css,/\.app-players-table\[data-players-table-mode="attributes"\] :is\(th,td\):nth-child\(n\+3\)\{text-align:center\}/);
 assert.match(css,/\.app-players-table\[data-players-table-mode="attributes"\] :is\(th,td\):nth-child\(3\)\{text-align:left\}/,'third column Positions overrides centered attribute defaults');
 assert.ok(css.indexOf(':is(th,td):nth-child(3){text-align:left}')>css.indexOf(':is(th,td):nth-child(n+3){text-align:center}'),'Positions override follows general numeric rule');
 assert.match(renderer,/addHeader\(t\.columns\[2\],'positions'\);\s*for\(const key of groups\[state\.group\]\)addHeader\(attributeName\(key\),key\)/);
 assert.match(renderer,/cell\(tr,positionsShown\.join\(', '\)\|\|'—'\)/);
 assert.match(css,/\.app-players-table th:nth-child\(2\)\{width:var\(--app-players-name-width\);text-align:left\}/);
 assert.match(css,/\.app-players-table th:nth-child\(4\)\{width:calc\(/,'column widths retained');
});


test('Overview Foot is left-aligned like Positions and Player, without changing numeric skill alignment',()=>{
 const css=read('assets/app.css'),renderer=read('assets/players-directory.js');
 assert.match(css,/\.app-players-table:not\(\[data-players-table-mode="attributes"\]\) :is\(th,td\):nth-child\(6\)\{text-align:left\}/,'Foot header and values in Overview, including first paint');
 assert.match(css,/\.app-players-table:not\(\[data-players-table-mode="attributes"\]\) :is\(th,td\):nth-child\(4\)\{text-align:left\}/,'Positions remains left-aligned in Overview');
 assert.match(css,/\.app-players-table\[data-players-table-mode="attributes"\] :is\(th,td\):nth-child\(n\+3\)\{text-align:center\}/,'Attribute statistics remain centered');
 assert.match(css,/\.app-players-table\[data-players-table-mode="attributes"\] :is\(th,td\):nth-child\(3\)\{text-align:left\}/,'Attributes Positions remains left');
 assert.match(css,/\.app-players-table th:nth-child\(6\)\{width:calc\(\(100% - var\(--app-players-flag-width\) - var\(--app-players-name-width\)\) \* 0\.20\)\}/,'Foot width unchanged');
 assert.match(renderer,/player\.preferred_foot==='left'\?t\.left:player\.preferred_foot==='right'\?t\.right:'—'/);
});


test('Players main tabs are compact and centered; existing top margins alone are zeroed',()=>{
 const css=read('assets/app.css'),html=read('players/index.html');
 assert.match(css,/\.app-players-tabs\{margin-top:var\(--app-page-section-gap\);min-height:40px\}/);
 assert.doesNotMatch(css,/\.app-players-tabs\{[^}]*padding-bottom:0/,'keep shared Standings tab-strip padding');
 assert.match(css,/\.app-players-tabs \.app-competition-tab\{[^}]*display:flex;align-items:center;justify-content:center;[^}]*width:136px;[^}]*height:40px;[^}]*text-align:center/);
 assert.match(css,/\.app-players-toolbar\{display:flex;align-items:center;[^}]*height:44px;[^}]*margin-top:0\}/,'zero only existing toolbar margin, preserve alignment');
 assert.match(css,/\.app-players-toolbar\+\.app-players-table-scroll\{margin-top:0\}/);
 assert.match(css,/\.app-players-tabs \.app-competition-tab\{flex:0 0 min\(136px,calc\(\(100% - 4px\)\/2\)\);[^}]*height:40px;min-height:40px/);
 assert.match(css,/\.app-players-toolbar\{height:44px;align-items:center/,'mobile toolbar still reserves one row across view switches');
 assert.match(css,/html:not\(\[data-players-view="attributes"\]\) \.app-players-groups\{visibility:hidden;pointer-events:none\}/);
 assert.ok(html.indexOf('class="app-players-toolbar"')<html.indexOf('class="app-players-table-scroll"'),'zero-gap toolbar stays directly before table');
 for(const view of ['overview','attributes'])assert.match(html,new RegExp('data-players-view="'+view+'"'),'tab remains in the static first paint');
});


test('Players collection uses a validated offset query, without changing the public response',()=>{
 const server=read('backend/src/index.ts'),client=read('assets/players-directory.js'),integration=read('backend/tests/players-generation-runtime.test.ts');
 assert.ok(server.includes("if(url.pathname==='/api/players')"));
 assert.ok(server.includes('parsePublicPlayerQuery(url.search)'));
 assert.ok(server.includes('readPublicPlayers(requireDatabase(env.DB),query.page,query.filters)'));
 assert.ok(!server.includes('playersPage=url.pathname.match'),'old page path should not be routed');
 assert.ok(client.includes("fetch('/api/players?'+query.toString()"));
 assert.ok(!client.includes("fetch('/api/players/page/'+page"));
 for(const path of ['?offset=0','?offset=50','?offset=100','?offset=1','?offset=01','?offset=-50','?offset=500000','?offset=50&offset=100','?page=1','?page=2','?page=2&offset=50','?view=overview']){
  assert.ok(integration.includes(path),'missing integration case '+path);
 }
 assert.ok(integration.includes('expect(legacy.status).toBe(404)'));
 assert.ok(integration.includes('count:51,page:2,pageSize:50,totalPages:2'));
});


test('PLAYERS-FILTERS-01 uses expandable sections, multi-select scopes and plain range boxes without changing the directory table',()=>{
 const html=read('players/index.html'),generator=read('tools/generate-app-pages.mjs'),css=read('assets/app.css'),code=read('assets/players-directory.js');
 for(const section of ['nationality','position','age','height','foot','attributes']){
  assert.ok(html.includes('data-players-filter-section="'+section+'"'),section);
  assert.ok(generator.includes('data-players-filter-section=\\\"'+section+'\\\"'),section+' canonical generator');
 }
 for(const key of ['name','nationality','nationalityScope','position','positionScope','ageMin','ageMax','heightMin','heightMax','foot'])
  assert.ok(html.includes('data-players-filter="'+key+'"'),key);
 assert.equal((html.match(/class="app-players-filter-section"/g)||[]).length,6);
 assert.doesNotMatch(html,/class="app-players-stepper"/,'Height and Age have only input boxes');
 assert.doesNotMatch(html,/data-players-step=/);
 assert.equal((html.match(/data-players-filter="(?:heightMin|heightMax)"/g)||[]).length,2);
 assert.equal((html.slice(html.indexOf('<form class="app-players-filter-form"'),html.indexOf('<footer class="app-players-filter-actions"')).match(/data-players-attribute-enable=/g)||[]).length,20);
 assert.doesNotMatch(html,/Select filters and press Apply to update the list/);
 assert.doesNotMatch(html,/data-players-filter-description/);
 assert.match(css,/\.app-players-filter-section-header\{display:flex/);
 assert.match(css,/\.app-players-age-range input\{appearance:textfield/);
 assert.match(css,/\.app-players-age-range input::-webkit-inner-spin-button/);
 assert.doesNotMatch(code,/stepButtons/);
 assert.match(code,/state\.filters=nextFilters;state\.page=1;\s*syncUrl\(\);syncControls\(\);closeFilterDialog\(\);load\(1\)/);
 assert.match(code,/filterSignature\(next\.filters\)!==filterSignature\(state\.filters\)/);
 assert.match(code,/const query=new URLSearchParams\(\{offset:String\(\(page-1\)\*50\)\}\)/);
 assert.match(code,/if\(state\.filters\?\.\[key\]\)query\.set\(key,state\.filters\[key\]\)/);
 assert.match(code,/renderCount\(lastCount\)/);
 for(const lng of ['en','it','de','es','fr'])assert.ok(code.includes(lng+':{name:'),lng);
 assert.match(css,/--app-players-flag-width:54px;--app-players-name-width:248px/);
});
test('Players first paint reads comma-separated multi values and scopes without changing table geometry',()=>{
 const html=read('players/index.html'),script=html.match(/<script data-players-first-paint>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 const keys=['name','nationality','nationalityScope','position','positionScope','ageMin','ageMax','heightMin','heightMax','foot'];
 const fields=keys.map(key=>({dataset:{playersFilter:key},value:'',type:key.endsWith('Scope')?'checkbox':'text',checked:false}));
 const row={cells:[{},{},{},{},{},{}],deleteCell(i){this.cells.splice(i,1)},append(node){this.cells.push(node)}};
 const pill={hidden:true,textContent:''},trigger={label:'',setAttribute(name,value){if(name==='aria-label')this.label=value}},title={textContent:''};
 const doc={
  documentElement:{lang:'en',dataset:{}},
  querySelectorAll(selector){
   if(selector==='.app-players-filters [data-players-filter]')return fields;
   if(selector==='[data-players-filter-active]')return [pill];
   if(selector==='[data-players-filter-open]')return [trigger];
   if(selector==='[data-players-filter-trigger-label]')return [title];
   return [];
  },
  querySelector(selector){if(selector==='.app-players-table')return {tHead:{rows:[row]},tBodies:[{rows:[{cells:[{colSpan:6}]}]}],dataset:{}};throw Error(selector)},
  createElement(){return {scope:'',textContent:''}}
 };
 runInNewContext(script,{document:doc,location:{search:'?nationality=ITA%2CENG&nationalityScope=any&position=RW%2CST&positionScope=any&ageMin=18&ageMax=29&heightMin=170&heightMax=195&foot=left'},URLSearchParams});
 const actual=Object.fromEntries(fields.map(f=>[f.dataset.playersFilter,f.type==='checkbox'?(f.checked?'any':''):f.value]));
 assert.deepEqual(actual,{name:'',nationality:'ITA,ENG',nationalityScope:'any',position:'RW,ST',positionScope:'any',ageMin:'18',ageMax:'29',heightMin:'170',heightMax:'195',foot:'left'});
 assert.equal(pill.textContent,'7','scope flags are never counted as additional filters');
 assert.equal(title.textContent,'Filters');
 assert.equal(trigger.label,'Filters: 7 active');
 assert.equal(row.cells.length,6,'overview geometry remains stable');
});
test('Players native top-layer drawer and portaled dropdowns preserve outside clicks and scrollbars',()=>{
 const html=read('players/index.html'),code=read('assets/players-directory.js'),css=read('assets/app.css');
 assert.match(html,/<button[^>]+data-players-filter-open[^>]+aria-haspopup="dialog"[^>]+aria-expanded="false"/);
 assert.match(html,/<dialog id="players-filter-dialog" class="app-players-filter-dialog" popover="manual" aria-modal="false"/);
 assert.match(html,/<form class="app-players-filter-form" data-players-filter-form novalidate>/);
 assert.match(html,/<button type="submit" class="app-players-apply" data-players-apply>/);
 assert.match(css,/\.app-players-filter-dialog:popover-open\{display:flex;flex-direction:column;animation:players-filter-slide-in/);
 assert.match(css,/\.app-players-filter-dialog::backdrop\{background:transparent;pointer-events:none\}/);
 assert.match(css,/\.fa-shell-content-scroll\{[^}]*overflow-y:auto;scrollbar-gutter:stable/);
 assert.match(code,/filterDialog\.showPopover\(\)/);
 assert.match(code,/if\(drawerOpen\(\)\)filterDialog\.hidePopover\(\)/);
 assert.doesNotMatch(code,/filterDialog\.showModal\(\)/);
 assert.doesNotMatch(code,/document\.documentElement\.style\.overflow/);
 assert.match(code,/filterDialog\.append\(menu\)/);
 assert.match(code,/if\(menu\.parentElement!==wrapper\)wrapper\.append\(menu\)/);
 assert.match(code,/document\.addEventListener\('pointerdown',event=>\{/);
 assert.match(code,/!filterDialog\.contains\(event\.target\)&&!filterTrigger\?\.contains\(event\.target\)/);
 assert.match(code,/closeFilterDialog\(false\)/);
 assert.match(code,/document\.querySelector\('\.fa-shell-topbar'\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('Players nationality and positions use searchable multi-select with secondary scopes and keyboard activation',()=>{
 const html=read('players/index.html'),css=read('assets/app.css'),code=read('assets/players-directory.js');
 const panel=html.slice(html.indexOf('<dialog id="players-filter-dialog"'),html.indexOf('<div class="app-players-table-scroll"'));
 for(const key of ['nationality','position']){
  assert.ok(panel.includes('class="app-players-filter-multi" data-players-filter="'+key+'"'),key);
  assert.ok(panel.includes('data-players-filter-search="'+key+'"'),key+' searchable');
  assert.ok(panel.includes('aria-multiselectable="true" aria-labelledby="players-filter-'+key+'-label"'),key);
  assert.ok(panel.includes('data-players-filter="'+key+'Scope" value="any"'),key+' secondary scope');
 }
 assert.ok(panel.includes('data-players-filter="foot" tabindex="-1" aria-hidden="true" hidden'));
 assert.equal((panel.match(/class="language-control app-players-filter-select"/g)||[]).length,3);
 assert.equal((panel.match(/data-players-filter-option="(ALG|ENG|ITA|ST|LW|RW)"/g)||[]).length,6);
 assert.match(css,/\.app-players-filter-menu \.language-option\[hidden\]\{display:none\}/);
 assert.match(code,/function chooseDropdown\(wrapper,index\)/);
 assert.match(code,/const codes=new Set\(field\.value\.split\(','\)\.filter\(Boolean\)\)/);
 assert.match(code,/else if\(codes\.has\(chosen\)\)codes\.delete\(chosen\)/);
 assert.match(code,/field\.value=\[\.\.\.codes\]\.sort\(\)\.join\(','\)/);
 assert.match(code,/const search=menu\.querySelector\('\[data-players-filter-search\]'\)/);
 assert.match(code,/normalize\('NFD'\)/);
 assert.match(code,/if\(k==='Escape'&&!menu\.hidden\)/);
 assert.match(code,/const visible=options\.filter\(option=>!option\.hidden\)/);
 assert.doesNotMatch(code,/field\.addEventListener\('change',applyFilters\)/);
});
test('Players parser validates safe multiple nationality/position values, secondary scopes and height ranges',async()=>{
 const {parsePublicPlayerQuery,isAllowedPublicPlayersPath}=await import('../backend/src/public-players-filters.mjs');
 const query=parsePublicPlayerQuery('?nationality=ITA%2CENG&nationalityScope=any&position=ST%2CRW&positionScope=any&heightMin=165&heightMax=195&ageMin=18&foot=left&offset=100');
 assert.deepEqual(query,{page:3,filters:{nationality:['ITA','ENG'],nationalityScope:'any',position:['ST','RW'],positionScope:'any',ageMin:18,heightMin:165,heightMax:195,foot:'left'}});
 assert.ok(isAllowedPublicPlayersPath('/api/players?nationality=ITA%2CENG&nationalityScope=any'));
 for(const invalid of ['?nationalityScope=any','?positionScope=any','?nationality=ITA%2CITA','?nationality=ITA%2CXYZ','?position=ST%2CST','?position=ST%2CXX','?heightMin=90','?heightMax=251','?ageMin=30&ageMax=20','?heightMin=220&heightMax=190','?nationality=%49TA','?position=ST%2cRW','?nationality=ITA&nationality=ENG','?foot=up']){
  assert.throws(()=>parsePublicPlayerQuery(invalid),{name:'TypeError'},invalid);
  assert.equal(isAllowedPublicPlayersPath('/api/players'+invalid),false,invalid);
 }
 assert.deepEqual(parsePublicPlayerQuery('?nationality=ITA,ENG&position=ST,RW').filters,{nationality:['ITA','ENG'],position:['ST','RW']});
});
test('Players SQL count/page share identical secondary and multiple filters without weakening projection',()=>{
 const sql=read('backend/src/public-players-read.ts'),types=read('backend/src/public-players-filters.d.mts'),integration=read('backend/tests/players-generation-runtime.test.ts');
 assert.match(sql,/json_extract\(payload_json,'\$\.secondary_nationality'\) IN/);
 assert.match(sql,/EXISTS \(SELECT 1 FROM json_each\(payload_json,'\$\.secondary_positions'\)/);
 // Player identities survive world reset: no filters means no WHERE clause.
 assert.match(sql,/const where=predicates\.length\?' WHERE '\+predicates\.join\(' AND '\):''/);
 assert.match(sql,/SELECT COUNT\(\*\) AS n FROM generated_players'\+where/);
 assert.match(sql,/SELECT p\.id,p\.payload_json,a\.club_key FROM generated_players p LEFT JOIN player_club_affiliations a ON a\.player_id=p\.id'\+where/);
 assert.doesNotMatch(sql,/WHERE world_generation=\?/);
 assert.match(sql,/:\'id DESC\'/,'default public sorting follows descending numeric IDs');
 assert.doesNotMatch(sql,/:\'created_at DESC,id ASC\'/);
 assert.match(sql,/ORDER BY '\+orderBy\+' LIMIT \? OFFSET \?'/);
 assert.match(sql,/json_extract\(payload_json,'\$\.height_cm'\)>=\?/);
 assert.match(types,/nationality\?:string\[\]/);
 assert.match(types,/positionScope\?:'any'/);
 assert.match(integration,/public Players filters support multiselect and opt-in secondary matches across full generations/);
});


test('Players name search is first, nationality and position have no Select multiple copy, All is centered',()=>{
 const html=read('players/index.html'),css=read('assets/app.css'),code=read('assets/players-directory.js');
 const form=html.slice(html.indexOf('data-players-filter-form novalidate'),html.indexOf('<footer class="app-players-filter-actions"'));
 assert.ok(form.indexOf('data-players-filter="name"')<form.indexOf('data-players-filter-section="nationality"'));
 assert.doesNotMatch(form,/Select multiple/);
 assert.doesNotMatch(form,/Select nationalities/);
 assert.match(form,/data-players-filter="name" maxlength="80"/);
 assert.match(css,/\.app-players-filter-dropdown-trigger>\[data-players-filter-value\]\{[^}]*text-align:center/);
 assert.match(css,/\.app-players-filter-menu \.language-option\[data-players-filter-option=""\]\{justify-content:center;text-align:center\}/);
 assert.match(code,/const selectedCount=totalFilterCount\(state\.filters\)/);
 assert.match(code,/key!=='attributes'&&!key\.endsWith\('Scope'\)/);
 assert.match(code,/const name=String\(fields\.name\|\|''\)\.normalize\('NFC'\)\.trim\(\)/);
});
test('Players attributes use four compact groups; twenty opt-in bounds are hidden until activated',()=>{
 const html=read('players/index.html'),css=read('assets/app.css'),code=read('assets/players-directory.js');
 const form=html.slice(html.indexOf('<form class="app-players-filter-form"'),html.indexOf('<footer class="app-players-filter-actions"'));
 for(const cat of ['technical','mental','physical','goalkeeping'])
  assert.ok(form.includes('data-players-attribute-category="'+cat+'"'),cat);
 for(const field of ['passing','technique','dribbling','shooting','crossing','tackling','marking','heading',
  'vision','positioning','decisions','composure','speed','strength','stamina','agility','gk_reflexes','gk_handling','gk_positioning','gk_aerial']){
  assert.ok(form.includes('data-players-attribute-enable="'+field+'"'),field);
  assert.ok(form.includes('data-players-attribute-min="'+field+'"'),field);
  assert.ok(form.includes('data-players-attribute-max="'+field+'"'),field);
 }
 assert.equal((form.match(/data-players-attribute-enable=/g)||[]).length,20);
 assert.match(css,/\.app-players-attribute-count\[hidden\],\.app-players-attribute-bounds\[hidden\]\{display:none!important\}/);
 assert.match(code,/function restoreAttributes\(\)/);
 assert.match(code,/function draftAttributes\(\)/);
 assert.match(code,/check\.checked=false;range\.hidden=true;min\.value='';max\.value=''/,'empty attributes must be deactivated on Apply');
 assert.doesNotMatch(code,/reportValidity\(\)/,'Apply never displays browser validation errors');
 assert.match(code,/fields\.attributes=attrs\.sort\(\)\.join\(','\)/);
 assert.match(code,/const nextFilters=Object\.fromEntries\(filterKeys\.map\(key=>\[key,fields\[key\]\|\|''\]\)\)/);
 assert.doesNotMatch(code,/field\.addEventListener\('change',applyFilters\)/);
});
test('Players first paint initializes name, attributes and the applied-count while the drawer remains closed',()=>{
 const html=read('players/index.html'),script=html.match(/<script data-players-first-paint>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.match(script,/name:\(params\.get\('name'\)\|\|''\)\.slice\(0,80\)/);
 assert.match(script,/attributes:safeAttr\(params\.get\('attributes'\)\)/);
 assert.match(script,/document\.querySelector\('\[data-players-attribute-enable="'/);
 assert.match(script,/if\(range\)range\.hidden=false/);
 assert.match(script,/key!=='attributes'&&!key\.endsWith\('Scope'\)/);
 assert.match(script,/filters\.attributes\.split\(','\)\.filter\(Boolean\)\.length/);
});


test('Players filter drawer permanently reserves its own scrollbar gutter without shifting the site shell',()=>{
 const css=read('assets/app.css'),js=read('assets/players-directory.js');
 assert.match(css,/\.app-players-filters\{[^}]*overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;scrollbar-width:thin/);
 assert.match(css,/\.app-players-filter-dialog\{[^}]*overflow:hidden/,'the scrollable region owns the scrollbar, not the top-layer dialog');
 assert.doesNotMatch(css,/html:has\(\.app-players-filter-dialog/,'opening the drawer must not alter root scrollbar gutter');
 assert.doesNotMatch(js,/document\.documentElement\.style\.overflow/,'the background scroll state stays untouched');
});


test('Players Apply ignores blank ranges, unchecks empty attributes, and never reports errors',()=>{
 const js=read('assets/players-directory.js');
 const from=js.indexOf('  function applyFilters(){'),to=js.indexOf('  // Draft values remain',from);
 assert.ok(from>0&&to>from,'Apply function exists');
 const source=js.slice(from,to);
 assert.doesNotMatch(source,/reportValidity|setCustomValidity|throw new Error/,'no browser validation messages');
 const keys=['name','nationality','nationalityScope','position','positionScope','ageMin','ageMax','heightMin','heightMax','foot','attributes'];
 const fields=keys.filter(k=>k!=='attributes').map(key=>({dataset:{playersFilter:key},value:'',type:key.endsWith('Scope')?'checkbox':'number',checked:false}));
 const get=key=>fields.find(f=>f.dataset.playersFilter===key);
 let loads=0,closes=0,urlSync=0;
 const check={checked:true},range={hidden:false},min={value:''},max={value:''};
 const attrs=new Map([['passing',{check,range,min,max}]]);
 const signature=filters=>keys.map(k=>filters[k]||'').join('|');
 const state={page:1,filters:Object.fromEntries(keys.map(k=>[k,'']))};
 const apply=new Function('filterFields','attributeMap','state','filterKeys','filterSignature',
  'validName','syncFilterControls','syncUrl','syncControls','closeFilterDialog','load',
  source+';return applyFilters;')(fields,attrs,state,keys,signature,
  value=>value.length<=80,()=>{},()=>{urlSync++},()=>{},()=>{closes++},()=>{loads++});
 apply();
 assert.equal(check.checked,false,'empty selected attribute unchecked');
 assert.equal(range.hidden,true,'empty attribute bounds collapse');
 assert.equal(state.filters.attributes,'','no attribute query when empty');
 assert.equal(loads,0,'no duplicate fetch when unchanged');
 assert.equal(closes,1);
 check.checked=true;range.hidden=false;min.value='70';max.value='';
 apply();
 assert.equal(state.filters.attributes,'passing_70_x','one-sided range works');
 assert.equal(loads,1);assert.equal(urlSync,1);
 check.checked=true;range.hidden=false;min.value='';max.value='';
 get('heightMin').value='';get('heightMax').value='';
 apply();
 assert.equal(state.filters.attributes,'','clears previously active attribute');
 assert.equal(loads,2,'exactly one refresh on removal');
 assert.equal(check.checked,false);
 get('ageMin').value='30';get('ageMax').value='20';
 apply();
 assert.equal(state.filters.ageMin,'');assert.equal(state.filters.ageMax,'');
 assert.equal(loads,2,'inverted range ignored without a request');
 get('heightMin').value='170';get('heightMax').value='';
 apply();
 assert.equal(state.filters.heightMin,'170');
 assert.equal(state.filters.heightMax,'');
 assert.equal(loads,3,'one-sided height works');
});


test('Players reserve five completely empty, full-height rows while loading',()=>{
 const html=read('players/index.html'),css=read('assets/app.css'),js=read('assets/players-directory.js');
 const table=html.slice(html.indexOf('<table class="app-players-table"'),html.indexOf('</table>',html.indexOf('<table class="app-players-table"')));
 assert.equal((table.match(/class="app-players-loading-row"/g)||[]).length,5);
 assert.equal((table.match(/colspan="7"/g)||[]).length,5);
 assert.doesNotMatch(table,/app-players-skeleton-bar|app-players-skeleton-line/);
 assert.match(table,/class="sr-only" data-players-status role="status"/);
 assert.match(css,/\.app-players-table tbody tr:not\(\.app-players-empty-row\)\{height:36px\}/);
 assert.match(css,/\.app-players-table \.app-players-loading-row td\{height:36px;padding:0 16px\}/);
 assert.doesNotMatch(css,/\.app-players-skeleton-line|\.app-players-skeleton-row/);
 assert.match(js,/function showLoadingRows\(\)/);
 assert.match(js,/for\(let n=0;n<5;n\+\+\)/);
 assert.match(js,/td\.colSpan=columns/);
 assert.match(js,/scroll\.setAttribute\('aria-busy','true'\);renderHead\(\);showLoadingRows\(\)/);
 assert.match(js,/if\(status==='loading'\)showLoadingRows\(\);else message/);
 const fp=html.match(/<script data-players-first-paint>([\s\S]*?)<\/script>/)?.[1];
 assert.match(fp,/for\(const loadingRow of rows\)loadingRow\.cells\[0\]\.colSpan=keys\.length\+3/);
 assert.match(html,/app-players-count-placeholder/);
 assert.match(css,/\.app-players-count-placeholder\{[^}]*background:transparent/);
 assert.doesNotMatch(html,/app-players-count-skeleton/);
});
test('Players column buttons provide persistent URL ordering on complete server-side datasets',async()=>{
 const html=read('players/index.html'),js=read('assets/players-directory.js'),css=read('assets/app.css'),sql=read('backend/src/public-players-read.ts');
 const parser=await import('../backend/src/public-players-filters.mjs');
 for(const key of ['nationality','name','age','positions','height','foot']){
  assert.match(html,new RegExp('data-players-sort="'+key+'"'));
  assert.deepEqual(parser.parsePublicPlayerQuery('?sort='+key+'&order=asc').filters,{sort:key,order:'asc'});
 }
 for(const key of ['passing','vision','speed','gk_reflexes']){
  assert.deepEqual(parser.parsePublicPlayerQuery('?sort='+key+'&order=desc').filters,{sort:key,order:'desc'});
 }
 for(const bad of ['?order=asc','?sort=unknown','?sort=name&order=up','?sort=name&sort=age']){
  assert.throws(()=>parser.parsePublicPlayerQuery(bad),{name:'TypeError'},bad);
 }
 assert.match(css,/\.app-players-sort-button\{display:flex;[^}]*cursor:pointer/);
 assert.match(css,/\.app-players-sort-button:focus-visible\{text-decoration:underline/);
 assert.match(css,/\.app-players-sort-button:hover,\.app-players-sort-button:active,\.app-players-sort-button:focus\{color:inherit;background:transparent/);
 assert.match(css,/user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent/);
 assert.doesNotMatch(css,/\.app-players-sort-button:hover\{color:var\(--focus\)/,'hover does not highlight sortable labels');
 assert.match(css,/\.app-players-sort-button:hover,\.app-players-sort-button:active,\.app-players-sort-button:focus\{color:inherit;background:transparent;box-shadow:none;outline:none/,'mouse interaction cannot paint a selection box');
 assert.match(js,/table\.tHead\.addEventListener\('click',event=>/);
 assert.match(js,/function cycleSort\(key\)/);
 assert.match(js,/if\(state\.sort!==key\)\{state\.sort=key;state\.order='desc';\}/);
 assert.match(js,/else if\(state\.order==='desc'\)state\.order='asc'/);
 assert.match(js,/else\{state\.sort='';state\.order='';\}/);
 assert.match(css,/\.app-players-sort-chevron\{[^}]*visibility:hidden;opacity:0;transform:translateY\(-50%\) rotate\(0deg\);transform-origin:50% 50%/);
 assert.match(css,/\.app-players-table th\[aria-sort="ascending"\] \.app-players-sort-chevron\{transform:translateY\(-50%\) rotate\(180deg\)\}/);
 assert.match(html,/class="app-players-sort-chevron"/);
 assert.match(js,/classList\.add\('app-players-sort-chevron'\)/);
 assert.match(js,/state\.page=1;syncUrl\(\);load\(1\)/);
 assert.match(js,/if\(state\.sort\)\{query\.set\('sort',state\.sort\);query\.set\('order',state\.order\);\}/);
 assert.match(js,/next\.sort!==state\.sort\|\|next\.order!==state\.order/);
 assert.match(sql,/const sortSql=new Map<string,string>/);
 assert.match(sql,/const orderBy=sortExpression/);
 assert.match(sql,/id ASC'/,'deterministic secondary sorting');
 assert.match(sql,/ORDER BY '\+orderBy\+' LIMIT \? OFFSET \?/);
 assert.doesNotMatch(sql,/ORDER BY \?\s+LIMIT/);
 const firstPaint=html.match(/<script data-players-first-paint>([\s\S]*?)<\/script>/)?.[1];
 assert.match(firstPaint,/th\.setAttribute\('aria-sort',active\?/);
});
test('PLAYERS-SCROLL-01 defaults to id DESC and sorting refresh retains five loading rows',async()=>{
 const sql=read('backend/src/public-players-read.ts'),js=read('assets/players-directory.js');
 const {parsePublicPlayerQuery}=await import('../backend/src/public-players-filters.mjs');
 assert.deepEqual(parsePublicPlayerQuery('').filters,{},'default API query sends no explicit sort');
 assert.deepEqual(parsePublicPlayerQuery('?offset=50').filters,{},'offset deep links share the default ordering');
 assert.match(sql,/:\'id DESC\'/,'newest numeric player ID is first when no sort selected');
 assert.match(sql,/sortExpression\+' COLLATE NOCASE '\+\(filters\.order==='desc'\?'DESC':'ASC'\)\+', id ASC'/,'explicit sorts preserve stable tie-breaking');
 const load=js.slice(js.indexOf('  async function load(page){'),js.indexOf('  function changeView(view){'));
 assert.match(load,/current=null;status='loading'/,'old rows are cleared before a sort refresh');
 assert.match(load,/renderHead\(\);showLoadingRows\(\)/,'sort-triggered load renders placeholders first');
 assert.match(js,/for\(let n=0;n<5;n\+\+\)/,'refresh reserves exactly five loading rows');
 assert.match(js,/state\.page=1;syncUrl\(\);load\(1\)/,'sort resets to the first complete server page');
});

test('PLAYERS-SCROLL-01 sort clears 150 loaded rows to exactly five loading rows without retained height',()=>{
 const js=read('assets/players-directory.js'),css=read('assets/app.css');
 const load=js.slice(js.indexOf('  async function load(page){'),js.indexOf('  async function appendNext(){'));
 assert.doesNotMatch(load,/scroll\.style\.minHeight\s*=/,'sorting must never preserve the previous 50/150+ row viewport height');
 assert.doesNotMatch(js,/scroll\.style\.minHeight\s*=/,'no stale inline height locks across load paths');
 assert.match(load,/current=null;status='loading'/,'old result state is invalidated before fetching the sort');
 assert.match(load,/renderHead\(\);showLoadingRows\(\)/,'placeholder rows render before the API resolves');
 const show=js.slice(js.indexOf('  function showLoadingRows(){'),js.indexOf('  function message(value){'));
 assert.ok(show.startsWith('  function showLoadingRows(){'),'use the production function, not a reimplementation');
 const element=()=>({children:[],dataset:{},append(node){this.children.push(node)},setAttribute(){}});
 const document={
  createDocumentFragment(){return element()},
  createElement(){return element()}
 };
 const oldRows=Array.from({length:150},()=>element());
 const body={rows:oldRows,replaceChildren(fragment){this.rows=fragment.children}};
 const pager={hidden:false},scroll={attributes:{},setAttribute(k,v){this.attributes[k]=v}};
 const showLoading=new Function('document','body','pager','scroll','cols','locale',
  show+';return showLoadingRows;')(document,body,pager,scroll,()=>7,()=>({loading:'Loading players…'}));
 showLoading();
 assert.equal(body.rows.length,5,'only five rows remain after a sort refresh');
 assert.ok(body.rows.every(row=>row.className==='app-players-loading-row'&&row.children.length===1&&row.children[0].colSpan===7));
 assert.ok(body.rows.every(row=>!oldRows.includes(row)),'all prior loaded rows have been detached');
 assert.equal(pager.hidden,true);
 assert.equal(scroll.attributes['aria-busy'],'true');
 assert.match(css,/\.app-players-table tbody tr:not\(\.app-players-empty-row\)\{height:36px\}/);
 assert.match(css,/\.app-players-table \.app-players-loading-row td\{height:36px;padding:0 16px\}/);
 assert.match(js,/state\.page=1;syncUrl\(\);load\(1\)/,'sorting always starts a fresh first page');
});

test('PLAYERS-SCROLL-01 progressive loading preserves 50-row API and URL pagination contracts',()=>{
 const js=read('assets/players-directory.js'),css=read('assets/app.css');
 assert.match(js,/const loadMore=document.createElement\('button'\)/);
 assert.match(js,/const appendStatus=document.createElement\('span'\)/);
 assert.match(js,/appendStatus\.className='sr-only'/);
 assert.match(js,/appendStatus\.setAttribute\('role','status'\)/);
 assert.match(js,/appendStatus\.setAttribute\('aria-live','polite'\)/);
 assert.match(js,/sentinel\.after\(appendStatus\)/,'status remains mounted even after pager hides');
 assert.match(js,/loadMore\.dataset\.playersLoadMore=''/);
 assert.match(js,/async function fetchBatch\(page\)/);
 assert.match(js,/pageSize!==50/);
 assert.match(js,/const query=new URLSearchParams\(\{offset:String\(\(page-1\)\*50\)\}\)/);
 assert.match(js,/const validOffset=rawOffset!==null/);
 assert.doesNotMatch(js,/legacyPage|validLegacy/,'page URLs are not interpreted');
 assert.match(js,/data\.count>0&&page>data\.totalPages&&data\.players\.length===0/,'expired numeric pages recover to page one');
 assert.match(js,/async function appendNext\(\)/);
 assert.match(js,/body\.append\(playerRows\(data\.players\)\)/);
 assert.match(js,/history\.replaceState\(\{\.\.\.base,faPlayersReturn:/,'store only position metadata for browser Back');
 assert.match(js,/navigationType==='back_forward'/,'restore only on cold history traversal');
 assert.match(js,/body\.querySelector\('a\.app-player-name-link/,'return focus to the player link');
 assert.match(js,/if\(!current\|\|appendPending\|\|appendError\|\|loadedThrough>=current\.totalPages\)return/);
 assert.match(js,/if\(seq!==ticket\)return/,'ignore stale append responses');
 assert.match(js,/data\.players\.some\(player=>seen\.has\(player\.id\)\)/,'detect shifted OFFSET duplicates');
 assert.match(js,/new IntersectionObserver\(entries=>/,'auto-load at scroll end');
 assert.match(js,/root:scrollPane\|\|null,rootMargin:'0px 0px 120px 0px'/,'observe correct shell');
 assert.match(js,/addEventListener\('scroll',/,'passive fallback');
 assert.match(js,/new URLSearchParams\(\{offset:String\(\(page-1\)\*50\)\}\)/);
 assert.doesNotMatch(js,/\/api\/players\/cursor/,'no breaking cursor API');
 assert.match(js,/if\(state\.page>1\)url\.searchParams\.set\('offset',String\(\(state\.page-1\)\*50\)\)/);
 assert.doesNotMatch(js,/query\.set\('page'/,'offset-only client API');
 assert.doesNotMatch(js,/const loaded=t\.loaded/,'no Loaded X of Y counter');
 assert.doesNotMatch(js,/counter\.textContent|progress\.textContent|t\.end/,'no extra counters or end-of-results messages');
 assert.match(js,/pager\.hidden=current\.players\.length===0\|\|loadedThrough>=current\.totalPages/,'hide footer at end');
 assert.match(js,/if\(appendPending\)\{\s*loadMore\.hidden=false;loadMore\.disabled=true;loadMore\.textContent=t\.loadingMore;return;/,'show disabled Loading... during auto-loading');
 assert.match(css,/\.app-players-end-sentinel\{/);
 assert.match(css,/\.app-players-pagination\[data-players-progress\]\{min-height:48px/);
 for(const lang of ['en','it','de','es','fr']){
  const labels=js.match(new RegExp(lang+":\\{one:[^\\n]+"))?.[0]||'';
  assert.match(labels,/loadMore:/);assert.match(labels,/retry:/);
  for(const key of ['loadingMore','moreLoaded','allLoaded'])assert.match(labels,new RegExp(key+':'),'screen reader append announcements localized');
  assert.match(labels,/loadingMore:/);
  assert.doesNotMatch(labels,/,end:/);
 }
});
test('PLAYERS-SCROLL-01 Load more shows a disabled loading state only during append',()=>{
 const js=read('assets/players-directory.js');
 const source=js.slice(js.indexOf('  function renderProgress(){'),js.indexOf('  function paint(data){'));
 assert.ok(source.includes('function renderProgress(){'));
 const run=({pending=false,error='',through=1,total=2,players=50,status='ready'}={})=>{
  const pager={hidden:false},loadMore={hidden:false,disabled:false,textContent:''};
  const render=new Function('locale','pager','loadMore','current','status','loadedThrough','appendPending','appendError',
   source+';return renderProgress;')(
    ()=>({loadMore:'Load more',loadingMore:'Loading...',retry:'Retry',restart:'Start over'}),
    pager,loadMore,players===null?null:{players:Array.from({length:players},()=>({})),totalPages:total},
    status,through,pending,error
   );
  render();
  return {hidden:pager.hidden,buttonHidden:loadMore.hidden,disabled:loadMore.disabled,label:loadMore.textContent};
 };
 assert.deepEqual(run(),{hidden:false,buttonHidden:false,disabled:false,label:'Load more'});
 assert.deepEqual(run({pending:true}),{hidden:false,buttonHidden:false,disabled:true,label:'Loading...'});
 assert.deepEqual(run({error:'network'}),{hidden:false,buttonHidden:false,disabled:false,label:'Retry'});
 assert.deepEqual(run({error:'stale'}),{hidden:false,buttonHidden:false,disabled:false,label:'Start over'});
 assert.equal(run({through:2}).hidden,true,'no append button after final batch');
 assert.equal(run({players:0}).hidden,true,'no append button for empty results');
});
test('PLAYERS-SCROLL-01 offset query rejects obsolete page URLs',async()=>{
 const {parsePublicPlayerQuery,isAllowedPublicPlayersPath}=await import('../backend/src/public-players-filters.mjs');
 for(const [query,page] of [['?offset=0',1],['?offset=50',2],['?offset=100',3],['?offset=499900',9999],['?offset=50&sort=age&order=desc',2]]){
  assert.equal(parsePublicPlayerQuery(query).page,page);
  assert.equal(isAllowedPublicPlayersPath('/api/players'+query),true);
 }
 assert.deepEqual(parsePublicPlayerQuery('?offset=50&nationality=ITA'),{page:2,filters:{nationality:['ITA']}});
 assert.equal(parsePublicPlayerQuery('').page,1,'unspecified offset defaults to zero');
 for(const query of ['?offset=','?offset=01','?offset=000','?offset=-50','?offset=1','?offset=51','?offset=499950',
  '?offset=500000','?offset=50&offset=50','?offset=50&page=2','?page=2&offset=50','?page=1','?page=2','?page=9999','?offset=x']){
  assert.throws(()=>parsePublicPlayerQuery(query),{name:'TypeError'},query);
  assert.equal(isAllowedPublicPlayersPath('/api/players'+query),false,query);
 }
});

test('PLAYERS-SCROLL-01 near-end detection loads only when visible and idle',()=>{
 const js=read('assets/players-directory.js');
 const begin=js.indexOf('  function maybeLoadOnScroll(){'),end=js.indexOf("  if(typeof IntersectionObserver==='function')",begin);
 assert.ok(begin>=0&&end>begin);
 let calls=0;
 const rect={top:700,bottom:701};
 const pane={getBoundingClientRect:()=>({bottom:600})};
 const sentinel={getBoundingClientRect:()=>rect};
 const pager={hidden:false};
 const current={totalPages:3};
 const fire=new Function('current','status','appendPending','appendError','loadedThrough','pager','scrollPane','sentinel','window','appendNext',
  js.slice(begin,end)+';return maybeLoadOnScroll;');
 const mk=(opts={})=>fire(current,opts.status||'ready',!!opts.pending,opts.error||'',opts.through??1,pager,pane,sentinel,
   {innerHeight:600},()=>{calls++});
 mk()();assert.equal(calls,1,'inside prefetch margin');
 rect.top=800;mk()();assert.equal(calls,1,'not close enough');
 rect.top=700;
 mk({pending:true})();mk({error:'network'})();mk({through:3})();mk({status:'loading'})();
 assert.equal(calls,1,'no parallel, failed, completed or loading requests');
});

test('PLAYERS-SCROLL-01 append behavior: EOF, concurrent requests, retry, invalidation and deep links',async()=>{
 const js=read('assets/players-directory.js');
 const begin=js.indexOf('  async function appendNext(){'),end=js.indexOf('  function changeView(view){',begin);
 assert.ok(begin>=0&&end>begin);
 const source=js.slice(begin,end);
 const build=(initial,next)=>new Function('initial','next',`
  let current={...initial,players:[...initial.players]},loadedThrough=initial.page,ticket=0,appendPending=false,appendError='';
  let requests=0,appended=[],progressUpdates=0,focusTransfers=0,announcements=[];
  const loadMore={};
  const document={activeElement:null};
  const scroll={focus(){focusTransfers++}};
  const locale=()=>({appendLoading:'Loading more players…',moreLoaded:'New players: {count}. Shown: {loaded} of {total}.',allLoaded:'All players loaded',changed:'Player list changed. Start over.',loadError:'Could not load more players'});
  const language=()=> 'en';
  const announceAppend=value=>announcements.push(value);
  const fetchBatch=async page=>{requests++;return next(page)};
  const body={append(rows){appended.push(...rows)}};\n   const hydrateClubCrests=()=>{};
  const playerRows=players=>players.map(player=>player.id);
  const renderProgress=()=>{progressUpdates++};
  ${source}
  return {appendNext,retry:()=>{appendError=''},focusLoadMore:()=>{document.activeElement=loadMore},snapshot:()=>({ids:current.players.map(p=>p.id),loadedThrough,appendPending,appendError,requests,appended,progressUpdates,focusTransfers,announcements}),invalidate:()=>{ticket++}};
 `)(initial,next);
 const first=Array.from({length:50},(_,i)=>({id:100-i}));
 const second=Array.from({length:1},(_,i)=>({id:50-i}));
 const base={page:1,count:51,pageSize:50,totalPages:2,players:first};
 const make=(page,players,count=51)=>({page,count,pageSize:50,totalPages:2,players});
 const success=build(base,async page=>make(page,second));
 await success.appendNext();
 assert.equal(success.snapshot().ids.length,51);
 assert.deepEqual(success.snapshot().appended,[50]);
 assert.equal(success.snapshot().loadedThrough,2);
 assert.equal(success.snapshot().announcements.at(-1),'New players: 1. Shown: 51 of 51. All players loaded');
 await success.appendNext();assert.equal(success.snapshot().requests,1,'no next request after EOF');
 let resolve;
 const deferred=new Promise(done=>{resolve=done});
 const concurrent=build(base,()=>deferred);
 const firstCall=concurrent.appendNext();const secondCall=concurrent.appendNext();
 assert.equal(concurrent.snapshot().requests,1,'only one in-flight append');
 resolve(make(2,second));await Promise.all([firstCall,secondCall]);
 assert.equal(concurrent.snapshot().ids.length,51);
 const duplicate=build(base,async page=>make(page,[{id:100}]));
 await duplicate.appendNext();
 assert.equal(duplicate.snapshot().appendError,'stale','duplicate must request a restart');
 assert.equal(duplicate.snapshot().announcements.at(-1),'Player list changed. Start over.');
 assert.deepEqual(duplicate.snapshot().ids,first.map(p=>p.id));
 const changed=build(base,async page=>make(page,second,52));
 await changed.appendNext();assert.equal(changed.snapshot().appendError,'stale');
 let fail=true;
 const retry=build(base,async page=>{if(fail){fail=false;throw Error('network')}return make(page,second)});
 await retry.appendNext();assert.equal(retry.snapshot().appendError,'network');
 assert.equal(retry.snapshot().announcements.at(-1),'Could not load more players');
 await retry.appendNext();assert.equal(retry.snapshot().requests,1,'automatic scroll does not retry silently');
 retry.retry(); // The explicit Retry control clears the error before another request.
 await retry.appendNext();assert.equal(retry.snapshot().appendError,'');
 assert.equal(retry.snapshot().ids.length,51);
 let release;
 const pending=new Promise(done=>{release=done});
 const obsolete=build(base,()=>pending);
 const task=obsolete.appendNext();obsolete.invalidate();release(make(2,second));await task;
 assert.equal(obsolete.snapshot().ids.length,50,'superseded append does not commit');
 const deep=build({page:3,count:151,pageSize:50,totalPages:4,players:first},async page=>({...make(page,second),count:151,totalPages:4}));
 await deep.appendNext();assert.equal(deep.snapshot().loadedThrough,4,'direct page 3 loads only segment 4 next');
 const keyboard=build(base,async page=>make(page,second));
 keyboard.focusLoadMore();await keyboard.appendNext();
 assert.equal(keyboard.snapshot().focusTransfers,1,'hidden manual fallback must hand off keyboard focus');
});
test('PLAYERS-TABLE-532 scales headers and text to fit 24px club crests',()=>{
 const css=read('assets/app.css');
 assert.match(css,/\.app-players-table thead th\{height:42px;padding-block:2px;[^}]*font-size:12px;font-weight:700/);
 assert.match(css,/\.app-players-sort-button\{[^}]*height:36px;min-height:36px/);
 assert.match(css,/\.app-players-table\{[^}]*font-size:14px/,'data labels scale to 14px with the larger rows');
 assert.match(css,/\.app-players-table tbody tr:not\(\.app-players-empty-row\)\{height:36px\}/,'36px body rows fit 24px crests');
 assert.match(css,/\.app-players-table \.app-players-loading-row td\{height:36px/,'first-paint and refresh rows retain matching height');
 assert.doesNotMatch(css,/\.app-players-table thead th\{height:44px/);
 assert.doesNotMatch(read('assets/club-page.css'),/\.club-roster-table thead th\{[^}]*height:/,'Roster inherits the shared header styles');
});

test('PLAYERS-TABLE-532 uses compact consistent rows and centered smaller flags in public, Roster and Admin preview',()=>{
 const css=read('assets/app.css');
 const directory=read('assets/players-directory.js');
 const club=read('assets/club-model.js');
 const preview=read('assets/admin-players-preview.js');
 assert.match(css,/\.app-players-table th,\.app-players-table td\{[^}]*padding:2px 16px;/,'shared compact vertical padding');
 assert.match(css,/\.app-players-table tbody tr:not\(\.app-players-empty-row\)\{height:36px\}/);
 assert.match(css,/\.app-players-table \.app-players-loading-row td\{height:36px;padding:0 16px\}/);
 assert.match(css,/\.app-players-table tbody td:first-child\{text-align:center;vertical-align:middle\}/);
 assert.match(css,/\.app-players-nationality-flag\{display:block;width:20px;height:15px;object-fit:contain;margin-inline:auto\}/);
 assert.match(directory,/image\.width=20;image\.height=15;image\.alt=/);
 assert.match(preview,/image\.width=20;image\.height=15;image\.src=/);
 assert.match(club,/app-players-nationality-flag[^\n]+width="20" height="15"/);
 assert.doesNotMatch(css,/\.app-players-table tbody tr:not\(\.app-players-empty-row\)\{height:44px\}/);
 assert.doesNotMatch(css,/\.app-players-table tbody tr:not\(\.app-players-empty-row\)\{height:42px\}/,'previous 42px height must not remain');
 assert.match(css,/\.app-players-table tbody td:nth-child\(2\)\{text-align:left;font-weight:650;vertical-align:middle;line-height:18px\}/,'name cell stays vertically centered');
 assert.match(css,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link,\.app-player-club-link\)\{[^}]*position:relative;display:inline-flex;align-items:center;vertical-align:middle;max-width:100%;min-height:18px;[^}]*font:inherit;line-height:18px/,'link line box is stable');
 assert.match(css,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link,\.app-player-club-link\)::after\{[^}]*position:absolute;inset-inline:0;bottom:0;height:1px/,'underline is out of flow');
 assert.doesNotMatch(css,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link,\.app-player-club-link\)::after\{[^}]*bottom:-2px/,'underline should stay close to text');
 assert.match(css,/\.app-players-table :is\(\.app-player-name-link,\.club-roster-player-link,\.app-player-club-link\):is\(:hover,:focus-visible\)::after\{opacity:1\}/);
 assert.doesNotMatch(css,/\.app-players-table \.app-player-name-link:hover\{text-decoration:underline/);
 assert.doesNotMatch(read('assets/club-page.css'),/\.club-roster-player-link:hover[^\n]*text-decoration:underline/,'roster does not add an in-flow underline');
 assert.match(css,/\.app-players-table thead th\{height:42px/,'compact headings remain stable across all player tables');
 // Preserve all responsive and first-paint geometry and five empty loading rows.
 assert.equal((read('players/index.html').match(/class="app-players-loading-row"/g)||[]).length,5);
 assert.match(css,/@media\(max-width:720px\)\{\.app-players-table th,\.app-players-table td\{padding-inline:10px\}\}/);
});

test('Players search clear X uses a pointer cursor on supported WebKit/Blink browsers',()=>{
 const html=read('players/index.html'),css=read('assets/app.css');
 assert.match(html,/data-players-filter="name" maxlength="80"/);
 assert.match(css,/\.app-players-name-control input::-webkit-search-cancel-button\{cursor:pointer\}/);
});

test('Players drawer uses section separators rather than nested outlined cards',()=>{
 const css=read('assets/app.css'),html=read('players/index.html');
 assert.match(css,/\.app-players-filter-section\{display:block;min-width:0;border:0;border-bottom:1px solid var\(--border\);border-radius:0;background:transparent/);
 assert.match(css,/\.app-players-attribute-category\{min-width:0;border:0;border-bottom:1px solid var\(--line\);border-radius:0;background:transparent/);
 assert.match(css,/\.app-players-attribute-category:last-child\{border-bottom:0\}/);
 assert.match(css,/\.app-players-filter-section-body\{display:grid;[^}]*border-top:0\}/);
 assert.match(css,/\.app-players-attribute-options\{display:grid;[^}]*border-top:0\}/);
 assert.match(css,/\.app-players-filters\{[^}]*scrollbar-gutter:stable/);
 for(const key of ['nationality','position','age','height','foot','attributes'])
  assert.ok(html.includes('data-players-filter-section="'+key+'"'),key);
 for(const key of ['technical','mental','physical','goalkeeping'])
  assert.ok(html.includes('data-players-attribute-category="'+key+'"'),key);
});

test('Players sortable header cycles descending, ascending, then resets sorting',()=>{
 const js=read('assets/players-directory.js');
 const i=js.indexOf('  function cycleSort(key){'),j=js.indexOf("  table.tHead.addEventListener('click'",i);
 assert.ok(i>0&&j>i);
 const source=js.slice(i,j);
 const state={view:'overview',group:'technical',sort:'',order:'',page:4},loads=[],history=[];
 const cycle=new Function('state','allowedSort','syncUrl','load',source+';return cycleSort;')(
  state,(_v,_g,key)=>['age','name'].includes(key),
  ()=>history.push({sort:state.sort,order:state.order}),page=>loads.push(page));
 cycle('age');assert.deepEqual([state.sort,state.order,state.page],['age','desc',1]);
 cycle('age');assert.deepEqual([state.sort,state.order],['age','asc']);
 cycle('age');assert.deepEqual([state.sort,state.order],['','']);
 cycle('name');assert.deepEqual([state.sort,state.order],['name','desc']);
 cycle('none');assert.equal(loads.length,4,'invalid column cannot trigger fetch');
 assert.deepEqual(loads,[1,1,1,1]);
 assert.deepEqual(history[2],{sort:'',order:''},'reset leaves no sort URL values');
});
test('Players filter labels are compact, counters circular and chevrons rotate in place',()=>{
 const html=read('players/index.html'),css=read('assets/app.css'),js=read('assets/players-directory.js');
 const range=html.slice(html.indexOf('data-players-filter-section="age"'),html.indexOf('data-players-filter-section="foot"'));
 for(const key of ['ageMin','heightMin'])assert.match(range,new RegExp('data-players-filter-label="'+key+'">Min</span>'));
 for(const key of ['ageMax','heightMax'])assert.match(range,new RegExp('data-players-filter-label="'+key+'">Max</span>'));
 assert.doesNotMatch(range,/Min age|Max age|Min height|Max height|placeholder="All"/);
 assert.match(js,/const labels=\[t\.name,t\.sections\[0\],t\.sections\[1\],t\.min,t\.max,t\.min,t\.max/);
 assert.match(js,/field\.type==='number'\)field\.placeholder=''/);
 assert.doesNotMatch(html,/players-filter-foot-label/);
 assert.match(html,/id="players-filter-foot-heading" data-players-section-label="foot"/);
 assert.match(html,/aria-labelledby="players-filter-foot-heading players-filter-foot-value"/);
 for(const selector of ['app-players-filter-active','app-players-filter-section-count','app-players-attribute-count'])
  assert.match(css,new RegExp('\\.'+selector+'\\{[^}]*border-radius:50%'));
 assert.match(css,/\.app-players-filter-section-header>\.language-chevron,\.app-players-attribute-category>summary>\.language-chevron\{[^}]*transform-origin:50% 50%/);
 assert.match(css,/\.app-players-filter-section-header:hover,\.app-players-filter-section-header:active/);
 assert.match(css,/user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent/);
 assert.match(css,/\.app-players-filters\{[^}]*scrollbar-gutter:stable/);
});

test('Players refinement: accessible Name section, sort chevrons, animated dividers and short dropdown anchoring',()=>{
 const html=read('players/index.html'),generator=read('tools/generate-app-pages.mjs'),css=read('assets/app.css'),js=read('assets/players-directory.js'),sql=read('backend/src/public-players-read.ts');
 assert.match(html,/class="app-players-filter-section app-players-name-section"/);
 assert.match(html,/id="players-filter-name-label" data-players-filter-label="name">Name/);
 assert.match(html,/data-players-filter="name" maxlength="80"[^>]*aria-labelledby="players-filter-name-label"/);
 assert.doesNotMatch(html,/<label class="app-players-filter-control app-players-name-control"/,'clicking the Name title must not focus its input');
 assert.match(css,/\.app-players-name-section \.app-players-filter-section-header\{cursor:default\}/);
 assert.ok(generator.includes('app-players-name-section'),'generator retains the same Name section');
 assert.match(css,/\.app-players-sort-button\{[^}]*gap:0;line-height:1.2/);
 assert.match(css,/\.app-players-sort-chevron\{[^}]*width:16px;height:16px/);
 assert.equal((html.match(/class="app-players-sort-chevron" viewBox="0 0 20 20" width="16" height="16"/g)||[]).length,6);
 assert.match(js,/chev\.setAttribute\('width','16'\);chev\.setAttribute\('height','16'\)/);
 assert.match(js,/const naturalHeight=Math\.max\(44,menu\.scrollHeight/);
 assert.match(js,/const expandAnimations=new WeakMap\(\)/);
 assert.match(js,/content\.animate\(/);
 assert.match(js,/section\.open=false/);
 assert.match(css,/\.app-players-filter-section\[open\]:not\(\.is-collapsing\)/);
 assert.match(sql,/const pitchPositions=\['GK','RB','RWB','CB','LWB','LB','DM','RM','CM','LM','RW','AM','LW','ST'\]/);
 assert.match(sql,/\['positions',positionRank\]/);
});

test('Players table header geometry and independent sort-label anchoring',()=>{
 const html=read('players/index.html'),gen=read('tools/generate-app-pages.mjs'),css=read('assets/app.css'),js=read('assets/players-directory.js');
 assert.match(css,/\.app-players-table thead th\{height:42px;padding-block:2px;[^}]*font-size:12px;font-weight:700;line-height:1.2/);
 assert.match(css,/\.app-players-sort-button\{display:flex;[^}]*height:36px;min-height:36px/);
 assert.match(css,/\.app-players-sort-label\{position:relative;display:inline-block;max-width:100%/);
 assert.match(css,/\.app-players-sort-chevron\{position:absolute;display:block;left:calc\(100% \+ 7px\);top:50%/);
 assert.match(css,/\.app-players-flag-col \.app-players-sort-chevron\{left:0\}/);
 assert.equal((html.match(/class="app-players-sort-label"/g)||[]).length,6);
 assert.equal((html.match(/class="app-players-sort-chevron"/g)||[]).length,6);
 assert.match(js,/wrapper\.append\(text\);button\.append\(wrapper\)/);
 assert.match(js,/chev\.append\(path\);wrapper\.append\(chev\)/);
 assert.match(html,/wrapper\.textContent=label;button\.append\(wrapper\)/);
 assert.match(html,/chevron\.append\(path\);wrapper\.append\(chevron\)/);
 assert.match(gen,/app-players-sort-label/);
 assert.match(css,/\.app-players-table tbody tr:not\(\.app-players-empty-row\)\{height:36px\}/);
 assert.match(css,/\.app-players-table \.app-players-loading-row td\{height:36px/);
});

test('Players filter close matches the canonical search and calendar popup X',()=>{
 const html=read('players/index.html'),css=read('assets/app.css'),generator=read('tools/generate-app-pages.mjs'),js=read('assets/players-directory.js');
 const button=html.match(/<button[^>]*data-players-filter-close[^>]*>[\s\S]*?<\/button>/)?.[0];
 const search=html.match(/<button id="app-search-close"[^>]*>[\s\S]*?<\/button>/)?.[0];
 assert.ok(button&&search,'both the filter and search dialog close buttons exist');
 assert.match(button,/class="app-search-close"/);
 assert.match(button,/aria-label="Close filters"/);
 assert.match(button,/width="18" height="18" viewBox="0 0 24 24"/);
 assert.match(button,/stroke-width="1.8"/);
 assert.match(button,/d="M6 6l12 12M18 6L6 18"/);
 assert.match(search,/class="app-search-close"/);
 assert.match(search,/d="M6 6l12 12M18 6L6 18"/);
 assert.match(css,/\.app-search-close\{display:grid;place-items:center;flex:none;width:36px;height:36px;[^}]*border:0;border-radius:8px/);
 assert.match(css,/\.app-search-close:hover\{background:#244040\}/);
 assert.match(css,/html\[data-theme="light"\] \.app-search-close:hover\{background:#E8F3EB\}/);
 assert.doesNotMatch(css,/\.app-players-filter-close\{/,'no drawer-specific size, border or hover override');
 assert.ok(generator.includes('data-players-filter-close'));
 assert.match(js,/filterClose\?\.addEventListener\('click',\(\)=>closeFilterDialog\(\)\)/);
});

test('UI-VIEWS-01: only view/subview controls change; History content and mobile scroll geometry remain untouched',()=>{
 const css=read('assets/app.css'),club=read('assets/club-page.css'),detail=read('assets/player-detail.css');
 const marker='/* UI-VIEWS-01 (#559):';
 const index=css.lastIndexOf(marker);
 assert.ok(index>0,'isolated UI view controls block must be present');
 const viewCss=css.slice(index);
 assert.match(viewCss,/body\.app-body\{--fa-tab-width-regular:100px\}/,'all shared desktop view buttons use the narrower token');
 assert.match(viewCss,/body\.app-body \.app-players-tabs:not\(\.club-roster-tabs\) \.app-competition-tab\{[^}]*width:116px;min-width:116px;max-width:116px/,'Players main views shrink without modifying Roster mobile widths');
 assert.match(viewCss,/@media\(min-width:621px\)\{[\s\S]*?body\.app-body \.app-players-groups\{max-width:424px\}/,'desktop attribute subviews are more compact');
 assert.match(viewCss,/body\.app-body \.club-roster \.club-roster-tabs \.app-competition-tab\{[^}]*width:84px;min-width:84px;max-width:84px/,'desktop Roster subviews shrink');
 assert.match(viewCss,/@media\(max-width:620px\)\{[\s\S]*?width:min\(116px,calc\(\(100% - 4px\)\/2\)\)/,'Players main mobile views become compact');
 assert.match(viewCss,/\.app-competition-tabs:not\(\.app-players-tabs\) \.app-competition-tab\{font-size:12px\}/,'mobile main view labels use 12px');
 assert.doesNotMatch(viewCss,/\.club-roster \.club-roster-tabs \.app-competition-tab\{font-size:/,'Roster subview label size is not overridden');
 assert.doesNotMatch(viewCss,/\.app-players-groups \.app-players-group\{font-size:/,'Player attribute subview label size is not overridden');
 assert.match(css,/\.app-players-group\{flex:0 0 calc\(40% - 3\.2px\);[^}]*font-size:clamp\(10px,2\.8vw,11px\)/,'original mobile Players subview font is retained');
 assert.match(club,/\.club-roster \.club-roster-tabs \.app-competition-tab\{box-sizing:border-box;[^}]*font-size:11px/,'original Roster subview font is retained');
 assert.doesNotMatch(viewCss,/\.club-history(?:[\s.{:#-]|$)|club-history-table|club-history-season/,'no History content overrides');
 assert.match(css,/--app-competition-tab-mobile-width:max\(92px,calc\(\(100% - 8px\)\/2\.5\)\)/,'retain the existing mobile 2.5-tab main view width');
 assert.match(club,/\.club-roster \.club-roster-tabs \.app-competition-tab\{flex:0 0 calc\(40% - 3\.2px\)/,'retain the 2.5-tab mobile Roster width');
 assert.match(css,/\.app-players-groups\[data-can-scroll-right="true"\]\{--app-tabs-fade-right:16px\}/,'keep mobile fade states');
 assert.match(detail,/\.app-player-detail-tabs \.app-competition-tab\{flex:0 0 var\(--fa-tab-width-regular\)/,'player detail views inherit shared width token');
});


test('#532 rapid sort/refetch ignores superseded successful responses and failures',async()=>{
 const js=read('assets/players-directory.js');
 const begin=js.indexOf('  async function load(page){');
 const end=js.indexOf('  async function appendNext(){',begin);
 assert.ok(begin>=0&&end>begin,'use production refresh implementation');
 const source=js.slice(begin,end);
 const fixture=new Function(`
  let ticket=0,loadedThrough=1,current=null,status='ready',appendPending=false,appendError='',batchAbort=null,pendingReturn=null;
  const state={page:1},pending=[],painted=[],loading=[];
  const countNode=null,scroll={setAttribute(){}},body={querySelector(){return null}};
  const renderHead=()=>{},showLoadingRows=()=>loading.push(5);
  const fetchBatch=()=>new Promise((resolve,reject)=>pending.push({resolve,reject}));
  const paint=data=>painted.push(data.players.map(player=>player.id));
  const syncUrl=()=>{},renderProgress=()=>{},message=()=>{},announceAppend=()=>{},locale=()=>({error:'error'});
  ${source}
  return {load,pending,snapshot:()=>({ids:current?.players.map(p=>p.id),status,painted,loading})};
 `)();
 const result=id=>({count:1,page:1,pageSize:50,totalPages:1,players:[{id}]});
 const stale=fixture.load(1),latest=fixture.load(1);
 assert.equal(fixture.pending.length,2);
 fixture.pending[1].resolve(result(99));await latest;
 fixture.pending[0].resolve(result(13));await stale;
 assert.deepEqual(fixture.snapshot().ids,[99],'obsolete response cannot overwrite latest sort');
 assert.deepEqual(fixture.snapshot().painted,[[99]],'no repaint from stale results');
 assert.deepEqual(fixture.snapshot().loading,[5,5],'each refresh reserves five rows');
 const retry=fixture.load(1),final=fixture.load(1);
 fixture.pending[2].reject(Error('obsolete network response'));await retry;
 fixture.pending[3].resolve(result(105));await final;
 assert.deepEqual(fixture.snapshot().ids,[105]);
 assert.equal(fixture.snapshot().status,'ready','obsolete failure does not replace newer result');
});


test('Players aborts superseded list and Load more GETs without publishing obsolete rows',async()=>{
 const js=read('assets/players-directory.js');
 const begin=js.indexOf('  async function fetchBatch(page){'),end=js.indexOf('  function changeView(view){',begin);
 assert.ok(begin>=0&&end>begin,'exercise the actual directory data-loading functions');
 const pending=[],rendered=[];
 const fetch=(url,{signal})=>new Promise((resolve,reject)=>{
  const entry={url,signal,finish:data=>resolve({ok:true,status:200,json:async()=>data})};
  signal?.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'})),{once:true});
  pending.push(entry);
 });
 const runner=new Function('fetch','AbortController','painted',[
  "let state={page:1,filters:{},sort:'',order:''},ticket=0,loadedThrough=1;",
  "let current=null,lastCount=null,status='loading',appendPending=false,appendError='',batchAbort=null,pendingReturn=null;",
  "const filterKeys=[],countNode=null,scroll={setAttribute(){},focus(){}},loadMore={},document={activeElement:null},body={append(){}};",
  "const renderHead=()=>{},showLoadingRows=()=>{},paint=data=>painted.push(data);",
  "const syncUrl=()=>{},renderProgress=()=>{},hydrateClubCrests=()=>{},playerRows=()=>[];",
  "const message=()=>{},announceAppend=()=>{},language=()=>'en',locale=()=>({error:'error',appendLoading:'Loading more players...',moreLoaded:'New players: {count}. Shown: {loaded} of {total}.',allLoaded:'All players loaded',changed:'Changed',loadError:'Unable to load'}),requestAnimationFrame=()=>{};",
  js.slice(begin,end),
  "return {load,appendNext,snapshot:()=>({current,loadedThrough,status,appendPending})};"
 ].join('\n'))(fetch,AbortController,rendered);
 const packet=players=>({page:1,pageSize:50,count:51,totalPages:2,players});
 const first=runner.load(1),obsolete=pending[0];
 assert.equal(pending.length,1);
 const newer=runner.load(1);
 assert.equal(obsolete.signal.aborted,true,'new load aborts obsolete GET immediately');
 assert.equal(pending.length,2);
 pending[1].finish(packet([{id:101}]));
 await Promise.all([first,newer]);
 assert.deepEqual(runner.snapshot().current.players.map(p=>p.id),[101]);
 assert.equal(rendered.length,1,'old response does not render');
 const append=runner.appendNext(),obsoleteAppend=pending[2];
 assert.equal(obsoleteAppend.url.includes('offset=50'),true);
 const updated=runner.load(1);
 assert.equal(obsoleteAppend.signal.aborted,true,'new load aborts pending append GET');
 pending[3].finish(packet([{id:202}]));
 await Promise.all([append,updated]);
 assert.deepEqual(runner.snapshot().current.players.map(p=>p.id),[202]);
 assert.equal(runner.snapshot().appendPending,false);
 assert.equal(rendered.length,2,'only latest results render');
});
