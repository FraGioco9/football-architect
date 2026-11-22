import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {request} from 'node:http';
import {once} from 'node:events';
import {createPreviewStandings,createPreviewWorldHistory} from '../tools/dev-standings-preview-data.mjs';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
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
 assert.match(publicRuntime,/debugIntro/);
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
