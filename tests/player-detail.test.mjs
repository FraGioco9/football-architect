import test from 'node:test';
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
  assert.equal((html.match(/data-detail-value="/g)||[]).length,6);
  assert.equal((html.match(/data-detail-attr-slot="/g)||[]).length,8);
  assert.doesNotMatch(html,/data-players-filter-open|data-admin-players-confirmation/);
  if(mode==='preview'){
   assert.match(html,/name="robots" content="noindex,nofollow"/);
   assert.match(html,/meta name="referrer" content="no-referrer"/);
   assert.match(html,/data-player-detail-mode="preview" hidden/);
  }
 }
});

test('#502 names alone become links; uncommitted candidates cannot get permanent IDs',()=>{
 const directory=read('assets/players-directory.js'),preview=read('assets/admin-players-preview.js');
 const script=read('assets/player-detail.js'),index=read('backend/src/index.ts');
 const publicApi=read('backend/src/public-players-read.ts');
 assert.match(directory,/link\.href='\/players\/'\+player\.id/);
 assert.match(directory,/link\.className='app-link app-player-name-link'/);
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
 for(const field of ['returnView','returnGroup','returnPage','returnScroll'])
  assert.ok(script.includes(field)&&preview.includes(field),field);
 assert.match(script,/const permitted=\['first_name'/);
 assert.match(script,/projected\.attributes=Object\.fromEntries/);
 assert.match(script,/draftPattern\.test/);
 assert.match(script,/cache:'no-store'/);
 assert.match(script,/history\.pushState/);
 assert.match(script,/addEventListener\('popstate'/);
 assert.match(script,/addEventListener\('pageshow'/);
 assert.doesNotMatch(script,/\/api\/admin\/players\/commit|\/api\/admin\/players\/preview/);
});
