import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRoute,buildRoute} from '../assets/routes-registry.mjs';
import {publicRequestFile,isAllowlistedPublicPath,planPublicFiles} from '../tools/publication-guard.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Preview is a canonical Admin subpage and a protected, generated public-shell artifact',async()=>{
 const route='/admin/players/preview';
 assert.equal(parseRoute(route)?.canonical,route);
 assert.equal(buildRoute({kind:'page',id:'admin/players/preview'}),route);
 assert.equal(publicRequestFile(route),'admin/players/preview/index.html');
 assert.ok(isAllowlistedPublicPath('admin/players/preview/index.html'));
 assert.ok(planPublicFiles().includes('admin/players/preview/index.html'));
 const {renderAdminPlayersPreview}=await import('../tools/render-admin-settings.mjs');
 const html=read('admin/players/preview/index.html');
 assert.ok(html.includes(renderAdminPlayersPreview()));
 assert.match(html,/meta name="referrer" content="no-referrer"/);
 assert.match(html,/src="\/assets\/admin-players-preview.js" defer/);
 assert.match(html,/src="\/assets\/players-nationality-tooltip.js" defer/);
 assert.doesNotMatch(html,/data-admin-players-form/);
 assert.match(html,/data-admin-players-preview-page[^>]*hidden/);
 assert.equal((html.match(/class="app-players-loading-row"/g)||[]).length,5);
});
test('Generator navigates to protected preview without browser persistence or fake player detail links',()=>{
 const generator=read('assets/admin-players.js');
 const preview=read('assets/admin-players-preview.js');
 const backend=read('backend/src/players-generation-command.ts');
 const html=read('admin/players/preview/index.html');
 assert.match(generator,/location.assign\('\/admin\/players\/preview\?draftId='/);
 assert.ok(preview.includes("authorizedPost('/api/admin/players/draft',{draftId:id})"));
 assert.match(preview,/\/api\/admin\/players\/commit/);
 assert.match(preview,/\/api\/admin\/players\/preview/);
 assert.match(preview,/new MutationObserver\(render\)/);
 assert.doesNotMatch(preview,/localStorage|sessionStorage|innerHTML|\/players\/\$\{|\/players\/\+|window\.open/);
 assert.doesNotMatch(html,/<a[^>]+href="\/players\//);
 assert.match(backend,/readPlayerGenerationDraft/);
 assert.match(backend,/WHERE id=\? AND account_id=\?/);
 assert.match(backend,/status!=='preview'/);
 assert.match(backend,/expires_at<=now/);
});
test('Both Players tables use the same nationality tooltip component and styles',()=>{
 const publicPage=read('players/index.html');
 const previewPage=read('admin/players/preview/index.html');
 const dir=read('assets/players-directory.js');
 const preview=read('assets/admin-players-preview.js');
 const tooltip=read('assets/players-nationality-tooltip.js');
 for(const html of [publicPage,previewPage])assert.match(html,/src="\/assets\/players-nationality-tooltip.js" defer/);
 for(const code of [dir,preview])assert.match(code,/dataset\.playerCountry/);
 assert.match(tooltip,/Intl\.DisplayNames/);
 assert.match(tooltip,/setAttribute\('role','tooltip'\)/);
 assert.match(tooltip,/focusin/);
 assert.match(read('assets/app.css'),/\.app-players-nationality-tooltip\{/);
 assert.equal(isAllowlistedPublicPath('assets/players-nationality-tooltip.js'),true);
 assert.equal(isAllowlistedPublicPath('assets/admin-players-preview.js'),true);
});

test('Dedicated preview has the same bare Players table and just three page actions',async()=>{
 const html=read('admin/players/preview/index.html');
 const publicHtml=read('players/index.html');
 const {renderAdminPlayersPreview}=await import('../tools/render-admin-settings.mjs');
 const preview=renderAdminPlayersPreview();
 assert.ok(html.includes(preview));
 for(const selector of ['app-players-header','app-page-title','app-competition-tabs app-players-tabs','app-players-toolbar','app-players-groups','app-players-count','app-players-table-scroll','app-players-table','app-players-pagination','app-players-nationality-flag']){
  if(selector==='app-players-nationality-flag')continue; // Flag is rendered from the common JS renderer.
  assert.ok(preview.includes(selector),selector);
  assert.ok(publicHtml.includes(selector),selector+' must be shared with /players');
 }
 for(const action of ['data-admin-players-commit','data-admin-preview-regenerate','data-admin-preview-back'])assert.ok(preview.includes(action),action);
 assert.doesNotMatch(preview,/app-panel|app-settings-panel|admin-settings|admin-players-preview-summary|admin-players-approval|admin-page-heading|data-admin-back/);
 assert.match(preview,/<dialog[^>]*data-admin-preview-confirm-dialog/);
 assert.equal((preview.match(/class="app-players-loading-row"/g)||[]).length,5);
 assert.ok(preview.includes('app-competition-tab app-players-group'), 'Attribute groups use the identical public tab classes');
 assert.doesNotMatch(html,/class="admin-page-heading"/, 'No duplicated Admin back header');
});
