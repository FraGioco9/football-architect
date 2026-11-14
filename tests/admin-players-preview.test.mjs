import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
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
 assert.match(html,/src="\/assets\/admin-permissions-cache.js" defer/);
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
 assert.match(preview,/permissionCache\?\.read\(\)/);
 assert.match(preview,/permissionCache\?\.write\(p\)/);
 assert.match(preview,/permissionCache\?\.clear\(\)/);
 assert.match(preview,/\/api\/admin\/players\/commit/);
 assert.match(preview,/\/api\/admin\/players\/preview/);
 assert.match(preview,/new MutationObserver\(render\)/);
 assert.doesNotMatch(preview,/localStorage|sessionStorage|innerHTML|\/players\/\$\{|\/players\/\+|window\.open/);
 assert.doesNotMatch(html,/<a[^>]+href="\/players\//);
 assert.match(backend,/readPlayerGenerationDraft/);
 assert.match(backend,/WHERE id=\? AND account_id=\?/);
 assert.match(backend,/draft.status!=='preview'&&draft.status!=='committed'/);
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
  assert.ok((selector==='app-players-pagination'?read('assets/players-directory.js'):publicHtml).includes(selector),selector+' must be shared with /players');
 }
 for(const action of ['data-admin-players-commit','data-admin-preview-regenerate','data-admin-preview-back'])assert.ok(preview.includes(action),action);
 assert.doesNotMatch(preview,/app-panel|app-settings-panel|admin-settings|admin-players-preview-summary|admin-players-approval|admin-page-heading|data-admin-back/);
 assert.match(preview,/<dialog[^>]*data-admin-preview-confirm-dialog/);
 assert.equal((preview.match(/class="app-players-loading-row"/g)||[]).length,5);
 assert.ok(preview.includes('app-competition-tab app-players-group'), 'Attribute groups use the identical public tab classes');
 assert.doesNotMatch(html,/class="admin-page-heading"/, 'No duplicated Admin back header');
});

