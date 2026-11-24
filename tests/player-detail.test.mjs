import test from 'node:test';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {parseRoute,buildRoute} from '../assets/routes-registry.mjs';
import {publicRequestFile,isAllowlistedPublicPath,planPublicFiles} from '../tools/publication-guard.mjs';
import {renderPlayerDetailPage} from '../tools/render-player-detail.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('#733 Player Detail derives published club crests from stable IDs',()=>{
 const source=read('assets/player-detail.js');
 const begin=source.indexOf(' function verifiedClubCrest('),end=source.indexOf('\n function renderClub()',begin);
 assert.ok(begin>0&&end>begin,'shared Player Overview/Stats/Matches crest verifier');
 const resolve=runInNewContext('('+source.slice(begin,end).trim()+')',{});
 const canonical='assets/clubs/IT/1/crest.svg';
 assert.equal(resolve('IT-1',{'IT-1':canonical}),canonical);
 for(const [id,registry] of [
  ['IT-1',{}],['IT-1',{'IT-1':'https://evil.invalid/logo.svg'}],
  ['IT-1',{'IT-1':'assets/clubs/PT/1/crest.svg'}],
  ['IT-01',{'IT-01':'assets/clubs/IT/01/crest.svg'}],
  ['XX-1',{'XX-1':'assets/clubs/XX/1/crest.svg'}],
  ['IT-1',null],['IT-1',[]]
 ])assert.equal(resolve(id,registry),null,'invalid or unpublished crest: '+id);
 assert.match(source,/const crest=verifiedClubCrest\(key,clubCatalog\.clubCrests\)/);
 assert.equal((source.match(/clubCrest:key=>verifiedClubCrest\(key,crests\)/g)||[]).length,2,
  'Stats and Matches must use the same ID/registry guard; History no longer renders matches');
});

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
 for(const file of ['players/_shared/index.html','admin/players/preview/player/index.html','assets/player-detail.js','assets/player-detail.css','assets/player-history.mjs'])
  assert.equal(isAllowlistedPublicPath(file),true,file);
 const published=planPublicFiles();
 assert.ok(published.includes('players/_shared/index.html'));
 assert.ok(published.includes('admin/players/preview/player/index.html'));
});

