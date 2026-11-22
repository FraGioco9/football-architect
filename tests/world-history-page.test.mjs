import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
