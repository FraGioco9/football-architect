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
