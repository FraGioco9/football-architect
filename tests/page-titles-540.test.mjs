import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {renderPlayerDetailPage} from '../tools/render-player-detail.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pageTitle=path=>read(path).match(/<title>([^<]+)<\/title>/)?.[1];

test('#540 public and protected player shells have safe, accessible first-paint titles',()=>{
 for(const [source,output,mode,fallback] of [
  ['players/index.html','players/_shared/index.html','public','Player'],
  ['admin/players/preview/index.html','admin/players/preview/player/index.html','preview','Player preview']
 ]){
  const html=read(output);
  assert.equal(html,renderPlayerDetailPage(read(source),mode),'generated page drift: '+output);
  assert.equal(pageTitle(output),fallback+' — Football Architect');
  assert.ok(html.includes('<span class="sr-only" data-detail-heading-fallback>'+fallback+'</span>'));
  assert.ok(html.includes('app-player-detail-name-skeleton'),'first paint must keep title geometry');
  assert.ok(html.includes('aria-labelledby="player-detail-title"'),'active landmark needs page name');
 }
 const js=read('assets/player-detail.js');
 assert.match(js,/headingFallback\.hidden=state!=='loading'/);
 assert.match(js,/document\.title=\(preview\?copy\.previewTitle:/);
 assert.match(js,/state==='not-found'\?copy\.notFound/);
 assert.match(js,/const candidate=player&&/);
 assert.match(js,/if\(typeof value!=='string'\)return ''/);
 assert.doesNotMatch(js,/document\.title=.*e\.views/,'tab labels must not enter browser title');
 const shell=read('assets/app.js');
 assert.ok(shell.includes('!document.querySelector?.("[data-player-detail-mode]")'),'app shell must not overwrite player detail title');
});

test('#540 fallback copies cover five languages without draft candidate names in document title',()=>{
 const source=read('assets/player-detail.js');
 for(const label of ['Player preview','Anteprima giocatore','Spielervorschau','Vista previa del jugador','Aperçu du joueur'])
  assert.ok(source.includes("previewTitle:'"+label+"'"),label);
 const preview=read('admin/players/preview/index.html');
 assert.equal(pageTitle('admin/players/preview/index.html'),'Player preview — Football Architect');
 assert.match(preview,/<h1 id="admin-title" class="app-page-title">Player preview<\/h1>/);
 assert.match(read('assets/admin-players-preview.js'),/document\.title=c\.title\+' — Football Architect'/);
 assert.doesNotMatch(read('admin/players/preview/player/index.html'),/<title>Admin — Player/);
});

test('#540 club first paint is neutral and populated club title has no view suffix',()=>{
 const shell=read('clubs/_shared/index.html');
 assert.equal(pageTitle('clubs/_shared/index.html'),'Club — Football Architect');
 assert.match(shell,/data-club-title-fallback>Club<\/span>/);
 assert.match(shell,/club-fp-header-name/,'keep reserved skeleton');
 assert.match(shell,/const fallback=\{en:'Club',de:'Verein',es:'Club',fr:'Club',it:'Club'\}/);
 const runtime=read('assets/club-page.js');
 assert.match(runtime,/document\.title=\(titleName&&/);
 assert.doesNotMatch(runtime,/document\.title=.*model\.copies\[language\(\)\]\[selected\.view\]/);
});

test('#540 existing simple page titles and JavaScript parse are preserved',()=>{
 for(const [path,title] of [
  ['dashboard/index.html','Dashboard — Football Architect'],
  ['calendar/index.html','Calendar — Football Architect'],
  ['settings/index.html','Settings — Football Architect'],
  ['players/index.html','Players — Football Architect'],
  ['admin/calendar/index.html','Admin Calendar — Football Architect'],
  ['admin/players/index.html','Admin Players — Football Architect'],
  ['admin/contracts/index.html','Admin Contracts — Football Architect'],
  ['match-engine/lab/index.html','Match Engine — Football Architect']
 ])assert.equal(pageTitle(path),title,path);
 for(const path of ['assets/app.js','assets/player-detail.js','assets/club-page.js','assets/admin-players-preview.js'])
  assert.doesNotThrow(()=>new Script(read(path),{filename:path}),path);
});
