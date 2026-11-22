import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {request} from 'node:http';
import {once} from 'node:events';
import {runInNewContext} from 'node:vm';
import {createPreviewStandings,createPreviewWorldHistory} from '../tools/dev-standings-preview-data.mjs';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
import {matchPublicContext} from '../assets/match-public-context.mjs';
import {competitionLogoUrl} from '../assets/public-image-urls.mjs';
import {parseRoute,buildRoute} from '../assets/routes-registry.mjs';
import {renderWorldHistoryPage} from '../tools/render-world-history.mjs';
import {isAllowlistedPublicPath} from '../tools/publication-guard.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('#581: World History has canonical public route, assets and generated first paint',()=>{
 assert.equal(parseRoute('/history')?.canonical,'/history');
 assert.equal(buildRoute({kind:'page',id:'history'}),'/history');
 for(const path of ['history/index.html','assets/world-history.js','assets/world-history.css'])
  assert.equal(isAllowlistedPublicPath(path),true,path);
 const html=read('history/index.html');
 assert.match(html,/<title>World History — Football Architect<\/title>/);
 assert.ok(html.includes(renderWorldHistoryPage()));
 assert.doesNotMatch(html,/id="world-history-intro"|class="fa-world-history-intro"/,'History subtitle is absent from the first paint');
 assert.doesNotMatch(read('assets/world-history.js'),/querySelector\('#world-history-intro'\)/,'runtime never addresses deleted subtitle');
 assert.match(html,/id="world-history-archive"[^>]*aria-busy="true"/);
 assert.match(html,/id="world-history-season"[^>]*disabled/);
 assert.match(html,/id="world-history-country"[^>]*disabled/);
 assert.match(html,/id="world-history-competition"[^>]*disabled/);
 assert.match(html,/src="\/assets\/world-history\.js"/);
 assert.match(html,/href="\/assets\/world-history\.css"/);
 assert.doesNotMatch(html,/id="app-divisions"/);
 assert.doesNotMatch(html,/data-history-dev-archive/);
});
test('#581: hosting and source never expose an active season as closed history',()=>{
 const hosting=JSON.parse(read('vercel.json'));
 assert.ok(hosting.redirects.some(r=>r.source==='/history/'&&r.destination==='/history'));
 assert.ok(hosting.rewrites.some(r=>r.source==='/history'&&r.destination==='/history/index.html'));
 const backend=read('backend/src/public-world-history.ts');
 assert.match(backend,/readClosedSeasonHistory\(db,season\)/);
 assert.match(backend,/before\.phase==='closed'/);
 assert.doesNotMatch(backend,/readPublicSportingSeason|readPublicCalendarDay|resimulate/);
 const controller=read('assets/world-history.js');
 assert.match(controller,/fetch\('\/api\/world\/history'/);
 assert.match(controller,/window\.addEventListener\('popstate'/);
 assert.doesNotMatch(controller,/dev-standings-preview|Math\.random\(/);
});


test('#581: World History is a full-size World sidebar link and uses shared site dropdowns',()=>{
 const html=read('history/index.html');
 const nav=html.slice(html.indexOf('<nav class="fa-shell-nav"'),html.indexOf('</nav>'));
 const submenu=nav.indexOf('id="nav01-children"'),submenuEnd=nav.indexOf('</div>',submenu);
 const link=nav.indexOf('id="app-nav-world-history"'),explore=nav.indexOf('data-nav01="3"');
 assert.ok(submenu>0&&link>submenuEnd&&link<explore,'History is a World sibling, not a hidden nested submenu item');
 assert.match(nav,/id="app-nav-world-history" href="\/history" data-nav01-history aria-current="page"><svg class="fa-icon" width="18" height="18"/);
 assert.equal((nav.match(/id="app-nav-world-history"/g)||[]).length,1,'one History item in initial HTML');
 assert.equal((nav.match(/aria-current="page"/g)||[]).length,1,'History is the unique active item before JavaScript runs');
 assert.doesNotMatch(nav,/id="app-nav-divisions"[^>]*aria-current="page"/,'no Comp/History active collision');
 assert.match(html,/href="\/assets\/clubs-directory\.css"/,'reuse Clubs filter styles');
 assert.ok(html.indexOf('src="/assets/competition-tabs.js"')<html.indexOf('src="/assets/world-history.js"'));
 for(const id of ['season','country','competition']){
  assert.match(html,new RegExp('id="world-history-'+id+'-trigger"[^>]+role="combobox"[^>]+aria-haspopup="listbox"'));
  assert.match(html,new RegExp('role="listbox" id="world-history-'+id+'-menu"'));
  assert.match(html,new RegExp('id="world-history-'+id+'"[^>]+hidden[^>]+aria-hidden="true"'));
  assert.match(html,new RegExp('id="world-history-'+id+'-label"'));
 }
 const runtime=read('assets/world-history.js');
 const sidebar=read('assets/sidebar-evolution.js');
 assert.match(runtime,/window\.faBindCompetitionMenu\(/);
 assert.match(runtime,/syncFilters\(\)/);
 assert.match(runtime,/fitViewport:true/);
 assert.match(sidebar,/historyChildren\.insertAdjacentElement\('afterend',historyLink\)/);
 assert.match(sidebar,/width=\\"18\\" height=\\"18\\"/);
 assert.doesNotThrow(()=>new Function(runtime),'History view script parses');
 assert.doesNotThrow(()=>new Function(sidebar),'Sidebar script parses');
});


test('#581: shared app view router hides Dashboard for /history and keeps its own title',()=>{
 const source=read('assets/app.js'),html=read('history/index.html');
 assert.match(source,/if \(path === "\/history"\) return "history";/);
 assert.match(source,/const worldHistory = document\.getElementById\("world-history"\)/);
 assert.match(source,/dashboard\.hidden = current !== "dashboard"/);
 assert.match(source,/worldHistory\.hidden = current !== "history"/);
 assert.match(source,/historyTitles\[language\(\)\]/,'localized History title, never undefined');
 assert.match(html,/id="app-dashboard" class="app-view"[^>]*hidden/,'Dashboard hidden at first paint');
 assert.match(html,/id="world-history" class="app-view fa-world-history"/);
 assert.doesNotMatch(html,/id="world-history" class="app-view fa-world-history"[^>]*hidden/);
});
test('#581: local anonymous bridge accepts exact History API and backend supports Season 0',()=>{
 const proxy=read('tools/dev-admin-api-proxy.mjs');
 assert.match(proxy,/raw==='\/api\/world\/history'/);
 assert.match(proxy,/const method=anonymousRead\|\|inbox\?'GET'/);
 const backend=read('backend/src/public-world-history.ts');
 assert.match(backend,/Math\.max\(0,before\.seasonNumber-1\)/);
 assert.doesNotMatch(backend,/last<0\)invalid\(\)/);
});


test('#581 Debug: league champions come from exactly the same deterministic standings as other DEV pages',()=>{
 const manifest=JSON.parse(read('competitions/_shared/manifest.json'));
 const cases=[
  {progress:{season:0,matchdays:0},years:[]},
  {progress:{season:1,matchdays:0},years:[]},
  {progress:{season:1,matchdays:30},years:[]},
  {progress:{season:1,matchdays:33},years:[1]},
  {progress:{season:2,matchdays:0},years:[1]},
  {progress:{season:2,matchdays:30},years:[1]},
  {progress:{season:2,matchdays:33},years:[2,1]},
  {progress:{season:4,matchdays:0},years:[3,2,1]}
 ];
 for(const {progress,years} of cases){
  const projection=createPreviewWorldHistory(manifest,progress);
  assert.equal(projection.providerId,'dev-world-history');
  assert.deepEqual(projection.provenance,{kind:'fictional',sourceRef:'dev-fictional-preview',approved:false});
  assert.equal(projection.coverage,'domestic-only');
  assert.deepEqual(projection.seasons.map(s=>s.seasonNumber),years);
  assert.equal(projection.status,years.length?'available':'empty');
  for(const season of projection.seasons){
   assert.equal(season.champions.length,16);
   assert.equal(new Set(season.champions.map(c=>c.competitionId)).size,16);
   for(const {competitionId,championClubId} of season.champions){
    assert.doesNotMatch(competitionId,/^int-/,'international cups have no DEV winner evidence');
    const division=manifest.divisions.find(x=>x.id===competitionId);
    assert.ok(division);
    const winner=createPreviewStandings(division,30,season.seasonNumber).rows[0].club;
    assert.equal(championClubId,winner.countryId+'-'+winner.clubId);
   }
  }
 }
 assert.throws(()=>createPreviewWorldHistory(manifest,{season:5,matchdays:0}),/Invalid DEV/);
 assert.throws(()=>createPreviewWorldHistory(manifest,{season:2,matchdays:34}),/Invalid DEV/);
 assert.throws(()=>createPreviewWorldHistory({...manifest,divisions:[]},{season:2,matchdays:0}),/Invalid DEV|Missing DEV/);
});

test('#581 Debug: localhost injects protected widget and source; public artifacts never include DEV scripts',async()=>{
 const server=createPreviewServer({devPreview:true,subdomains:true});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const send=(path,host='app.localhost:2000')=>new Promise((resolve,reject)=>{
  const req=request({hostname:'127.0.0.1',port:server.address().port,path,headers:{host}},res=>{
   let body='';res.on('data',chunk=>body+=chunk);
   res.on('end',()=>resolve({status:res.statusCode,body}));
  });req.on('error',reject);req.end();
 });
 try{
  const local=await send('/history');
  assert.equal(local.status,200);
  assert.match(local.body,/faDevPreviewMode=true/);
  assert.match(local.body,/\/__fa_dev__\/debug-settings\.mjs/);
  assert.match(local.body,/faDevCurrentSeason/);
  assert.equal((local.body.match(/src="\/__fa_dev__\/debug-settings\.mjs"/g)||[]).length,1);
  assert.ok(local.body.includes('id="world-history"'));
  const publicHtml=read('history/index.html');
  assert.doesNotMatch(publicHtml,/\/__fa_dev__\//);
  const protectedScript=await send('/__fa_dev__/standings-client.mjs');
  assert.equal(protectedScript.status,200);
  assert.match(protectedScript.body,/createPreviewWorldHistory/);
  assert.match(protectedScript.body,/fa:dev-world-history/);
  const missing=await send('/__fa_dev__/unknown-history-module.mjs');
  assert.equal(missing.status,404);
 }finally{
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
 }
});

test('#581 Debug: History switches sources, retains filters, and excludes DEV winners from public API',()=>{
 const publicRuntime=read('assets/world-history.js');
 const devClient=read('tools/dev-standings-preview-client.mjs');
 const artifact=read('tools/dev-preview-artifact.mjs');
 const server=read('tools/dev-standings-preview.mjs');
 assert.match(publicRuntime,/safeDebugPayload/);
 assert.match(publicRuntime,/event\.detail/);
 assert.match(publicRuntime,/window\.addEventListener\('fa:dev-world-history'/);
 assert.match(publicRuntime,/if\(debugActive\(\)\)/);
 assert.match(publicRuntime,/competitionIds\.slice\(0,16\)/);
 assert.doesNotMatch(publicRuntime,/debugIntro|world-history-intro/,'subtitle is absent in public and Debug modes');
 assert.match(publicRuntime,/fetch\('\/api\/world\/history'/);
 assert.match(devClient,/historyPath\|\|/);
 assert.match(devClient,/fa:dev-progress-change/);
 assert.match(devClient,/fa:dev-world-history-retry/);
 assert.match(artifact,/path==="history\/index\.html"/);
 assert.match(server,/file==="history\/index\.html"/);
 assert.doesNotMatch(read('backend/src/public-world-history.ts'),/dev-world-history|fictional-preview/);
 for(const path of ['tools/dev-standings-preview-client.mjs','tools/dev-standings-preview-data.mjs'])
  assert.equal(isAllowlistedPublicPath(path),false,'DEV sporting generator is never a public asset');
 assert.doesNotThrow(()=>new Function(publicRuntime),'public History controller parses');
});


test('#581: World History shows each competition official name and approved compact logo',()=>{
 const runtime=read('assets/world-history.js');
 const css=read('assets/world-history.css');
 const catalog=JSON.parse(read('competitions/_shared/manifest.json'));
 const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
 const ids=countries.flatMap(country=>[1,2].map(tier=>country+'-'+tier));
 for(const id of ids){
  const reference=matchPublicContext({competitionId:id})?.competitions?.[0];
  assert.equal(reference?.id,id,'Matches must use this exact published identity');
  const canonical=catalog.divisions.find(division=>division.id===id);
  assert.ok(canonical,'same official division present in canonical catalogue');
  assert.equal(reference.name,canonical.name,'History must display the real competition name');
  const logo=competitionLogoUrl(id,'compact');
  assert.equal(logo,'/assets/competitions/'+id+'/compact.svg');
  assert.equal(isAllowlistedPublicPath(logo.slice(1)),true,'must be an approved public image');
  assert.match(read(logo.slice(1)),/<svg\b/,'approved SVG exists');
 }
 for(const [id,name] of [['int-1','Sovereign Cup'],['int-2','Federation Cup']]){
  assert.equal(matchPublicContext({competitionId:id})?.competitions?.[0]?.name,name);
  assert.equal(competitionLogoUrl(id,'compact'),null,'no approved international SVG exists');
 }
 assert.match(runtime,/import\('\.\/match-public-context\.mjs'\)/,'use Matches published names, not a hardcoded label list');
 assert.match(runtime,/import\('\.\/public-image-urls\.mjs'\)/,'only approved competition logo URLs');
 assert.match(runtime,/definition\.name/);
 assert.match(runtime,/competitionNames\.get\(id\)/);
 assert.match(runtime,/competitionMark\(champion\.competitionId\)/);
 assert.match(runtime,/fa-world-history-competition-name/);
 assert.match(runtime,/neutralCupMark/,'international cups reuse the neutral, not a fictitious, emblem');
 assert.match(css,/\.fa-world-history-logo img,\.fa-world-history-logo svg\{[^}]*object-fit:contain/,'all SVG and cup marks preserve proportions');
 assert.match(css,/\.fa-world-history-row \.fa-world-history-competition\{display:flex/);
 assert.doesNotMatch(runtime,/club.*\.logo|Math\.random\(/,'club logos are not competition logos');
});


test('#581: World History logos share one fixed size and only the competition name is linked',()=>{
 const runtime=read('assets/world-history.js');
 const css=read('assets/world-history.css');
 assert.match(css,/\.fa-world-history-logo\{[^}]*width:40px;height:40px;flex:0 0 40px/,'all images reserve the same 40px square');
 assert.match(css,/\.fa-world-history-logo img,\.fa-world-history-logo svg\{[^}]*width:40px;height:40px/,'SVG and fallback have the same dimensions');
 assert.match(css,/\.fa-world-history-logo\.app-competition-logo-placeholder\{[^}]*width:40px;height:40px;border:0/,'shared fallback styles do not resize the logo');
 assert.match(runtime,/const competition=make\('span','fa-world-history-competition'\)/);
 assert.match(runtime,/const competitionLink=make\('a','fa-world-history-competition-name',compLabel\(champion\.competitionId,w\)\)/);
 assert.match(runtime,/competition\.append\(competitionMark\(champion\.competitionId\),competitionLink\)/,'logo and text link are siblings');
 assert.doesNotMatch(runtime,/const competition=make\('a','fa-world-history-competition'\)/,'the whole competition cell is not clickable');
});

test('#581: seasons default newest open; each header independently toggles and survives rerender',()=>{
 const runtime=read('assets/world-history.js');
 const start=runtime.indexOf(' function render(){');
 const end=runtime.indexOf('\n let competitionRequest=',start);
 assert.ok(start>=0&&end>start,'extract History render function');
 const source=runtime.slice(start,end);
 function element(tag,className='',value=''){
  const e={
   tag,className,textContent:value,children:[],attributes:new Map(),listeners:new Map(),hidden:false,
   states:new Map(),dataset:{},parent:null,
   append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node)}},
   replaceChildren(...nodes){this.children=[...nodes];for(const node of nodes)node.parent=this},
   contains(target){return this===target||this.children.some(node=>node.contains?.(target))},
   remove(){if(this.parent){const index=this.parent.children.indexOf(this);if(index>=0)this.parent.children.splice(index,1);this.parent=null}},
   setAttribute(k,v){this.attributes.set(k,String(v))},
   getAttribute(k){return this.attributes.get(k)||null},
   addEventListener(k,listener){this.listeners.set(k,listener)},
  };
  e.classList={toggle(k,on){e.states.set(k,on)}};
  return e;
 }
 const entries=[1,3,2].map(seasonNumber=>({
  seasonNumber,champions:[{competitionId:'IT-1',championClubId:'IT-1'}]
 }));
 const archive=element('div'),status=element('p'),count=element('p');
 const expandedSeasons=new Map();
 const env={
  locale:()=>({season:'Season',count:'champions',competition:'Competition',competitionsCount:'competitions'}),loading:false,error:false,payload:{
   seasons:entries,world:{seasonNumber:4}
  },debugActive:()=>false,status,archive,count,expandedSeasons,
  seasons:{value:''},countries:{value:''},comps:{value:''},
  clubCrests:new Map(),clubNames:new Map(),
  document:{createElementNS:(namespace,tag)=>element(tag)},
  make:element,compLabel:id=>id,competitionMark:id=>element('span','fa-world-history-logo',id),
 };
 const render=runInNewContext(source+'\nrender',env);
 status.textContent='Old Loading…';status.hidden=false;env.loading=true;render();
 assert.equal(status.textContent,'','no Loading copy visible over the skeleton');
 assert.equal(status.hidden,true,'status stays hidden until a result or error');
 env.loading=false;render();
 assert.deepEqual(archive.children.map(el=>el.children[0].children[0].children[0].textContent),
  ['Season 3','Season 2','Season 1'],'sort by latest sporting season, not API order');
 const seasons=archive.children;
 const head=s=>s.children[0].children[0];
 const list=s=>s.children[1];
 assert.deepEqual(seasons.map(s=>head(s).getAttribute('aria-expanded')),['true','false','false']);
 assert.deepEqual(seasons.map(s=>list(s).hidden),[false,true,true]);
 for(const s of seasons){
  assert.equal(head(s).getAttribute('aria-controls'),list(s).id);
  assert.ok(head(s).children[1].attributes.get('aria-hidden')==='true');
 }
 // Competition logo and link occupy separate siblings within a noninteractive span.
 const comp=list(seasons[0]).children[0].children[0];
 assert.equal(comp.tag,'span');
 assert.equal(comp.children[0].tag,'span');
 assert.equal(comp.children[0].href,undefined);
 assert.equal(comp.children[1].tag,'a');
 assert.equal(comp.children[1].href,'/competitions/it-1/standings?view=standings&season=3',
  'view precedes season in the working canonical Standings link');
 assert.equal(list(seasons[1]).children[0].children[0].children[1].href,
  '/competitions/it-1/standings?view=standings&season=2');
 const club=list(seasons[0]).children[0].children[1].children.at(-1);
 assert.equal(club.href,'/clubs/it/1/history#club-history-season-3',
  'club History deep-link preserves the winning season');
 const clubHolder=list(seasons[0]).children[0].children[1];
 const missingCrest=clubHolder.children[0];
 assert.match(missingCrest.className,/app-world-club-crest-placeholder/);
 assert.equal(missingCrest.dataset.clubCrestFallback,'true','missing approved crest uses shared shield');
 assert.equal(missingCrest.children.length,0,'unpublished club crest never requests an invented image');
 // A published crest stays blank while pending, then displays its real SVG.
 env.clubCrests.set('IT-1','assets/clubs/IT/1/crest.svg');
 render();
 const pending=list(archive.children[0]).children[0].children[1].children[0];
 assert.equal(pending.dataset.clubCrestPending,'true','published SVG loads without shield flash');
 assert.equal(pending.dataset.clubCrestFallback,undefined);
 const pendingImage=pending.children[0];
 assert.equal(pendingImage.src,'/assets/clubs/IT/1/crest.svg');
 pendingImage.listeners.get('load')();
 assert.equal(pending.dataset.clubCrestLoaded,'true');
 assert.equal(pending.dataset.clubCrestPending,undefined);
 render();
 const failed=list(archive.children[0]).children[0].children[1].children[0];
 failed.children[0].listeners.get('error')();
 assert.equal(failed.dataset.clubCrestFallback,'true','network failure displays shared club shield');
 assert.equal(failed.dataset.clubCrestLoaded,undefined);
 assert.equal(failed.children.length,0,'broken image removed without layout collapse');
 env.clubCrests.delete('IT-1');
 render();
 assert.equal(head(seasons[0]).children.length,2,'header is just season name and chevron');
 assert.equal(head(seasons[0]).children[0].textContent,'Season 3');
 const older=seasons[1],button=head(older);
 button.listeners.get('click')();
 assert.equal(button.getAttribute('aria-expanded'),'true');
 assert.equal(list(older).hidden,false);
 assert.equal(older.states.get('is-collapsed'),false);
 head(seasons[0]).listeners.get('click')();
 assert.equal(list(seasons[0]).hidden,true);
 render();
 assert.deepEqual(archive.children.map(s=>head(s).getAttribute('aria-expanded')),['false','true','false'],
  'explicit toggles remain stable across filter and language rerenders');
 assert.match(read('assets/world-history.css'),/\.fa-world-history-season-toggle:focus-visible/);
 assert.match(read('assets/world-history.css'),/\.fa-world-history-season-toggle\[aria-expanded="false"\]/);
 const clubSource=read('assets/club-page.js');
 assert.match(clubSource,/\['authoritative','dev'\]\.includes\(historySnapshot\.source\)/,
  'Club History season anchors must work in official and local Debug views');
});


test('#581: History season titles have no competitions count',()=>{
 const js=read('assets/world-history.js');
 const css=read('assets/world-history.css');
 assert.doesNotMatch(js,/competitionsCount|fa-world-history-season-count|fa-world-history-season-heading/);
 assert.doesNotMatch(css,/fa-world-history-season-count|fa-world-history-season-heading/);
 assert.match(js,/toggle\.append\(make\('span','fa-world-history-season-name',w\.season\+' '\+season\.seasonNumber\)\)/);
});

test('#581: first paint and Debug transitions preserve accurately aligned skeletons',()=>{
 const html=read('history/index.html'),rendered=renderWorldHistoryPage();
 const css=read('assets/world-history.css'),runtime=read('assets/world-history.js');
 assert.ok(html.includes(rendered),'the renderer and checked-in HTML have identical skeleton DOM');
 assert.match(rendered,/fa-world-history-skeleton-header/,'same accordion header shape as the final view');
 const rows=[...rendered.matchAll(/class="fa-world-history-skeleton-row fa-world-history-row"/g)];
 assert.equal(rows.length,18,'authoritative archive has 18 competitions in one completed season');
 assert.equal((rendered.match(/fa-world-history-skeleton-logo/g)||[]).length,18);
 assert.equal((rendered.match(/fa-world-history-skeleton-crest/g)||[]).length,18);
 assert.match(rendered,/fa-world-history-skeleton fa-world-history-season"[^>]*aria-hidden="true"/);
 assert.match(css,/\.fa-world-history-skeleton-logo\{width:40px;height:40px\}/,'competition logo skeleton exactly matches 40px real logo');
 assert.match(css,/\.fa-world-history-skeleton-crest\{width:29px;height:29px\}/,'club crest skeleton matches final 29px');
 assert.match(css,/\.fa-world-history-skeleton-row\+\.fa-world-history-skeleton-row/,'same row dividers');
 assert.match(css,/\.fa-world-history-row\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/,'reuse two equal final columns');
 assert.match(css,/@media\(max-width:500px\)\{[\s\S]*?\.fa-world-history-row\{grid-template-columns:minmax\(0,1fr\)/,'skeleton and real rows use same mobile layout');
 assert.match(css,/\.fa-world-history \.fa-world-history-status\[hidden\]\{display:block!important;visibility:hidden\}/,'status line stays reserved after load');
 assert.match(runtime,/const skeletonMarkup=archive\.innerHTML/);
 assert.match(runtime,/const showSkeleton=\(\)=>/);
 assert.match(runtime,/\.slice\(16\)\)row\.remove\(\)/,'protected Debug skeleton reflects 16 domestic competitions');
 assert.match(runtime,/function pendingDebug\(\)\{[\s\S]*?showSkeleton\(\)/,'Debug progress changes reuse the skeleton');
 assert.doesNotMatch(runtime,/archive\.replaceChildren\(\);\s*setFilterDisabled\(true\);retry\.hidden/,'no blank archive on Debug source transitions');
});


test('#581: no loading text on first paint or protected/public source changes',()=>{
 const html=read('history/index.html');
 const renderer=renderWorldHistoryPage();
 const js=read('assets/world-history.js'),css=read('assets/world-history.css');
 assert.ok(html.includes(renderer),'first paint and generated markup agree');
 assert.match(renderer,/id="world-history-status"[^>]*hidden><\/p>/);
 assert.doesNotMatch(renderer,/Loading verified archive|Loading\.\.\.|Loading…/);
 assert.doesNotMatch(js,/debugLoading:|loading:'Loading/,'no unused localized loading messages');
 assert.match(js,/if\(loading\)\{status\.textContent='';status\.hidden=true;return;\}/);
 assert.match(js,/status\.textContent='';status\.hidden=true;/);
 assert.match(css,/\.fa-world-history \.fa-world-history-status\[hidden\]\{display:block!important;visibility:hidden\}/);
 assert.match(js,/debugError:|error:'Verified history/,'real error messages remain available');
});

test('#581: club crest shield reuses the shared site primitive at the final 29px geometry',()=>{
 const js=read('assets/world-history.js'),css=read('assets/world-history.css');
 const shared=read('assets/app.css');
 assert.match(js,/app-world-club-crest-placeholder fa-world-history-club-crest/);
 assert.match(js,/crestSlot\.dataset\.clubCrestPending='true'/);
 assert.match(js,/crestSlot\.dataset\.clubCrestFallback='true'/);
 assert.match(js,/crestSlot\.dataset\.clubCrestLoaded='true'/);
 assert.match(js,/img\.addEventListener\('error'/);
 assert.match(css,/\.fa-world-history-row \.fa-world-history-club-crest\.app-world-club-crest-placeholder\{[^}]*width:29px;height:29px;flex:0 0 29px/);
 assert.match(shared,/\.app-world-club-crest-placeholder::before\{[^}]*clip-path:var\(--fa-crest-shield-shape\)/);
 assert.match(shared,/\.app-world-club-crest-placeholder\[data-club-crest-pending="true"\]::before/);
 assert.match(shared,/\.app-world-club-crest-placeholder\[data-club-crest-loaded="true"\]>.app-club-crest-image/);
});