test('#527 public mobile Player Detail text is centered against the portrait without the unused subtitle',()=>{
 const css=read('assets/player-detail.css'),renderer=read('tools/render-player-detail.mjs');
 assert.match(css,/@media\(max-width:620px\)\{\s*\.app-player-detail-heading\{align-items:center\}/);
 assert.match(css,/\.app-player-detail-identity\{align-self:center;justify-content:center\}/);
 assert.match(css,/\.app-player-detail-page\[data-player-detail-mode="public"\] \.app-player-detail-subtitle\{display:none\}/);
 assert.match(renderer,/data-detail-name/);
 assert.match(renderer,/data-detail-role/);
 assert.match(renderer,/data-detail-header-nationality/);
 assert.match(renderer,/data-detail-header-age/);
 assert.match(css,/\.app-player-detail-heading\{display:flex;align-items:center;gap:18px;min-width:0;min-height:181px\}/,
  'restored 9411b691 desktop layout, with no horizontal justification override');
});

test('#502 both generated detail shells match canonical renderer and reserve first-paint fields',()=>{
 {const script=read('assets/player-detail.js'),style=read('assets/player-detail.css');
  assert.ok(script.includes("'football-architect:player-views-scroll:'+location.pathname"),'per-player scroll storage');
  assert.ok(script.includes('viewBar.scrollLeft=n'),'restore player horizontal View scroll');
  assert.ok(script.includes("sessionStorage.setItem(viewScrollKey,String(viewBar.scrollLeft))"),'persist manual View scroll');
  assert.ok(script.includes("window.addEventListener('pagehide',saveViewScroll)"),'save final scroll before refresh');
  assert.ok(style.includes('.app-player-stats-table .app-player-stats-season-row{padding-top:0}'));
  assert.ok(style.includes('.app-player-stats-table .app-player-stats-loading .app-player-stats-skeleton-label{min-height:34px}'));
  assert.doesNotMatch(script,/localStorage|innerHTML/);
  assert.match(script,/const viewScrollKey=preview\?null:'football-architect:player-views-scroll:'\+location\.pathname;/);
  assert.match(script,/try\{const raw=sessionStorage\.getItem\(viewScrollKey\)/);
  assert.match(script,/sessionStorage\.setItem\(viewScrollKey,String\(viewBar\.scrollLeft\)\)/);
 }

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
  for(const view of (mode==='preview'?['stats','history','progression']:['progression']))assert.match(html,new RegExp('data-detail-view="'+view+'"[^>]* disabled aria-disabled="true"'));
  if(mode==='public'){
   assert.match(html,/data-detail-view="stats"[^>]*aria-controls="player-detail-stats-panel"/);
   assert.match(html,/data-detail-view="matches"[^>]*aria-controls="player-detail-matches-panel"/);
  }else assert.doesNotMatch(html,/data-detail-view="matches"|data-detail-panel="matches"/);
  assert.doesNotMatch(html,/data-detail-view="attributes"|data-detail-group="technical"/);
  assert.match(html,/data-detail-value="nationality"/);
  assert.match(html,/data-detail-value="secondary_nationality"/);
  assert.doesNotMatch(html,/data-detail-position-value|data-detail-position-label|app-player-detail-position-line/);
  assert.match(html,/data-detail-panel="overview" role="tabpanel"/);
  assert.match(html,/data-detail-panel="info" role="tabpanel"/);
  assert.match(html,/data-player-detail-first-paint/);
  assert.match(html,/data-detail-positions aria-labelledby="player-detail-positions-title"/);
  assert.match(html,/<h2 id="player-detail-positions-title" data-detail-section-title="positions">Positions<\/h2>/);
  assert.match(html,/data-detail-status role="status" aria-live="polite" hidden/);
  assert.equal((html.match(/data-detail-panel="/g)||[]).length,mode==="public"?5:2);
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
 assert.match(directory,/link\.href='\/players\/'\+player\.id;/);
 assert.match(directory,/link\.className='app-player-name-link'/);
 assert.match(preview,/link\.className='app-player-name-link'/);
 assert.match(preview,/target\.searchParams\.set\('draftId',id\)/);
 assert.match(preview,/target\.searchParams\.set\('index',String\(index\+1\)\)/);
 assert.match(preview,/target\.searchParams\.set\('view','overview'\)/);
 assert.match(preview,/\/admin\/players\/preview\/player/);
 assert.doesNotMatch(preview,/link\.href='\/players\/'/);
 assert.match(script,/authorizedDraft\(\)/);
 assert.match(script,/\/api\/admin\/players\/draft/);
 assert.match(script,/p\.preview_id!=='trial-'/);
 assert.doesNotMatch(script,/localStorage|innerHTML/);
 assert.match(script,/if\(preview\)root\.hidden=true/);
 assert.match(index,/const playerDetail=url\.pathname\.match/);
 assert.match(publicApi,/SELECT p\.id,p\.payload_json,a\.club_key,/);
 assert.match(publicApi,/LEFT JOIN player_club_affiliations a ON a\.player_id=p\.id/);
 assert.match(publicApi,/LEFT JOIN player_portrait_profiles portrait ON portrait\.player_id=p\.id/);
 assert.match(publicApi,/portrait\.status='approved'/);
 assert.match(publicApi,/portrait\.prompt_version='player-portrait-v4\.2'/);
 assert.match(script,/player\.portraitApproved===true/);
 assert.ok(script.includes("'/assets/players/portraits/'+id+'.webp'"));
 assert.match(publicApi,/projectPublicFootballerDirectoryRecord/);
});

test('#502 preview generated link retains only routing context and never persists on open',()=>{
 const script=read('assets/player-detail.js'),preview=read('assets/admin-players-preview.js');
 for(const field of ['returnView','returnGroup','returnPage','returnScroll','returnSort','returnOrder'])
  assert.ok(script.includes(field)&&preview.includes(field),field);
 assert.match(script,/const permitted=\['first_name'/);
 assert.match(script,/projected\.attributes=Object\.fromEntries/);
 assert.match(script,/draftPattern\.test/);
 assert.match(script,/previewCommitted=draft\.status==='committed'/);
 assert.match(script,/p\.preview_id!==undefined/);
 assert.match(script,/cache:'no-store'/);
 assert.match(script,/data-detail-pitch-markers/);
 assert.match(script,/addEventListener\('popstate'/);
 assert.match(script,/addEventListener\('pageshow'/);
 assert.doesNotMatch(script,/\/api\/admin\/players\/commit|\/api\/admin\/players\/preview/);
});

test('#502 error pages settle placeholders rather than leaving a perpetual loading skeleton',()=>{
 const script=read('assets/player-detail.js');
 assert.match(script,/if\(state!=='loading'\)\{/);
 assert.ok(script.includes("setContent(nameNode,state==='not-found'?copy.notFound:copy.player)"));
 assert.match(script,/statusNode\.hidden=state==='loading'\|\|state==='ready'\|\|state==='not-found'/);
 const statusLine=script.split('\n').find(line=>line.includes('statusNode.textContent='));
 assert.ok(statusLine,'Status copy must be rendered in a dedicated footer node');
 assert.doesNotMatch(statusLine,/state==='not-found'\?copy\.notFound/);
 assert.match(script,/\[data-detail-value\],\[data-detail-attr-value\]/);
});

test('#502 direct player details activate Players, never Dashboard, in app shell and sidebar',()=>{
 const app=read('assets/app.js'),sidebar=read('assets/sidebar-evolution.js'),firstPaint=read('assets/sidebar-first-paint.js');
 const a=app.indexOf('  function activeView() {'),b=app.indexOf('\n  function renderLanguage()',a);
 assert.ok(a>=0&&b>a,'route recognition must remain in the app shell');
 const activeViewSource=app.slice(a,b);
 const c=sidebar.indexOf("const path=location.pathname.replace("),d=sidebar.indexOf('\nconst selected=',c);
 assert.ok(c>=0&&d>c,'sidebar selected navigation must use route pathname');
 const sidebarSource=sidebar.slice(c,d)+'\n;onPlayers;';
 const firstPaintStart=firstPaint.indexOf("const path=location.pathname.replace("),firstPaintEnd=firstPaint.indexOf('\nconst selected=',firstPaintStart);
 assert.ok(firstPaintStart>=0&&firstPaintEnd>firstPaintStart,'first-paint bootstrap must resolve the active route before deferred scripts');
 const firstPaintSource=firstPaint.slice(firstPaintStart,firstPaintEnd)+'\n;onPlayers;';
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
  assert.equal(runInNewContext(firstPaintSource,{location:window.location}),selectedPlayers,path+' first paint');
 }
 for(const file of ['players/_shared/index.html','admin/players/preview/player/index.html']){
  const html=read(file);
  const inline=html.match(/<script data-nav01-bootstrap>([\s\S]*?)<\/script>/)?.[1];
  assert.equal(inline,firstPaint.trim(),file+' must embed the canonical first-paint bootstrap');
 }
 assert.match(app,/if \(dashboard\) dashboard\.hidden = current !== "dashboard"/);
 assert.match(app,/if \(divisions\) divisions\.hidden = current !== "divisions" && current !== "clubs" && current !== "players"/);
});

test('#502 Overview and Info are independent views with reserved first paint and history navigation',()=>{
 const js=read('assets/player-detail.js'),css=read('assets/player-detail.css'),renderer=read('tools/render-player-detail.mjs');
 assert.match(js,/views\.filter\(tab=>!tab\.disabled\)/);
 assert.match(js,/if\(target==='overview'\)url\.searchParams\.delete\('view'\)/);
 assert.match(js,/else url\.searchParams\.set\('view',target\)/);
 assert.match(js,/normalizeViewUrl\(\)/);
 assert.match(js,/history\.replaceState\(history\.state/);
 assert.match(js,/history\.pushState\(history\.state/);
 assert.match(js,/new URLSearchParams\(location\.search\)\.get\('view'\)==='info'/);
 assert.match(css,/html\[data-player-detail-view="info"\] \.app-player-detail-overview\{display:none\}/);
 assert.match(css,/html:not\(\[data-player-detail-view="info"\]\) \.app-player-detail-info-view\{display:none\}/);
 assert.match(css,/grid-template-columns:minmax\(300px,\.54fr\) minmax\(0,1fr\)/);
 assert.match(css,/\.app-player-detail-attribute-columns\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(css,/app-player-detail-position-list|app-player-detail-position-line/);
 assert.match(renderer,/detailPanel\(preview\)/);
 assert.doesNotMatch(read('players/_shared/index.html'),/data-detail-back/);
 assert.match(read('admin/players/preview/player/index.html'),/data-detail-back/);
});

test('#555 default player Overview is a clean URL across initial load, tabs, legacy links and browser history',()=>{
 const script=read('assets/player-detail.js');
 const begin=script.indexOf(' function syncViewParam('),end=script.indexOf("\n window.addEventListener('pageshow'",begin);
 assert.ok(begin>=0&&end>begin,'exercise the real player-detail routing functions');
 const setup=path=>{
  let current=new URL('http://app.localhost:2000'+path);
  const actions=[],listeners={};
  const location={
   get href(){return current.href;},
   get pathname(){return current.pathname;},
   get search(){return current.search;},
   get hash(){return current.hash;}
  };
  const history={
   state:{restored:true},
   pushState(_state,_title,next){actions.push('push');current=new URL(next,current);},
   replaceState(_state,_title,next){actions.push('replace');current=new URL(next,current);}
  };
  const preview=current.pathname==='/admin/players/preview/player';
  const requested=new URLSearchParams(current.search).get('view');
  const view=requested==='info'?'info':(!preview&&requested==='stats'?'stats':'overview');
  const context={preview,view,URL,URLSearchParams,location,history,views:[],render:()=>{},
   window:{addEventListener:(name,fn)=>{listeners[name]=fn;}}};
  const api=runInNewContext(script.slice(begin,end)+'\n({setView,normalizeViewUrl,currentView:()=>view})',context);
  return {api,actions,listeners,path:()=>current.pathname+current.search+current.hash,
   navigate:next=>{current=new URL(next,current);}};
 };
 const normal=setup('/players/33');
 normal.api.normalizeViewUrl();
 assert.equal(normal.path(),'/players/33');
 assert.deepEqual(normal.actions,[],'clean direct URL should not mutate history');
 normal.api.setView('info');
 assert.equal(normal.path(),'/players/33?view=info');
 assert.equal(normal.api.currentView(),'info');
 normal.api.setView('overview');
 assert.equal(normal.path(),'/players/33');
 assert.deepEqual(normal.actions,['push','push'],'tab switches remain navigable');
 normal.navigate('/players/33?view=info');
 normal.listeners.popstate();
 assert.equal(normal.api.currentView(),'info','Back/Forward restores Info');
 assert.equal(normal.path(),'/players/33?view=info');
 normal.navigate('/players/33');
 normal.listeners.popstate();
 assert.equal(normal.api.currentView(),'overview','Back/Forward restores Overview');
 assert.equal(normal.path(),'/players/33');
 normal.api.setView('stats');
 assert.equal(normal.path(),'/players/33?view=stats','public Stats has canonical query');
 assert.equal(normal.api.currentView(),'stats');
 normal.navigate('/players/33?view=info');
 normal.listeners.popstate();
 assert.equal(normal.api.currentView(),'info','Back/Forward restores Info after Stats');
 normal.navigate('/players/33?view=stats');
 normal.listeners.popstate();
 assert.equal(normal.api.currentView(),'stats','Back/Forward restores public Stats');
 normal.api.setView('overview');
 assert.equal(normal.path(),'/players/33');
 const legacy=setup('/players/33?view=overview&group=technical#positions');
 legacy.api.normalizeViewUrl();
 assert.equal(legacy.path(),'/players/33?group=technical#positions');
 assert.deepEqual(legacy.actions,['replace'],'legacy Overview must normalize without new history entry');
 const preview=setup('/admin/players/preview/player?draftId=example&index=1&returnPage=2&view=overview#positions');
 preview.api.normalizeViewUrl();
 assert.equal(preview.path(),'/admin/players/preview/player?draftId=example&index=1&returnPage=2#positions','draft context and fragment remain intact');
 preview.api.setView('stats');
 assert.equal(preview.api.currentView(),'overview','unpublished Admin draft must not expose Stats');
 assert.equal(preview.path(),'/admin/players/preview/player?draftId=example&index=1&returnPage=2#positions');
});

test('#502 skeleton footprint, pitch size, attribute separators and silent loading are stable',()=>{
 const html=read('players/_shared/index.html');
 const script=read('assets/player-detail.js'),css=read('assets/player-detail.css');
 assert.match(script,/nameNode\.replaceChildren\(skeleton\('app-player-detail-name-skeleton'\)\)/);
 assert.match(script,/statusNode\.hidden=state==='loading'\|\|state==='ready'/);
 assert.doesNotMatch(script,/Loading player|Caricamento giocatore|Spieler wird geladen|Cargando jugador|Chargement du joueur/);
 assert.match(html,/data-detail-status role="status" aria-live="polite" hidden/);
 assert.match(css,/\.app-player-detail-status\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.app-player-detail-attribute-line:last-child\{border-bottom:0\}/);
 assert.match(css,/\.app-player-detail-attribute-line\{[^}]*min-height:38px[^}]*padding:5px 8px[^}]*border-bottom:1px solid var\(--line\)/);
 assert.match(css,/\.app-player-detail-pitch-holder\{width:min\(100%,330px\)/);
 assert.match(css,/\.app-player-detail-positions h2,\.app-player-detail-attributes h2\{font-size:22px/);
 assert.match(css,/\.app-player-detail-name-skeleton\{[^}]*width:270px;max-width:100%;height:32px;margin:0/);
 assert.match(css,/\.app-player-detail-attribute-line dd \.app-skeleton-bar\{[^}]*margin:0 0 0 auto/);
 assert.match(css,/\.app-player-detail-info-line \[data-detail-value="age"\] \.app-skeleton-bar\{width:30px\}/);
 assert.match(css,/\.app-player-detail-name-skeleton\{width:160px;height:24px\}/);
});

test('#535 positions are mirrored and markers do not collide',()=>{
 const source=read('assets/player-detail.js');
 const value=source.match(/const pitchCoords=Object\.freeze\(\{([^}]+)\}\);/)?.[1];
 assert.ok(value);
 const pos=Object.fromEntries([...value.matchAll(/([A-Z]+):\[(\d+),(\d+)\]/g)].map(([,k,x,y])=>[k,[+x,+y]]));
 assert.equal(Object.keys(pos).length,14);
 for(const [l,r] of [['LB','RB'],['LWB','RWB'],['LM','RM'],['LW','RW']]){
  assert.equal(pos[l][0]+pos[r][0],240);
  assert.equal(pos[l][1],pos[r][1]);
 }
 for(const [k,[x,y]] of Object.entries(pos))assert.ok(x>=25&&x<=215&&y>=25&&y<=305,k);
 for(const [a,b] of [['GK','CB'],['CB','DM'],['DM','CM'],['CM','AM'],['AM','ST'],['LB','LWB'],['RB','RWB'],['RM','RW'],['LM','LW']])
  assert.ok(Math.hypot(pos[a][0]-pos[b][0],pos[a][1]-pos[b][1])>32,a+'/'+b);
});
test('#535 primary role highlights align with canonical generator A/B tiers',()=>{
 const source=read('assets/player-detail.js'),generator=read('backend/src/players-generator-core.mjs');
 const clientText=source.match(/const roleAttributeProfiles=Object\.freeze\(\{([\s\S]*?)\}\);/)?.[1];
 const generatorText=generator.match(/const profiles=\{([\s\S]*?)\};/)?.[1];
 assert.ok(clientText&&generatorText);
 const pairs=text=>Object.fromEntries([...text.matchAll(/^\s*(\w+):\['([^']+)','([^']+)'\],?\s*$/gm)]
  .map(([,k,a,b])=>[k,[a.split(' '),b.split(' ')]]));
 const client=pairs(clientText),engine=pairs(generatorText);
 assert.deepEqual(Object.keys(client).sort(),['GK',...Object.keys(engine)].sort());
 for(const [role,tiers] of Object.entries(engine))assert.deepEqual(client[role],tiers,role);
 assert.deepEqual(client.GK,[['gk_reflexes','gk_handling','gk_positioning','gk_aerial'],['agility','positioning','decisions','composure']]);
 for(const [role,[a,b]] of Object.entries(client)){assert.equal(a.length,4,role);assert.equal(b.length,4,role);assert.equal(new Set([...a,...b]).size,8,role);}
 assert.match(source,/row\.classList\.toggle\('is-core'/);
 assert.match(source,/row\.classList\.toggle\('is-support'/);
 const css=read('assets/player-detail.css');
 assert.match(css,/\.app-player-detail-attribute-line\.is-core/);
 assert.match(css,/\.app-player-detail-attribute-line\.is-support/);
 for(const path of ['players/_shared/index.html','admin/players/preview/player/index.html']){
  const html=read(path);
  assert.equal((html.match(/data-detail-legend-title/g)||[]).length,1);
  assert.equal((html.match(/data-detail-tier="core"/g)||[]).length,1);
  assert.equal((html.match(/data-detail-tier="support"/g)||[]).length,1);
 }
});

test('#535 follow-up: inline legend, compact rows and same marker appearance',()=>{
 const renderer=read('tools/render-player-detail.mjs'),css=read('assets/player-detail.css');
 assert.doesNotMatch(renderer,/app-standings-legend app-player-detail-legend/);
 assert.match(renderer,/app-player-detail-legend/);
 assert.match(css,/\.app-player-detail-legend\{display:flex;align-items:center;/);
 assert.doesNotMatch(css,/\.app-player-detail-legend\{[^}]*\b(border|background|padding):/);
 assert.match(css,/\.app-player-detail-attribute-line\{[^}]*min-height:38px;[^}]*padding:5px 8px/);
 assert.match(css,/\.app-player-detail-pitch-marker circle\{fill:#FFFFFF;stroke:#143D2A;stroke-width:2\}/);
 assert.doesNotMatch(css,/\.app-player-detail-pitch-marker\.is-primary circle/);
 for(const path of ['players/_shared/index.html','admin/players/preview/player/index.html']){
  const html=read(path);
  assert.match(html,/class="app-player-detail-legend" data-detail-legend/);
  assert.doesNotMatch(html,/class="app-standings-legend app-player-detail-legend"/);
 }
});

test('#535 selectable pitch roles use a primary default and update A/B without losing SVG keyboard focus',()=>{
 const js=read('assets/player-detail.js'),css=read('assets/player-detail.css');
 assert.match(js,/let player=null,state='loading',request=0,selectedPosition=null/);
 assert.match(js,/player=data;selectedPosition=positionCodes\(\)\[0\]\|\|null;state='ready'/);
 assert.match(js,/player=null;selectedPosition=null;state='loading'/);
 assert.match(js,/const profile=player&&roleAttributeProfiles\[selectedPosition\]/);
 assert.match(js,/function selectPosition\(code\)/);
 assert.match(js,/!positionCodes\(\)\.includes\(code\)/);
 assert.match(js,/marker\.classList\.toggle\('is-selected',selected\)/);
 assert.match(js,/marker\.setAttribute\('aria-pressed',String\(selected\)\)/);
 assert.match(js,/g\.setAttribute\('role','button'\);g\.setAttribute\('tabindex','0'\)/);
 assert.match(js,/g\.setAttribute\('aria-pressed',String\(selected\)\)/);
 assert.match(js,/circle\.addEventListener\('click',\(\)=>selectPosition\(code\)\)/);
 assert.match(js,/g\.addEventListener\('keydown',event=>/);
 assert.match(js,/event\.key!=='Enter'&&event\.key!==' '/);
 assert.doesNotMatch(js.slice(js.indexOf(' function selectPosition(code)'),js.indexOf(' function renderPitch()')),/renderPitch\(\)/,
  'Do not replace keyboard-focused markers when selecting another role');
 assert.match(css,/\.app-player-detail-pitch-marker\.is-selected circle/);
 assert.match(css,/\.app-player-detail-pitch-marker:focus-visible \.app-player-detail-marker-disc/);
 assert.match(css,/\.app-player-detail-pitch-marker circle\{fill:#FFFFFF;stroke:#143D2A;stroke-width:2\}/);
 assert.match(css,/\.app-player-detail-attributes\{display:flex;flex-direction:column/);
 assert.match(css,/\.app-player-detail-legend\{[^}]*margin-top:auto;padding-top:12px/);
 assert.match(css,/\.app-player-detail-attribute-line dd \.app-skeleton-bar\{[^}]*width:19px;height:16px/);
});

test('Player pitch only the inner disc handles pointer hover and selection; the outer ring remains passive',()=>{
 const js=read('assets/player-detail.js'),css=read('assets/player-detail.css');
 const render=js.slice(js.indexOf(' function renderPitch(){'),js.indexOf(' function renderRoleHighlights(){'));
 assert.match(render,/circle\.addEventListener\('click',\(\)=>selectPosition\(code\)\)/);
 assert.doesNotMatch(render,/g\.addEventListener\('click'/);
 assert.doesNotMatch(render,/ring\.addEventListener\('click'/);
 assert.match(render,/g\.addEventListener\('keydown',event=>/,'keyboard controls remain available on the focused SVG group');
 assert.match(css,/\.app-player-detail-pitch-marker\{pointer-events:none;outline:none\}/);
 assert.match(css,/\.app-player-detail-pitch-marker \.app-player-detail-marker-ring\{pointer-events:none;/);
 assert.match(css,/\.app-player-detail-pitch-marker \.app-player-detail-marker-disc\{pointer-events:all;cursor:pointer\}/);
 assert.doesNotMatch(css,/\.app-player-detail-pitch-marker\{cursor:pointer/);
});

test('#535 header shows position chain, nationality/age and canonical club or Free Agent',()=>{
 const js=read('assets/player-detail.js'),renderer=read('tools/render-player-detail.mjs'),css=read('assets/player-detail.css');
 assert.match(js,/roleNode\.textContent=positionCodes\(\)\.join\(', '\)/);
 assert.match(js,/setContent\(nationalityNode,countryNode\(player\.nationality,true\)\)/);
 assert.match(js,/setContent\(ageNode,Number\.isSafeInteger\(player\.age\)/);
 assert.match(js,/player\.clubKey===null\)\{setContent\(clubNode,'Free Agent'\)/);
 assert.match(js,/import\('\/assets\/match-public-context\.mjs'\)/);
 assert.doesNotMatch(js,/fetch\('\/clubs\/_shared\/manifest\.json'/);
 assert.match(js,/clubCatalog\.clubs\.find\(/);
 assert.match(js,/const crest=verifiedClubCrest\(key,clubCatalog\.clubCrests\)/);
 assert.match(js,/return registry\[key\]===expected\?expected:null/);
 assert.doesNotMatch(js,/clubCatalog\.clubCrests\?\.\[key\]/);
 assert.match(js,/link\.href='\/clubs\/'\+country\.toLowerCase\(\)\+'\/'\+number\+'\/overview'/);
 assert.doesNotMatch(js,/fetch\('\/api\/admin\/contracts'/);
 assert.match(css,/\.app-player-detail-affiliation::before\{[^}]*height:126px;background:var\(--line\)/);
 assert.match(css,/\.app-player-detail-club-crest/);
 assert.match(css,/\.app-player-detail-club-link/);
 for(const file of ['players/_shared/index.html','admin/players/preview/player/index.html']){
  const html=read(file);
  assert.match(html,/data-detail-header-nationality/);
  assert.match(html,/data-detail-header-age/);
  assert.match(html,/data-detail-club/);
  assert.match(html,/app-player-detail-affiliation/);
  assert.match(html,/app-player-detail-club-logo-skeleton/);
  assert.match(html,/app-player-detail-club-name-skeleton/);
  assert.doesNotMatch(html,/data-detail-club-label/);
 }
 assert.match(renderer,/app-player-detail-header-meta/);
});
test('#535 position selection uses a subtle animated ring and reduced-motion support',()=>{
 const js=read('assets/player-detail.js'),css=read('assets/player-detail.css');
 assert.match(js,/ring\.setAttribute\('class','app-player-detail-marker-ring'\)/);
 assert.match(js,/g\.append\(ring,circle,label\)/);
 assert.match(js,/renderRoleHighlights\(\)/);
 assert.match(css,/\.app-player-detail-marker-ring\{[^}]*transition:opacity .2s ease,transform .2s ease/);
 assert.match(css,/\.app-player-detail-pitch-marker\.is-selected \.app-player-detail-marker-ring/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('#509 detail keeps public clubKey read-only and never guesses absent affiliation',()=>{
 const backend=read('backend/src/public-players-read.ts'),js=read('assets/player-detail.js');
 assert.match(backend,/LEFT JOIN player_club_affiliations a ON a\.player_id=p\.id/);
 assert.match(backend,/WHERE p\.id=\?/);
 assert.match(backend,/clubKey=row\.club_key/);
 assert.match(backend,/return \{player:\{\.\.\.projectPublicFootballerDirectoryRecord/);
 assert.match(js,/if\(preview\|\|player\.clubKey===null\)/);
 assert.match(js,/if\(!c\|\|typeof c\.primaryName!=='string'\)\{setContent\(clubNode,'—'\)/);
});

test('#535 follow-up: marker has no native tooltip, club has stacked crest and name with paired skeletons',()=>{
 const js=read('assets/player-detail.js'),css=read('assets/player-detail.css');
 assert.doesNotMatch(js,/document\.createElementNS\(ns,'title'\)/);
 assert.doesNotMatch(js,/g\.append\(title,/);
 assert.match(js,/g\.setAttribute\('aria-label',/);
 assert.match(js,/roleNode\.textContent=positionCodes\(\)\.join\(', '\)/);
 assert.match(js,/img\.width=72;img\.height=72/);
 assert.match(js,/clubCatalogResolved=true/);
 assert.match(js,/renderClubSkeleton\(\)/);
 assert.match(css,/\.app-player-detail-affiliation::before\{[^}]*height:126px/);
 assert.match(css,/\.app-player-detail-club-stack\{display:flex;flex-direction:column/);
 assert.match(css,/\.app-player-detail-club-crest,\.app-player-detail-club-crest-placeholder\{[^}]*width:72px;height:72px/);
 assert.match(css,/\.app-player-detail-club-logo-skeleton\{[^}]*width:72px;height:72px/);
 assert.match(css,/\.app-player-detail-club-name-skeleton\{[^}]*width:120px/);
 for(const file of ['players/_shared/index.html','admin/players/preview/player/index.html']){
  const html=read(file);
  assert.match(html,/app-player-detail-club-logo-skeleton/);
  assert.match(html,/app-player-detail-club-name-skeleton/);
  assert.doesNotMatch(html,/app-player-detail-club-skeleton/);
 }
});
test('#535 natural age text and nationality aligned on same header baseline in five locales',()=>{
 const js=read('assets/player-detail.js'),css=read('assets/player-detail.css');
 assert.match(js,/function localizedAge\(n\)/);
 for(const phrase of ["'anni'","'years'","old","'Jahre'","alt","'años'","'ans'"])
  assert.ok(js.includes(phrase),phrase);
 assert.doesNotMatch(js,/copy\.fields\[2\]\+': '\+player\.age/);
 assert.match(js,/setContent\(ageNode,Number\.isSafeInteger\(player\.age\)\?localizedAge\(player\.age\):'—'\)/);
 assert.match(css,/\.app-player-detail-header-meta\{display:flex;align-items:center;/);
 assert.match(css,/\.app-player-detail-header-meta>\[data-detail-header-nationality\],\.app-player-detail-header-meta>\[data-detail-header-age\]\{display:inline-flex;align-items:center/);
 assert.match(css,/\.app-player-detail-header-meta \.app-player-detail-country,\.app-player-detail-country-skeleton\{display:inline-flex;align-items:center/);
});

test('#535 header nationality has no tooltip and shows a full visible name',()=>{
 const js=read('assets/player-detail.js');
 const start=js.indexOf(' function countryNode(code,header=false){'),end=js.indexOf(' function displayValue(',start);
 assert.ok(start>=0&&end>start);
 const country=js.slice(start,end);
 assert.match(country,/countries\.name==='function'\?countries\.name\(code\):code/);
 assert.match(country,/img\.className='app-player-detail-flag'/);
 assert.match(country,/img\.alt=''/);
 assert.doesNotMatch(country,/app-players-nationality-flag|dataset\.playerCountry|tabIndex|setAttribute\('title'/);
 assert.match(country,/document\.createTextNode\(name\|\|code\)/);
});
test('#535 flag, long nationality, dot and age skeleton share the real header footprint',()=>{
 const js=read('assets/player-detail.js'),renderer=read('tools/render-player-detail.mjs'),css=read('assets/player-detail.css');
 assert.match(js,/nationalitySkeleton\.append\(skeleton\('app-player-detail-flag-skeleton'\),skeleton\('app-player-detail-nationality-skeleton'\)\)/);
 assert.match(js,/ageNode\.replaceChildren\(\)/);
 assert.match(css,/\.app-player-detail-flag-skeleton\{[^}]*width:20px;height:15px/);
 assert.match(css,/\.app-player-detail-flag\{[^}]*width:20px;height:15px;object-fit:contain/);
 assert.match(js,/img\.src='\/assets\/flags\/'\+flag\+'\.svg';img\.width=20;img\.height=15/);
 assert.match(css,/\.app-player-detail-nationality-skeleton\{[^}]*width:116px;height:16px/);
 assert.doesNotMatch(css,/\.app-player-detail-age-skeleton/);
 assert.match(css,/\.app-player-detail-header-meta\{display:flex;align-items:center/);
 assert.match(css,/\.app-player-detail-affiliation::before\{[^}]*height:126px/);
 assert.match(css,/\.app-player-detail-identity\{[^}]*flex:0 1 440px/);
 assert.match(css,/@media\(max-width:620px\)\{\s*\.app-player-detail-heading\{display:grid/);
 assert.match(css,/\.app-player-detail-identity\{grid-column:2;grid-row:1;min-width:0;max-width:none/);
 for(const path of ['players/_shared/index.html','admin/players/preview/player/index.html']){
  const html=read(path);
  const header=html.slice(html.indexOf('class="app-player-detail-header-meta"'),html.indexOf('class="app-player-detail-affiliation"'));
  for(const name of ['app-player-detail-flag-skeleton','app-player-detail-nationality-skeleton','app-player-detail-header-separator','data-detail-header-age hidden'])
   assert.ok(header.includes(name),path+': '+name);
  assert.ok(header.indexOf('app-player-detail-flag-skeleton')<header.indexOf('app-player-detail-nationality-skeleton'));
  assert.ok(header.indexOf('app-player-detail-nationality-skeleton')<header.indexOf('app-player-detail-header-separator'));
  assert.ok(header.indexOf('app-player-detail-header-separator')<header.indexOf('data-detail-header-age hidden'));
 }
 assert.match(renderer,/app-player-detail-country-skeleton/);
});

test('#535 loading shows only flag and nationality skeleton; age and dot appear with loaded player',()=>{
 const js=read('assets/player-detail.js'),css=read('assets/player-detail.css'),
  renderer=read('tools/render-player-detail.mjs');
 assert.match(js,/panel\.querySelector\('\.app-player-detail-header-separator'\)\.hidden=!player;/);
 assert.match(js,/ageNode\.hidden=!player;/);
 assert.match(js,/ageNode\.replaceChildren\(\);/);
 assert.match(js,/setContent\(ageNode,Number\.isSafeInteger\(player\.age\)\?localizedAge\(player\.age\):'—'\)/);
 assert.doesNotMatch(js,/ageNode\.replaceChildren\(skeleton/);
 assert.doesNotMatch(renderer,/app-player-detail-age-skeleton/);
 assert.match(css,/\.app-player-detail-header-meta \[hidden\]\{display:none!important\}/);
 assert.doesNotMatch(css,/\.app-player-detail-age-skeleton/);
 assert.match(css,/\.app-player-detail-affiliation\{[^}]*margin-left:clamp\(130px,15vw,220px\)/);
 assert.match(css,/@media\(max-width:900px\)\{\.app-player-detail-identity\{[^}]*\}\.app-player-detail-affiliation\{[^}]*margin-left:88px/);
 for(const file of ['players/_shared/index.html','admin/players/preview/player/index.html']){
  const html=read(file),start=html.indexOf('class="app-player-detail-header-meta"'),
   end=html.indexOf('class="app-player-detail-affiliation"',start),header=html.slice(start,end);
  assert.match(header,/app-player-detail-flag-skeleton/);
  assert.match(header,/app-player-detail-nationality-skeleton/);
  assert.match(header,/app-player-detail-header-separator" aria-hidden="true" hidden>·<\/span>/);
  assert.match(header,/data-detail-header-age hidden><\/span>/);
  assert.doesNotMatch(header,/app-player-detail-age-skeleton/);
 }
});

test('#535 linked club label only, with passive crest and hover confined to text',()=>{
 const js=read('assets/player-detail.js'),css=read('assets/player-detail.css');
 const start=js.indexOf(' function renderClub(){'),end=js.indexOf(' async function resolveClubCatalog(',start),part=js.slice(start,end);
 assert.match(part,/const stack=document\.createElement\('div'\);stack\.className='app-player-detail-club-stack'/);
 assert.match(part,/img\.width=72;img\.height=72;stack\.append\(img\)/);
 assert.match(part,/stack\.append\(spacer\)/);
 assert.match(part,/name\.className='app-player-detail-club-name'/);
 assert.match(part,/name\.textContent=c\.primaryName;link\.append\(name\);stack\.append\(link\)/);
 assert.match(part,/clubNode\.replaceChildren\(stack\)/);
 assert.doesNotMatch(part,/link\.append\(img\)|link\.append\(spacer\)/);
 assert.match(css,/\.app-player-detail-club-link:hover \.app-player-detail-club-name\{text-decoration:underline/);
 assert.match(css,/\.app-player-detail-club-link:focus-visible\{outline:2px solid var\(--focus\)/);
});
test('#535 right-shift desktop/tablet, no mobile separator and mobile crest/label smaller',()=>{
 const css=read('assets/player-detail.css');
 assert.match(css,/\.app-player-detail-affiliation\{[^}]*margin-left:clamp\(130px,15vw,220px\)/);
 assert.match(css,/@media\(max-width:900px\)\{\.app-player-detail-identity\{[^}]*\}\.app-player-detail-affiliation\{[^}]*margin-left:88px/);
 const mobile=css.slice(css.indexOf('@media(max-width:620px)'),css.indexOf('@media(max-width:460px)'));
 assert.match(mobile,/\.app-player-detail-affiliation::before\{display:none\}/);
 assert.match(mobile,/\.app-player-detail-club-crest,\.app-player-detail-club-crest-placeholder,\.app-player-detail-club-logo-skeleton\{width:48px;height:48px\}/);
 assert.match(mobile,/\.app-player-detail-affiliation-content\{min-height:80px;font-size:13px\}/);
 assert.match(mobile,/\.app-player-detail-club-name-skeleton\{width:92px;height:14px\}/);
 assert.doesNotMatch(mobile,/height:100px/);
});
test('#535 Info panel constrained to 680px on desktop, fluid on smaller screens',()=>{
 const css=read('assets/player-detail.css');
 assert.match(css,/\.app-player-detail-info-view\{margin-top:14px;min-width:0;box-sizing:border-box\}/);
 assert.match(css,/@media\(min-width:901px\)\{\.app-player-detail-info-view\{width:min\(100%,680px\)\}\}/);
 assert.doesNotMatch(css,/@media\(max-width:(?:900|760|620|460)px\)[^\n]*\.app-player-detail-info-view\{/);
});

test('#623 public player portrait and fallback: staged/approved IDs only, stable geometry, protected preview isolation',()=>{
 const js=read('assets/player-detail.js'),css=read('assets/player-detail.css'),renderer=read('tools/render-player-detail.mjs');
 const paths=readdirSync(new URL('../assets/players/portraits/',import.meta.url))
  .filter(name=>/^[1-9][0-9]*\.webp$/.test(name)).map(name=>'assets/players/portraits/'+name);
 assert.ok(paths.length>0,'portrait asset directory cannot be empty');
 // A committed V4.2 QA image is not a target-specific release approval.
 for(const path of paths)assert.equal(isAllowlistedPublicPath(path),false,'Unpinned portrait must not be published: '+path);
 assert.ok(js.includes('player.portraitApproved===true'),
  'only approved V4.2 records can trigger the ID-derived image URL');
 assert.ok(js.includes("'/assets/players/portraits/'+id+'.webp'"));
 assert.ok(js.includes("portraitImage.src=source;"),'approved portrait key is the only displayed image source');
 assert.doesNotMatch(js,/const portraitSources=/,'no per-player JS portrait map');
 for(const path of ['assets/players/portraits/1.png','assets/players/portraits/01.webp','assets/players/portraits/does-not-exist.webp','assets/players/portraits/1.jpg','assets/players/portraits/1.svg'])
  assert.equal(isAllowlistedPublicPath(path),false,path);
 assert.match(js,/!preview&&state==='ready'&&player/);
 assert.match(js,/portraitImage\.onerror=\(\)=>\{/);
 assert.ok(js.includes("portraitImage.hidden=true;portraitFallback.removeAttribute('hidden')"));
 assert.match(js,/portraitImage\.removeAttribute\('src'\)/);
 assert.match(css,/\.app-player-detail-photo\{display:block;object-fit:cover;object-position:center top;/);
 assert.match(css,/\.app-player-detail-photo\[hidden\],\.app-player-detail-silhouette\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.app-player-detail-portrait\{width:190px;height:181px/);
 assert.match(css,/\.app-player-detail-portrait\{width:120px;height:114px/);
 assert.match(renderer,/data-detail-portrait-placeholder/);
 for(const html of [read('players/_shared/index.html'),read('admin/players/preview/player/index.html')]){
  assert.match(html,/data-detail-portrait/);
  assert.match(html,/data-detail-portrait-placeholder/);
  assert.match(html,/data-detail-portrait-photo[^>]*hidden/);
 }
});

test('committed portrait WebPs are structurally valid but not automatically public',()=>{
 const published=new Set(planPublicFiles());
 const root=new URL('../assets/players/portraits/',import.meta.url);
 const names=readdirSync(root).filter(name=>/^[1-9][0-9]*\.webp$/.test(name));
 assert.ok(names.length>0,'portrait asset directory is not empty');
 for(const name of names){
  const path='assets/players/portraits/'+name;
  const data=readFileSync(new URL(name,root));
  assert.equal(data.toString('ascii',0,4),'RIFF',path);
  assert.equal(data.toString('ascii',8,12),'WEBP',path);
  const kind=data.toString('ascii',12,16);
  let width,height,hasAlpha;
  if(kind==='VP8L'){
   assert.equal(data[20],0x2f,'WebP lossless signature '+path);
   width=1+((data[21]|(data[22]<<8))&0x3fff);
   height=1+(((data[22]>>6)|(data[23]<<2)|(data[24]<<10))&0x3fff);
   hasAlpha=(data[24]&0x10)!==0;
  }else if(kind==='VP8X'){
   width=data.readUIntLE(24,3)+1;
   height=data.readUIntLE(27,3)+1;
   hasAlpha=(data[20]&0x10)!==0;
  }else assert.fail('Unexpected WebP chunk '+kind+' for '+path);
  assert.equal(width,320,path+' width');
  assert.equal(height,362,path+' height');
  assert.equal(hasAlpha,true,path+' transparency');
  assert.ok(data.length>0&&data.length<150_000,path+' size budget');
  assert.equal(published.has(path),false,'Unpinned portrait must not publish: '+path);
 }
});

test('#623 plain filled Players silhouette has no internal strokes or portrait frame border',()=>{
 const source=read('players/index.html'),renderer=read('tools/render-player-detail.mjs'),css=read('assets/player-detail.css');
 const from=source.indexOf('<a class="fa-shell-link" href="/players"');
 assert.ok(from>=0,'Players sidebar icon missing');
 const icon=source.slice(from,source.indexOf('</svg>',from)+6);
 const d=icon.split('fill-rule="evenodd" d="')[1]?.split('"/>')[0];
 assert.ok(d,'Players sidebar silhouette path missing');
 const outer=d.split(' M').map((part,i)=>i?'M'+part:part.trim());
 assert.equal(outer.length,4);
 const placeholder=renderer.split("const silhouette='")[1]?.split("';")[0];
 assert.ok(placeholder,'Placeholder missing from renderer');
 assert.equal(placeholder.split('<path d="').length-1,2,'Filled head and torso only');
 assert.ok(placeholder.includes(outer[0]),'Torso must reuse Players icon outer path');
 assert.ok(placeholder.includes(outer[2]),'Head must reuse Players icon outer path');
 assert.ok(placeholder.includes('<path d="'+outer[0]+'" transform="translate(-15.36 0) scale(1.06 1)"/>'),'Torso width must be balanced at 106% and centered');
 assert.ok(placeholder.includes('<path d="'+outer[2]+'"/>'),'Head must remain unchanged and unscaled');
 assert.ok(placeholder.includes('viewBox="-20 -12 552 535"'),'SVG viewport and reserved image frame must be unchanged');
 for(const forbidden of ['stroke=','fill-rule=','opacity='])assert.ok(!placeholder.includes(forbidden),'No internal outlines or holes: '+forbidden);
 assert.ok(placeholder.includes('fill="currentColor"'));
 const frameRule=css.split('.app-player-detail-portrait{')[1]?.split('}')[0];
 assert.ok(frameRule&&frameRule.includes('border:0;'),'Portrait box has no visible border');
 assert.ok(!frameRule.includes('border:1px'),'Old 1px border must be removed');
 for(const html of [read('players/_shared/index.html'),read('admin/players/preview/player/index.html')])
  assert.ok(html.includes(placeholder),'Renderer and generated HTML silhouette must be identical');
});


test('#623 photo load hides inline SVG through the hidden attribute and error re-exposes fallback',()=>{
 const script=read('assets/player-detail.js');
 assert.ok(script.includes("portraitImage.hidden=false;portraitFallback.setAttribute('hidden','')"),'success must set the SVG hidden attribute');
 assert.ok(script.includes("portraitImage.hidden=true;portraitFallback.setAttribute('hidden','')"),'loading reset must hide the SVG');
 assert.equal(script.split("portraitFallback.removeAttribute('hidden')").length-1,2,'missing approved image and image load error reveal the SVG');
 assert.ok(script.includes("if(state==='ready')portraitFallback.removeAttribute('hidden')"),'unmapped players reveal SVG only after player data loads');
 assert.ok(!script.includes('portraitFallback.hidden='),'avoid SVG expando hidden property');
 const css=read('assets/player-detail.css');
 assert.ok(css.includes('.app-player-detail-silhouette[hidden]{display:none!important}'),'CSS must hide the SVG with the actual attribute');
 for(const path of ['players/_shared/index.html','admin/players/preview/player/index.html']){
  const html=read(path);
  assert.ok(html.includes('data-detail-portrait-placeholder'));
  assert.ok(html.includes('data-detail-portrait-photo'));
 }
});


test('#623 portrait reserve stays blank at first paint, until missing image is confirmed',()=>{
 const renderer=read('tools/render-player-detail.mjs'),js=read('assets/player-detail.js');
 const pages=['players/_shared/index.html','admin/players/preview/player/index.html'];
 const placeholder=renderer.split("const silhouette='")[1]?.split("';")[0];
 assert.ok(placeholder,'rendered silhouette missing');
 assert.ok(placeholder.includes('data-detail-portrait-placeholder hidden viewBox='),'first-paint SVG must start hidden');
 assert.ok(renderer.includes('data-detail-portrait-photo width="190" height="181" alt="" decoding="async" hidden'),'photo must start hidden');
 for(const page of pages){
  const markup=read(page);
  assert.ok(markup.includes(placeholder),page+' must match initial hidden state of renderer');
 }
 assert.ok(js.includes("if(!source){"),'fallback is shown only after source resolution');
 assert.ok(js.includes("if(state==='ready')portraitFallback.removeAttribute('hidden')"),'player without approved photo receives fallback after load');
 assert.ok(js.includes("portraitImage.onerror=()=>{"),'failed photo uses fallback');
 assert.ok(js.includes("portraitImage.hidden=true;portraitFallback.removeAttribute('hidden')"),'photo failure must reveal SVG');
 assert.ok(js.includes("portraitImage.hidden=false;portraitFallback.setAttribute('hidden','')"),'successful photo must hide SVG');
 assert.ok(js.includes("portraitImage.hidden=true;portraitFallback.setAttribute('hidden','')"),'reset must hide both photo and SVG');
 assert.ok(!js.includes('portraitFallback.hidden='),'do not use hidden expando on SVG');
});


test('#623 approved portraits use adjustable top-anchored 150% crop in wider, height-stable image slot',()=>{
 const css=read('assets/player-detail.css');
 const photoRule=css.match(/^\.app-player-detail-photo\{([^}]*)\}/m)?.[1];
 const frameRule=css.split('.app-player-detail-portrait{')[1]?.split('}')[0];
 assert.ok(photoRule,'photo rule must exist');
 assert.ok(photoRule.includes('object-fit:cover;object-position:center top'),'photo must remain top aligned');
 assert.ok(photoRule.includes('transform-origin:50% 0'),'scale from the top so the head is not cropped');
 assert.ok(photoRule.includes('scale(var(--app-player-photo-scale,1.50))'),'all approved portraits default to 150% zoom');
 assert.ok(photoRule.includes('var(--app-player-photo-offset-x,0px)'),'future horizontal alignment can be tuned per player');
 assert.ok(photoRule.includes('var(--app-player-photo-offset-y,0px)'),'future vertical alignment can be tuned per player');
 assert.ok(frameRule.includes('width:190px;height:181px'),'desktop portrait expands horizontally while retaining height');
 assert.ok(frameRule.includes('overflow:hidden'),'the crop is clipped inside the portrait');
 assert.ok(frameRule.includes('border:0'),'the borderless portrait remains unchanged');
 assert.ok(css.includes('.app-player-detail-portrait{width:120px;height:114px;flex-basis:120px;grid-column:1;grid-row:1}'),'mobile portrait expands horizontally while retaining height');
 assert.ok(!css.includes('.app-player-detail-silhouette{transform:'),'fallback SVG must never be photo-zoomed');
});

test('#623 wider portrait frame preserves mobile grid identity, affiliation and back-link alignment',()=>{
 const css=read('assets/player-detail.css');
 const renderer=read('tools/render-player-detail.mjs');
 const frame=css.split('.app-player-detail-portrait{')[1]?.split('}')[0];
 assert.ok(frame?.includes('width:190px;height:181px;flex:0 0 190px'),'desktop portrait reserves 190px width');
 assert.ok(frame?.includes('overflow:hidden;border-radius:'),'larger image remains clipped to its box');
 assert.ok(frame?.includes('border:0'),'portrait still has no box border');
 const mobile=css.split('@media(max-width:620px){')[1]?.split('@media(max-width:460px)')[0];
 assert.ok(mobile?.includes('.app-player-detail-portrait{width:120px;height:114px;flex-basis:120px;grid-column:1;grid-row:1}'),'mobile portrait reserves 120px width');
 assert.ok(mobile?.includes('.app-player-detail-affiliation{grid-column:1/-1;grid-row:2;min-width:0;width:100%;max-width:none;min-height:80px;margin-left:0'),'club panel uses a full mobile grid row');
 assert.ok(mobile?.includes('.app-player-detail-back{grid-column:2;grid-row:3;margin-left:0'),'preview back link follows the mobile grid');
 assert.ok(renderer.includes('data-detail-portrait-placeholder hidden viewBox="-20 -12 552 535" preserveAspectRatio="xMidYMax meet" width="190" height="181"'),'SVG intrinsic geometry follows desktop frame');
 assert.ok(renderer.includes('data-detail-portrait-photo width="190" height="181"'),'photo intrinsic dimensions follow desktop frame');
 for(const path of ['players/_shared/index.html','admin/players/preview/player/index.html']){
  const html=read(path);
  assert.ok(html.includes('data-detail-portrait-photo width="190" height="181"'),path+' image size');
  assert.ok(html.includes('data-detail-portrait-placeholder hidden viewBox="-20 -12 552 535" preserveAspectRatio="xMidYMax meet" width="190" height="181"'),path+' fallback size');
 }
});

test('#623 wide placeholder maintains head/body proportions on desktop and mobile',()=>{
 const renderer=read('tools/render-player-detail.mjs');
 const portrait=renderer.split("const silhouette='")[1]?.split("';")[0];
 assert.ok(portrait,'canonical placeholder source exists');
 assert.ok(portrait.includes('preserveAspectRatio="xMidYMax meet"'),'head and torso must preserve source proportions at every width');
 assert.ok(!portrait.includes('preserveAspectRatio="none"'),'must not stretch the head horizontally');
 assert.ok(portrait.includes('transform="translate(-15.36 0) scale(1.06 1)"'),'torso shoulders widen 6%, centered in the image');
 assert.ok(!portrait.includes('scale(1.12 1)'),'old overly wide shoulders must be absent');
 assert.equal((portrait.match(/<path d="/g)||[]).length,2,'solid two-part silhouette remains');
 assert.ok(!portrait.includes('stroke='),'no outline or internal details');
 for(const path of ['players/_shared/index.html','admin/players/preview/player/index.html']){
  const html=read(path);
  assert.ok(html.includes(portrait),path+' matches canonical proportional SVG');
 }
 const css=read('assets/player-detail.css');
 assert.ok(css.includes('.app-player-detail-portrait{width:190px;height:181px;flex:0 0 190px;'),'desktop frame unchanged');
 assert.ok(css.includes('.app-player-detail-portrait{width:120px;height:114px;flex-basis:120px;grid-column:1;grid-row:1}'),'mobile frame unchanged');
});

test('#634 canonical nationality is compact only in the mobile header and remains accessible',()=>{
 const js=read('assets/player-detail.js'),css=read('assets/player-detail.css');
 const start=js.indexOf(' function countryNode(code,header=false){'),end=js.indexOf(' function displayValue(',start);
 assert.ok(start>=0&&end>start);
 const fakeDocument={
  createElement(tag){return {tag,children:[],attributes:{},append(...parts){this.children.push(...parts)},setAttribute(k,v){this.attributes[k]=v}};},
  createTextNode(text){return {text}}
 };
 for(const lang of ['en','de','es','fr','it']){
  const localized={ITA:lang==='it'?'Italia':'Italy',ENG:lang==='it'?'Inghilterra':'England',ESP:lang==='es'?'España':'Spain',GER:lang==='de'?'Deutschland':'Germany'};
  const flags={ITA:'it',ENG:'gb-eng',ESP:'es',GER:'de'};
  const make=runInNewContext(js.slice(start,end)+'\ncountryNode',{document:fakeDocument,window:{faPlayersNationality:{flags,name:code=>localized[code]||code}}});
  for(const code of ['ITA','ENG','ESP','GER']){
   const country=make(code,true);
   const full=country.children.find(x=>x.className==='app-player-detail-nationality-full');
   const compact=country.children.find(x=>x.className==='app-player-detail-nationality-compact');
   const accessible=country.children.find(x=>x.className?.includes('app-player-detail-nationality-accessible'));
   assert.equal(compact.textContent,code,lang+' '+code);
   assert.equal(compact.attributes['aria-hidden'],'true');
   assert.equal(full.textContent,localized[code]);
   assert.equal(accessible.textContent,localized[code]);
   assert.equal(country.children[0].alt,'');
   assert.equal(make(code,false).children.some(x=>x.className==='app-player-detail-nationality-compact'),false,'Info keeps full name');
  }
 }
 assert.match(js,/setContent\(nationalityNode,countryNode\(player\.nationality,true\)\)/);
 assert.match(js,/if\(key==='nationality'\|\|key==='secondary_nationality'\)return countryNode\(player\[key\]\)/);
 assert.match(css,/\.app-player-detail-nationality-compact,\.app-player-detail-nationality-accessible\{display:none\}/);
 assert.match(css,/@media\(max-width:620px\)[\s\S]*?\.app-player-detail-nationality-full\{display:none\}/);
 assert.match(css,/\.app-player-detail-nationality-compact,\.app-player-detail-nationality-accessible\{display:inline\}/);
});

test('#634 mobile header grid reserves portrait and prevents nationality wrapping',()=>{
 const css=read('assets/player-detail.css'),renderer=read('tools/render-player-detail.mjs');
 const mobile=css.slice(css.indexOf('/* #634:'),css.indexOf('@media(max-width:460px)'));
 assert.match(mobile,/grid-template-columns:120px minmax\(0,1fr\)/);
 assert.match(mobile,/\.app-player-detail-portrait\{width:120px;height:114px/);
 assert.match(mobile,/\.app-player-detail-identity\{grid-column:2;grid-row:1;min-width:0/);
 assert.match(mobile,/\.app-player-detail-affiliation\{grid-column:1\/-1;grid-row:2;[^}]*margin-left:0/);
 assert.match(mobile,/\.app-player-detail-header-meta\{[^}]*flex-wrap:nowrap;gap:6px;white-space:nowrap/);
 assert.match(mobile,/\.app-player-detail-nationality-skeleton\{width:30px\}/);
 assert.match(mobile,/\.app-player-detail-back\{grid-column:2;grid-row:3;margin-left:0/);
 const appCss=read('assets/app.css');
 assert.match(appCss,/@media\(max-width:390px\)\{\s*\.fa-career-shell\{grid-template-columns:52px minmax\(0,1fr\)/);
 assert.match(appCss,/--app-page-pad-inline:16px/);
 assert.match(css,/@media\(max-width:390px\)\{\s*\.app-player-detail-heading\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.app-player-detail-identity\{grid-column:1;grid-row:2;align-items:center;text-align:center;width:100%\}/);
 for(const width of [320,375,390,430,620]){
  const sidebar=width<=390?52:58,contentWidth=width-sidebar-32;
  const identityWidth=width<=390?contentWidth:contentWidth-120-15;
  assert.ok(identityWidth>=205,'mobile identity cannot overflow fixed portrait/sidebar: '+width);
 }
 assert.match(css,/\.app-player-detail-heading\{display:flex;align-items:center;gap:18px/,'desktop baseline unchanged');
 for(const html of [read('players/_shared/index.html'),read('admin/players/preview/player/index.html')]){
  assert.match(html,/app-player-detail-country-skeleton/);
  assert.match(html,/app-player-detail-club-loading/);
 }
 assert.match(renderer,/data-detail-header-nationality/);
});

test('#578 verified Player Stats score position is set before any table fetch',()=>{
 const js=read('assets/player-detail.js'),html=read('players/_shared/index.html');
 assert.match(js,/function syncStatsScoreLabel\(\)\{/);
 assert.match(js,/player\.primary_position==='GK'\?'CS'/);
 assert.ok(js.indexOf('syncStatsScoreLabel();')<js.indexOf("if(view==='stats')void ensurePlayerStats()"));
 assert.doesNotMatch(html,/data-detail-stats-heading="5">Gls<\/th>/);
 assert.match(html,/data-detail-stats-heading="5" aria-label="Goals or clean sheets"/);
});

test('#763 public header groups the club and market value into separate equal-width blocks',()=>{
 const html=read('players/_shared/index.html'),preview=read('admin/players/preview/player/index.html');
 const css=read('assets/player-detail.css'),js=read('assets/player-detail.js');
 const header=html.slice(html.indexOf('<header class="app-player-detail-heading">'),html.indexOf('</header>',html.indexOf('<header class="app-player-detail-heading">')));
 const identity=header.indexOf('data-detail-subtitle'),panels=header.indexOf('class="app-player-detail-header-panels"'),club=header.indexOf('class="app-player-detail-affiliation"'),value=header.indexOf('class="app-player-detail-market-value"');
 assert.ok(identity>=0&&identity<panels&&panels<club&&club<value);
 assert.equal((header.match(/data-detail-market-value/g)||[]).length,1);
 assert.match(header,/data-detail-market-value><span class="app-skeleton-bar app-player-detail-market-skeleton" aria-hidden="true"><\/span>/);
 assert.doesNotMatch(preview,/app-player-detail-header-panels|data-detail-market-value/);
 assert.match(css,/\.app-player-detail-header-panels\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.app-player-detail-market-value::before\{[^}]*height:126px;background:var\(--line\)/);
 assert.match(css,/\.app-player-detail-market-value::before\{height:64px\}/);
 assert.match(css,/\.app-player-detail-header-panels\{grid-column:1;grid-row:3\}/);
 assert.match(js,/marketValue\.replaceChildren\(skeleton\('app-player-detail-market-skeleton'\)\)/);
 assert.equal(renderPlayerDetailPage(read('players/index.html'),'public'),html);
});
