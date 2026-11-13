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
  assert.match(html,/data-detail-positions aria-labelledby="player-detail-positions-title"/);
  assert.match(html,/<h2 id="player-detail-positions-title" data-detail-section-title="positions">Positions<\/h2>/);
  assert.match(html,/data-detail-status role="status" aria-live="polite" hidden/);
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
 assert.match(directory,/link\.href='\/players\/'\+player\.id\+'\?view=overview'/);
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
 assert.match(js,/url\.searchParams\.set\('view',next\)/);
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
 assert.match(js,/g\.addEventListener\('click',\(\)=>selectPosition\(code\)\)/);
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

test('#535 header shows position chain, nationality/age and canonical club or Free Agent',()=>{
 const js=read('assets/player-detail.js'),renderer=read('tools/render-player-detail.mjs'),css=read('assets/player-detail.css');
 assert.match(js,/roleNode\.textContent=positionCodes\(\)\.join\(', '\)/);
 assert.match(js,/setContent\(nationalityNode,countryNode\(player\.nationality\)\)/);
 assert.match(js,/setContent\(ageNode,Number\.isSafeInteger\(player\.age\)/);
 assert.match(js,/player\.clubKey===null\)\{setContent\(clubNode,'Free Agent'\)/);
 assert.match(js,/fetch\('\/clubs\/_shared\/manifest\.json'/);
 assert.match(js,/clubCatalog\.clubs\.find\(/);
 assert.match(js,/clubCatalog\.clubCrests\?\.\[key\]/);
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
 assert.match(css,/\.app-player-detail-club-link\{display:flex;flex-direction:column/);
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
 const start=js.indexOf(' function countryNode(code){'),end=js.indexOf(' function displayValue(',start);
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
 assert.match(css,/\.app-player-detail-flag-skeleton\{[^}]*width:24px;height:18px/);
 assert.match(css,/\.app-player-detail-nationality-skeleton\{[^}]*width:116px;height:16px/);
 assert.doesNotMatch(css,/\.app-player-detail-age-skeleton/);
 assert.match(css,/\.app-player-detail-header-meta\{display:flex;align-items:center/);
 assert.match(css,/\.app-player-detail-affiliation::before\{[^}]*height:126px/);
 assert.match(css,/\.app-player-detail-identity\{[^}]*flex:0 1 440px/);
 assert.match(css,/@media\(max-width:620px\)\{\.app-player-detail-affiliation\{[^}]*\}/);
 assert.match(css,/\.app-player-detail-identity\{flex:1 1 0;max-width:none\}/);
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
 assert.match(css,/\.app-player-detail-affiliation\{[^}]*margin-left:18px/);
 assert.match(css,/@media\(max-width:900px\)\{\.app-player-detail-identity\{[^}]*\}\.app-player-detail-affiliation\{[^}]*margin-left:12px/);
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
