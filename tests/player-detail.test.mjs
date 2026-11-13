import test from 'node:test';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRoute,buildRoute} from '../assets/routes-registry.mjs';
import {publicRequestFile,isAllowlistedPublicPath,planPublicFiles} from '../tools/publication-guard.mjs';
import {renderPlayerDetailPage} from '../tools/render-player-detail.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('#502 persisted and protected preview detail routes are canonical and statically publishable',()=>{
 assert.equal(buildRoute({kind:'player',id:42}),'/players/42');
 assert.equal(parseRoute('/players/42')?.kind,'player');
 assert.equal(parseRoute('/players/42')?.redirect,false);
 assert.equal(parseRoute('/players/42/')?.canonical,'/players/42');
 for(const invalid of ['/players/0','/players/01','/players/-1','/players/1.5','/players/99999999999999999999999','/players/%34','/players/42/other'])
  assert.equal(parseRoute(invalid),null,invalid);
 assert.equal(publicRequestFile('/players/42'),'players/_shared/index.html');
 assert.equal(publicRequestFile('/players/42/'),'players/_shared/index.html');
 assert.equal(parseRoute('/admin/players/preview/player')?.kind,'page');
 assert.equal(publicRequestFile('/admin/players/preview/player'),'admin/players/preview/player/index.html');
 for(const file of ['players/_shared/index.html','admin/players/preview/player/index.html','assets/player-detail.js','assets/player-detail.css'])
  assert.equal(isAllowlistedPublicPath(file),true,file);
 const published=planPublicFiles();
 assert.ok(published.includes('players/_shared/index.html'));
 assert.ok(published.includes('admin/players/preview/player/index.html'));
});

