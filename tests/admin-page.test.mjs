import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {publicRequestFile,isAllowlistedPublicPath,planPublicFiles} from '../tools/publication-guard.mjs';
import {parseRoute,buildRoute} from '../assets/routes-registry.mjs';
const require=createRequire(import.meta.url);
const navigation=require('../assets/profile-navigation.js');

test('Admin is a canonical published standalone page',()=>{
 assert.equal(parseRoute('/admin')?.kind,'page');
 assert.equal(buildRoute({kind:'page',id:'admin'}),'/admin');
 assert.equal(publicRequestFile('/admin'),'admin/index.html');
 assert.equal(isAllowlistedPublicPath('admin/index.html'),true);
 assert.ok(planPublicFiles().includes('admin/index.html'));
});
test('Settings no longer embeds or loads administration even with a legacy query',()=>{
 const html=readFileSync(new URL('../settings/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/data-settings-admin|data-admin-settings|admin-settings\.(?:js|css)|dataset\.settingsView/);
});
test('Admin navigation requires verified access and world-read permissions',()=>{
 assert.equal(typeof navigation.canAccessAdmin,'function');
 for(const permissions of [null,{},[],['admin.access'],['admin.world.read'],'admin.access admin.world.read'])assert.equal(navigation.canAccessAdmin(permissions),false);
 assert.equal(navigation.canAccessAdmin(['admin.access','admin.world.read']),true);
 assert.equal(navigation.canAccessAdmin(['admin.access','admin.world.read','admin.world.write']),true);
});

test('Admin content is hidden in the initial HTML before any access check resolves',()=>{
 const html=readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');
 assert.match(html,/<section\b[^>]*id="app-admin"[^>]*\bhidden(?:\s|>)/);
 const css=readFileSync(new URL('../assets/admin-settings.css',import.meta.url),'utf8');
 assert.match(css,/\.app-admin-view\[hidden\]\s*\{\s*display:none/);
});

test('Admin removes Details and retains inline protected reset with a next-day preview',async()=>{
 const {renderAdminSettings}=await import('../tools/render-admin-settings.mjs');
 const html=renderAdminSettings();
 assert.doesNotMatch(html,/data-admin-details|data-admin-world-details|data-admin-reschedule-section/);
 assert.match(html,/<section\b[^>]*data-admin-reset-section[^>]*>/);
 assert.doesNotMatch(html,/<details\b/);
 assert.match(html,/class="admin-summary-actions"[^]*?data-admin-working/);
 assert.doesNotMatch(html,/data-admin-copy="intro"|data-admin-copy="endSeasonFlow"/);
 assert.match(html,/data-admin-next-day/);
});


test('Admin directory and child pages have isolated, protected markup',async()=>{
 for(const id of ['admin','admin/calendar','admin/players','admin/contracts']){
  const path='/'+id,file=id+'/index.html';
  assert.equal(parseRoute(path)?.canonical,path);
  assert.equal(buildRoute({kind:'page',id}),path);
  assert.equal(publicRequestFile(path),file);
  assert.ok(isAllowlistedPublicPath(file),file);
  assert.ok(planPublicFiles().includes(file));
  const initial=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  if(id==='admin/contracts'){
   assert.match(initial,/<section\b[^>]*id="app-admin"[^>]*data-admin-access="pending"/);
   assert.doesNotMatch(initial,/<section\b[^>]*id="app-admin"[^>]*\bhidden/);
  }else assert.match(initial,/<section\b[^>]*id="app-admin"[^>]*\bhidden/);
 }
 const home=readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');
 assert.match(home,/data-admin-directory/);
 assert.equal((home.match(/class="app-panel admin-directory-card"/g)||[]).length,3,'Three separate Admin boxes');
 assert.equal((home.match(/class="app-link app-link-primary"/g)||[]).length,3,'Each Admin box has a clear navigation button');
 assert.match(home,/href="\/admin\/calendar"/);
 assert.match(home,/href="\/admin\/players"/);
 assert.match(home,/href="\/admin\/contracts"/);
 assert.doesNotMatch(home,/data-admin-world|data-admin-players-form|\/assets\/admin-settings\.js/);
 const calendar=readFileSync(new URL('../admin/calendar/index.html',import.meta.url),'utf8');
 assert.match(calendar,/data-admin-world/);
 for(const child of [calendar,readFileSync(new URL('../admin/players/index.html',import.meta.url),'utf8'),readFileSync(new URL('../admin/contracts/index.html',import.meta.url),'utf8')]){
  assert.match(child,/class="admin-page-heading"/);
  assert.match(child,/class="app-link app-link-secondary admin-back"/);
  assert.match(child,/href="\/admin" data-admin-back/);
  assert.match(child,/aria-label="Back to Admin"/);
  assert.match(child,/<svg[^>]*class="fa-icon"[^>]*>/);
 }
 assert.doesNotMatch(calendar,/data-admin-players-form|\/assets\/admin-players\.js/);
 const {renderAdminPlayers}=await import('../tools/render-admin-settings.mjs');
 const players=readFileSync(new URL('../admin/players/index.html',import.meta.url),'utf8');
 assert.ok(players.includes(renderAdminPlayers()));
 assert.match(players,/data-admin-players-preview/);
 assert.doesNotMatch(players,/data-admin-players-result|data-admin-players-rows|data-admin-players-confirmation|data-admin-players-commit/,'Preview and approval live on a separate page');
 const {renderAdminPlayersPreview}=await import('../tools/render-admin-settings.mjs');
 const preview=readFileSync(new URL('../admin/players/preview/index.html',import.meta.url),'utf8');
 assert.ok(preview.includes(renderAdminPlayersPreview()));
 for(const selector of ['data-admin-players-preview-page','data-admin-preview-view','data-admin-preview-group','data-admin-preview-rows','data-admin-players-confirmation','data-admin-players-commit'])
  assert.ok(preview.includes(selector),selector);
 assert.match(preview,/href="\/admin\/players" data-admin-preview-back/);
 assert.doesNotMatch(preview,/class="admin-page-heading"|data-admin-back|class="app-panel app-settings-panel admin-settings admin-players admin-players-preview-page"/);
 assert.doesNotMatch(players,/data-admin-players-copy|data-admin-players-command|Copy PowerShell command/,'Preview/approval replaces manual CLI copy');

 assert.doesNotMatch(players,/data-admin-players-label="intro"|Configure a local generator trial/,'Remove obsolete generator introduction');
 assert.doesNotMatch(players,/data-players-seed-help|admin-players-seed-help|Same seed and options/,'Remove seed explanation');
 const playersScript=readFileSync(new URL('../assets/admin-players.js',import.meta.url),'utf8');
 // Permissions requests run on full page load/refresh only, never BFCache restore.
 assert.match(playersScript,/update\(\);void check\(\);/);
 assert.doesNotMatch(playersScript,/pageshow[^\n]*check\(/);
 const calendarScript=readFileSync(new URL('../assets/admin-settings.js',import.meta.url),'utf8');
 assert.match(calendarScript,/render\(\);void controller\.refresh\(\);/);
 assert.doesNotMatch(calendarScript,/pageshow[^\n]*controller\.refresh\(/);
 // Cross-page Admin routes share a tab-scoped permission snapshot; refresh
 // invalidates it. Session tokens and server authorization never use this cache.
 assert.match(playersScript,/permissionCache\?\.read\(\)/);
 assert.match(playersScript,/permissionCache\?\.write\(perms\)/);
 assert.match(calendarScript,/createAdminController\(cachedAdminRequest,render\)/);
 assert.match(calendarScript,/permissionCache\?\.clear\(\);void controller\.refresh\(\)/);
 for(const html of [home,calendar,players,readFileSync(new URL('../admin/contracts/index.html',import.meta.url),'utf8')])assert.match(html,/\/assets\/admin-permissions-cache\.js/);
 assert.ok(planPublicFiles().includes('assets/admin-permissions-cache.js'));
 const accountLogin=readFileSync(new URL('../assets/account-login.js',import.meta.url),'utf8');
 const accountProfile=readFileSync(new URL('../assets/account-settings.js',import.meta.url),'utf8');
 assert.match(accountLogin,/for\(const key of \['fa:admin:permissions:v1','fa:player:anonymous:v1','fa:player:skip-login-session-probe:v1'\]/);
 assert.match(accountLogin,/sessionStorage\.removeItem\(key\)/);
 assert.match(accountProfile,/sessionStorage\.removeItem\('fa:admin:permissions:v1'\)/);
 assert.doesNotMatch(playersScript,/data-players-seed-help|playersSeedHelp|Same seed and options|Stesso seed e stesse opzioni|Gleicher Seed und gleiche Einstellungen|Misma semilla y opciones|Même graine et mêmes options/);

 assert.doesNotMatch(players,/data-admin-world|\/assets\/admin-settings\.js/);
 for(const html of [home,calendar,players,readFileSync(new URL('../admin/contracts/index.html',import.meta.url),'utf8')]){
  assert.doesNotMatch(html,/<a[^>]*id="app-nav-divisions"[^>]*(?:is-active|aria-current="page")/,'No unrelated sidebar selection at first paint');
 }
 const css=readFileSync(new URL('../assets/admin-settings.css',import.meta.url),'utf8');
 assert.match(css,/\.app-admin-view\{[^}]*max-width:none/,'Admin pages must use the whole content width');
 assert.match(css,/\.admin-players-dropdown[^}]*\{/,'Players dropdowns must use the site styling');
 assert.match(css,/\.app-admin-view \.admin-players form\{[^}]*max-width:none/,'Players form must not inherit the legacy 30rem limit');
 assert.match(css,/\.app-admin-view\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(css,/\.app-admin-view > \.admin-players,[^}]*width:100%/);
 assert.match(css,/\.app-admin-view \.admin-players-fields \.admin-players-field,[^}]*background:transparent/);
 assert.match(css,/\.app-admin-view \.admin-players-fields :is\(input\[data-players-option\],\.language-trigger\):focus-visible/);
 const appCss=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(appCss,/\.app-view>\.app-page-title,\.app-admin-view>\.admin-page-heading>\.app-page-title\{/,'Both Admin headings must use the standard page title rule');
 assert.match(appCss,/html\[data-theme="light"\] \.app-admin-view>\.admin-page-heading>\.app-page-title/,'Admin headings must match standard titles in light theme');
 assert.match(css,/\.admin-settings :is\(input,select,textarea,button,a,\[role="option"\]\):focus-visible/,'Only interactive elements receive focus decoration');
 assert.match(css,/\.app-admin-view \.admin-players-fields \.admin-players-field > \[data-admin-players-label\],/,'Caption text must remain visually neutral');
 assert.match(css,/\.app-admin-view \.admin-players-dropdown \.language-option\[aria-selected="true"\],/,'Menu label color must not change on selection');
 assert.match(css,/\.admin-players-field:is\(:hover,:focus-within\)/,'Hovering the field wrapper must not highlight its caption');
 assert.match(css,/\.app-admin-view \.admin-players-fields :is\(input\[data-players-option\],\.language-trigger\):hover:not\(:disabled\):not\(:focus\)/,'Hover highlight belongs only to unfocused inputs and dropdown boxes');
 const generatorForm=players.match(/<form data-admin-players-form novalidate>([\s\S]*?)<\/form>/)?.[1]||'';
 assert.doesNotMatch(generatorForm,/<label(?:\s|>)/,'Captions must not wrap the interactive controls');
 assert.equal((generatorForm.match(/class="admin-players-field"/g)||[]).length,39);
 const ariaCaptions=[...generatorForm.matchAll(/<span id="(admin-players-caption-[^"]+)" data-admin-players-label="([^"]+)">/g)];
 assert.equal(ariaCaptions.length,39);
 assert.equal(new Set(ariaCaptions.map(item=>item[1])).size,39,'Caption ids must be unique');
 for(const [,id,key] of ariaCaptions)assert.ok(
  generatorForm.includes('<input aria-labelledby="'+id+'" data-players-option="'+key+'"')||
  generatorForm.includes('<select aria-labelledby="'+id+'" data-players-option="'+key+'"'),
  key+' must remain accessible without clickable label wrappers');
 assert.match(css,/pointer-events:none/,'Captions must not forward pointer interactions');
 assert.match(playersScript,/select\.closest\('\.admin-players-field'\)/);
 assert.match(playersScript,/\.closest\('\.admin-players-field'\)\.hidden/);
  for(const name of 'count seed primarySuitabilityMin primarySuitabilityMax primaryNationality secondaryMode secondaryCountry secondaryAllowed firstName lastName primaryPosition allowedPositions preferredFoot secondaryCount secondaryPositions allowedSecondaries age height developmentAptitude'.split(' '))
  assert.ok(players.includes('data-players-option="'+name+'"'),name);
 for(const a of 'speed strength stamina agility passing technique dribbling shooting crossing tackling marking heading vision positioning decisions composure gk_reflexes gk_handling gk_positioning gk_aerial'.split(' '))
  assert.ok(players.includes('data-players-option="attribute.'+a+'"'),a);
 const autos=players.match(/data-players-option="(?:count|seed|primarySuitabilityMin|primarySuitabilityMax)"[^>]+/g)||[];
 assert.equal(autos.length,4,'No Players field begins with a manual value');
 assert.ok(autos.every(field=>!field.includes('value=')),autos.join('\n'));
});

test('Admin Contracts route uses canonical generator and the shared authorization boundary',async()=>{
 const {renderAdminContracts}=await import('../tools/render-admin-contracts.mjs');
 const html=readFileSync(new URL('../admin/contracts/index.html',import.meta.url),'utf8');
 const source=readFileSync(new URL('../assets/admin-contracts.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../assets/admin-settings.css',import.meta.url),'utf8');
 assert.ok(html.includes(renderAdminContracts()));
 assert.match(html,/<title>Admin Contracts — Football Architect<\/title>/);
 assert.match(html,/href="\/admin" data-admin-back/);
 assert.match(html,/src="\/assets\/admin-contracts.js"/);
 assert.match(html,/src="\/assets\/players-nationality-tooltip.js"/);
 assert.ok(html.indexOf('src="/assets/players-nationality-tooltip.js"')<html.indexOf('src="/assets/admin-contracts.js"'));
 assert.match(source,/dataset\.playerCountry=p\.nationality/);
 assert.match(source,/faPlayersNationality\?\.name\(p\.nationality\)/);
 assert.match(source,/img\.tabIndex=0/);
 assert.doesNotMatch(html,/src="\/assets\/admin-players.js"|src="\/assets\/admin-settings.js"/);
 assert.match(html,/data-contracts-select/);
 assert.match(html,/class="app-panel admin-contracts-assignment"/);
 assert.match(html,/data-contracts-editor aria-labelledby=/);
 assert.doesNotMatch(html,/class="app-panel app-settings-panel admin-settings admin-contracts"/);
 assert.equal((renderAdminContracts().match(/class="app-panel/g)||[]).length,1,'Only the assignment form is boxed');
 assert.ok(renderAdminContracts().indexOf('admin-contracts-assignment')<renderAdminContracts().indexOf('admin-contracts-table-scroll'));
 assert.match(html,/data-contracts-all/);
 assert.match(html,/data-contracts-selected-count/);
 assert.match(html,/data-contracts-club-search/);
 assert.match(html,/data-contracts-trigger/);
 assert.doesNotMatch(html,/data-contracts-find-input|data-contracts-unassign|data-contracts-cancel/);
 assert.match(html,/data-contracts-rows aria-busy="true"/);
 const firstPaint=renderAdminContracts();
 const staticRows=firstPaint.match(/<tr class="admin-contracts-skeleton" aria-hidden="true">[^]*?<\/tr>/g)||[];
 assert.equal(staticRows.length,5,'Five complete empty rows exist in server HTML');
 for(const row of staticRows){
  assert.equal((row.match(/<td\b/g)||[]).length,8,'All eight columns are reserved before API data');
  assert.match(row,/class="admin-contracts-checkbox-cell"><input type="checkbox" disabled tabindex="-1"/);
  assert.doesNotMatch(row,/colspan|Loading players/);
 }
 assert.match(source,/rows.childElementCount===5/,'Permission check preserves static skeleton rows');
 assert.match(source,/record=null;selected.clear\(\);anchorId=null;clubs=null;select.value='';closeMenu\(\);\s*loading\(\)/);
 assert.match(html,/<section id="app-admin"[^>]*data-admin-access="pending"/,'Static Contracts scaffold paints before authorization');
 assert.doesNotMatch(html,/<section id="app-admin"[^>]*hidden/);
 assert.match(html,/data-contracts-trigger[^>]*disabled/,'Club dropdown is inert on first paint');
 assert.match(html,/data-contracts-save[^>]*disabled/,'Assignment is inert on first paint');
 assert.match(source,/const ticket=\+\+epoch;host\.dataset\.adminAccess='pending'/);
 assert.match(css,/\[data-contracts-page\]\{display:inline-block;min-width:100px/);
 assert.match(css,/\[data-contracts-total\]\{display:inline-block;min-width:76px/);
 assert.match(css,/\[data-admin-contracts\]\[hidden\]/);
 assert.match(css,/\.admin-contracts-checkbox-cell input/);
 assert.match(css,/\.admin-contracts-dropdown-trigger/);
 assert.match(css,/\.app-admin-view \.admin-contracts-message\{position:absolute!important/);
 assert.match(css,/\.admin-contracts-checkbox-cell\{user-select:none/);
 assert.match(source,/e\.shiftKey&&e\.target\.closest/);
 assert.doesNotMatch(source,/report\(l\('loading'\)\)|report\(l\('saved'\)\)/);
 assert.match(source,/save\.textContent=l\('assign'\)/);
 assert.match(source,/\/api\/player\/permissions/);
 assert.match(source,/admin\.world\.write/);
 assert.match(source,/\/api\/admin\/contracts/);
 assert.match(source,/expectedClubKey/);
 assert.match(source,/expectedRevision/);
 assert.match(source,/credentials:'same-origin'/);
 assert.ok(isAllowlistedPublicPath('assets/admin-contracts.js'));
 assert.equal(parseRoute('/admin/contracts')?.canonical,'/admin/contracts');
 assert.equal(buildRoute({kind:'page',id:'admin/contracts'}),'/admin/contracts');
 assert.equal(publicRequestFile('/admin/contracts'),'admin/contracts/index.html');
});