test('Preview status is inline with the three actions, and the shared Players pager is symmetric',async()=>{
 const {renderAdminPlayersPreview}=await import('../tools/render-admin-settings.mjs');
 const html=renderAdminPlayersPreview(),css=read('assets/app.css');
 const actions=html.slice(html.indexOf('class="app-players-preview-actions"'),html.indexOf('</div>',html.indexOf('class="app-players-preview-actions"')));
 for(const selector of ['data-admin-players-feedback','data-admin-players-commit-status','data-admin-players-commit','data-admin-preview-regenerate','data-admin-preview-back'])assert.ok(actions.includes(selector),selector+' lives inside the actions row');
 assert.equal((actions.match(/class="app-players-filter-trigger"/g)||[]).length,3);
 assert.match(css,/\.app-players-page-button\{[^}]*flex:0 0 112px;[^}]*width:112px;[^}]*min-width:112px;[^}]*max-width:112px/);
 assert.match(css,/@media\(max-width:420px\)\{\.app-players-pagination\{[^}]*\}\.app-players-page-button\{[^}]*width:88px;[^}]*min-width:88px;[^}]*max-width:88px/);
 assert.match(read('assets/players-directory.js'),/loadMore.className='app-players-page-button'/,'public directory uses Load more; Admin remains on Previous/Next');
 assert.match(html,/data-admin-preview-prev[^>]*>Previous<\/button>/);
 assert.match(html,/data-admin-preview-next[^>]*>Next<\/button>/);
});
test('Shared nationality tooltip prefers above and respects site animation and reduced motion',()=>{
 const script=read('assets/players-nationality-tooltip.js'),css=read('assets/app.css');
 assert.match(script,/const placeAbove=above>=8/);
 assert.match(script,/tip\.dataset\.placement=placeAbove\?'above'/);
 assert.match(script,/tip\.classList\.add\('is-closing'\)/);
 assert.match(script,/tip\.classList\.remove\('is-closing'\)/);
 assert.match(css,/\.app-players-nationality-tooltip\{[^}]*animation:app-world-tooltip-in 170ms ease-out both/);
 assert.match(css,/\.app-players-nationality-tooltip\.is-closing\{animation:app-world-tooltip-out 130ms ease-in both/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.app-players-nationality-tooltip,\.app-players-nationality-tooltip\.is-closing\{animation:none!important\}/);
});

test('Preview Back restores only normalized generator options through transient history, not candidates',()=>{
 const generator=read('assets/admin-players.js'),preview=read('assets/admin-players-preview.js');
 assert.match(preview,/history\.replaceState\(\{faAdminGeneratorOptions:draft\.options\}/);
 assert.match(generator,/win\.history\.replaceState\(\{faAdminGeneratorOptions:selected\}/);
 assert.match(preview,/history\.back\(\)/);
 assert.doesNotMatch(preview,/history\.replaceState\(\{[^}]*candidates/);
 assert.match(preview,/location\.reload\(\)/);
 assert.match(generator,/win\.history\.state\?\.faAdminGeneratorOptions/);
 assert.match(generator,/win\.history\.replaceState\(null/);
 assert.match(generator,/if\(key==='attributes'/);
 assert.doesNotMatch(generator,/nextSeed/);
 assert.doesNotMatch(preview,/back\.href='\/admin\/players\?nextSeed='/);
 assert.match(preview,/saved=info\.status==='committed'/);
 assert.match(preview,/if\(\/\^fa-auto-/);
});

test('Returning from an automatic preview does not pin the one-time auto seed',()=>{
 const generator=read('assets/admin-players.js');
 assert.match(generator,/if\(key==='seed'&&typeof value==='string'&&\/\^fa-auto-/);
 assert.match(generator,/\)continue;\s+if\(key==='attributes'/);
});

test('Generator Primary suitability min/max inputs reuse the existing inclusive API contract',()=>{
 const require=createRequire(import.meta.url);
 const {makeOptions}=require('../assets/admin-players.js');
 assert.deepEqual(makeOptions({}),{});
 assert.deepEqual(makeOptions({primarySuitabilityMin:'65',primarySuitabilityMax:'80'}),{primarySuitability:[65,80]});
 assert.deepEqual(makeOptions({primarySuitabilityMin:'70'}),{primarySuitability:[70,90]});
 assert.deepEqual(makeOptions({primarySuitabilityMax:'80'}),{primarySuitability:[1,80]});
 assert.deepEqual(makeOptions({primarySuitabilityMin:'75',primarySuitabilityMax:'75'}),{primarySuitability:75});
 assert.deepEqual(makeOptions({primarySuitabilityMin:'1',primarySuitabilityMax:'90'}),{primarySuitability:[1,90]});
 for(const raw of [
  {primarySuitabilityMin:'0'},{primarySuitabilityMax:'91'},
  {primarySuitabilityMin:'80',primarySuitabilityMax:'70'},
  {primarySuitabilityMin:'50:70'},
  {primarySuitabilityMax:'abc'},{primarySuitabilityMin:'70.5'}
 ])assert.throws(()=>makeOptions(raw));
 const source=read('assets/admin-players.js');
 assert.match(source,/key==='primarySuitability'/);
 assert.match(source,/set\('primarySuitabilityMin',value\[0\]\);set\('primarySuitabilityMax',value\[1\]\)/);
});

test('Committed drafts remain inspectable while automatic seeds stay unpinned',()=>{
 const preview=read('assets/admin-players-preview.js');
 const detail=read('assets/player-detail.js');
 const backend=read('backend/src/players-generation-command.ts');
 assert.match(backend,/const candidates(?::Data\[\])?=stored\.map\(\(player,index\)=>\(\{\.\.\.player,preview_id:'trial-'/);
 assert.match(backend,/status:draft\.status/);
 assert.match(preview,/saved=info\.status==='committed'/);
 assert.doesNotMatch(preview,/options\.seed='fa-next-'/);
 assert.match(detail,/previewCommitted=draft\.status==='committed'/);
 assert.match(detail,/p\.preview_id!==undefined/);
});