test('#502 both generated detail shells match canonical renderer and reserve first-paint fields',()=>{
 for(const [src,output,mode] of [
  ['players/index.html','players/_shared/index.html','public'],
  ['admin/players/preview/index.html','admin/players/preview/player/index.html','preview']
 ]){
  const html=read(output);
  assert.equal(html,renderPlayerDetailPage(read(src),mode),'generated source drift: '+output);
  assert.match(html,/data-player-detail-mode="(public|preview)"/);
  assert.match(html,/src="\/assets\/player-detail.js" defer/);
  assert.match(html,/href="\/assets\/player-detail.css"/);
  assert.match(html,/class="app-skeleton-bar app-player-detail-name-skeleton"/);
  assert.equal((html.match(/data-detail-value="/g)||[]).length,5);
  assert.equal((html.match(/data-detail-attr-value="/g)||[]).length,20);
  assert.equal((html.match(/data-detail-attribute-group="/g)||[]).length,4);
  assert.equal((html.match(/class="app-panel app-player-detail-/g)||[]).length,3);
  assert.match(html,/data-detail-pitch-markers/);
  assert.match(html,/class="app-player-detail-silhouette"/);
  for(const view of ['overview','info','stats','history','progression'])assert.match(html,new RegExp('data-detail-view="'+view+'"'));
  for(const view of ['stats','history','progression'])assert.match(html,new RegExp('data-detail-view="'+view+'"[^>]* disabled aria-disabled="true"'));
  assert.doesNotMatch(html,/data-detail-view="attributes"|data-detail-group="technical"/);
  assert.match(html,/data-detail-value="nationality"/);
  assert.match(html,/data-detail-value="secondary_nationality"/);
  assert.doesNotMatch(html,/data-detail-position-value|data-detail-position-label|app-player-detail-position-line/);
  assert.match(html,/data-detail-panel="overview" role="tabpanel"/);
  assert.match(html,/data-detail-panel="info" role="tabpanel"/);
  assert.match(html,/data-player-detail-first-paint/);
  assert.match(html,/data-detail-positions aria-label="Positions"/);
  assert.equal((html.match(/data-detail-panel="/g)||[]).length,2);
  assert.match(html,/data-detail-view="info"[^>]*aria-controls="player-detail-info-panel"/);
  for(const group of ['technical','mental','physical','goalkeeping'])assert.match(html,new RegExp('data-detail-attribute-group="'+group+'"'));
  assert.doesNotMatch(html,/data-players-filter-open|data-admin-players-confirmation/);
  if(mode==='public')assert.doesNotMatch(html,/data-detail-back|Back to players/);
  if(mode==='preview'){
   assert.match(html,/data-detail-back href="\/admin\/players"/);
   assert.match(html,/name="robots" content="noindex,nofollow"/);
   assert.match(html,/meta name="referrer" content="no-referrer"/);
   assert.match(html,/data-player-detail-mode="preview" hidden/);
   assert.match(html,/src="\/assets\/admin-permissions-cache.js" defer/);
  }
 }
});

test('#502 names alone become links; uncommitted candidates cannot get permanent IDs',()=>{
 const directory=read('assets/players-directory.js'),preview=read('assets/admin-players-preview.js');
 const script=read('assets/player-detail.js'),index=read('backend/src/index.ts');
 const publicApi=read('backend/src/public-players-read.ts');
 assert.match(directory,/link\.href='\/players\/'\+player\.id/);
 assert.match(directory,/link\.className='app-player-name-link'/);
 assert.match(preview,/link\.className='app-player-name-link'/);
 assert.match(preview,/target\.searchParams\.set\('draftId',id\)/);
 assert.match(preview,/target\.searchParams\.set\('index',String\(index\+1\)\)/);
 assert.match(preview,/\/admin\/players\/preview\/player/);
 assert.doesNotMatch(preview,/link\.href='\/players\/'/);
 assert.match(script,/authorizedDraft\(\)/);
 assert.match(script,/\/api\/admin\/players\/draft/);
 assert.match(script,/p\.preview_id!=='trial-'/);
 assert.doesNotMatch(script,/localStorage|sessionStorage|innerHTML/);
 assert.match(script,/if\(preview\)root\.hidden=true/);
 assert.match(index,/const playerDetail=url\.pathname\.match/);
 assert.match(publicApi,/SELECT id,payload_json FROM generated_players WHERE id=\?/);
 assert.match(publicApi,/projectPublicFootballerDirectoryRecord/);
});

test('#502 preview generated link retains only routing context and never persists on open',()=>{
 const script=read('assets/player-detail.js'),preview=read('assets/admin-players-preview.js');
 for(const field of ['returnView','returnGroup','returnPage','returnScroll','returnSort','returnOrder'])
  assert.ok(script.includes(field)&&preview.includes(field),field);
 assert.match(script,/const permitted=\['first_name'/);
 assert.match(script,/projected\.attributes=Object\.fromEntries/);
 assert.match(script,/draftPattern\.test/);
 assert.match(script,/cache:'no-store'/);
 assert.match(script,/data-detail-pitch-markers/);
 assert.match(script,/addEventListener\('popstate'/);
 assert.match(script,/addEventListener\('pageshow'/);
 assert.doesNotMatch(script,/\/api\/admin\/players\/commit|\/api\/admin\/players\/preview/);
});

test('#502 error pages settle placeholders rather than leaving a perpetual loading skeleton',()=>{
 const script=read('assets/player-detail.js');
 assert.match(script,/if\(state!=='loading'\)\{/);
 assert.match(script,/setContent\(nameNode,copy\.notFound\)/);
 assert.match(script,/\[data-detail-value\],\[data-detail-attr-value\]/);
});

test('#502 direct player details activate Players, never Dashboard, in app shell and sidebar',()=>{
 const app=read('assets/app.js'),sidebar=read('assets/sidebar-evolution.js');
 const a=app.indexOf('  function activeView() {'),b=app.indexOf('\n  function renderLanguage()',a);
 assert.ok(a>=0&&b>a,'route recognition must remain in the app shell');
 const activeViewSource=app.slice(a,b);
 const c=sidebar.indexOf("const path=location.pathname.replace("),d=sidebar.indexOf('\nconst selected=',c);
 assert.ok(c>=0&&d>c,'sidebar selected navigation must use route pathname');
 const sidebarSource=sidebar.slice(c,d)+'\n;onPlayers;';
 for(const [path,expectedView,selectedPlayers] of [
  ['/players','players',true],
  ['/players/42','players',true],
  ['/players/42/','players',true],
  ['/players/314','players',true],
  ['/dashboard','dashboard',false],
  ['/clubs/it/1/overview','clubs',false],
  ['/players/abc','dashboard',false]
 ]){
  const window={location:{pathname:path}};
  const document={querySelector:()=>null};
  assert.equal(runInNewContext(activeViewSource+'\nactiveView()', {window,document}),expectedView,path);
  assert.equal(runInNewContext(sidebarSource,{location:window.location}),selectedPlayers,path);
 }
 assert.match(app,/if \(dashboard\) dashboard\.hidden = current !== "dashboard"/);
 assert.match(app,/if \(divisions\) divisions\.hidden = current !== "divisions" && current !== "clubs" && current !== "players"/);
});

test('#502 Overview and Info are independent views with reserved first paint and history navigation',()=>{
 const js=read('assets/player-detail.js'),css=read('assets/player-detail.css'),renderer=read('tools/render-player-detail.mjs');
 assert.match(js,/views\.filter\(tab=>!tab\.disabled\)/);
 assert.match(js,/url\.searchParams\.set\('view','info'\)/);
 assert.match(js,/url\.searchParams\.delete\('view'\)/);
 assert.match(js,/history\.pushState\(history\.state/);
 assert.match(js,/new URLSearchParams\(location\.search\)\.get\('view'\)==='info'/);
 assert.match(css,/html\[data-player-detail-view="info"\] \.app-player-detail-overview\{display:none\}/);
 assert.match(css,/html:not\(\[data-player-detail-view="info"\]\) \.app-player-detail-info-view\{display:none\}/);
 assert.match(css,/grid-template-columns:minmax\(245px,\.36fr\) minmax\(0,1fr\)/);
 assert.match(css,/\.app-player-detail-attribute-columns\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(css,/app-player-detail-position-list|app-player-detail-position-line/);
 assert.match(renderer,/detailPanel\(preview\)/);
 assert.doesNotMatch(read('players/_shared/index.html'),/data-detail-back/);
 assert.match(read('admin/players/preview/player/index.html'),/data-detail-back/);
});
