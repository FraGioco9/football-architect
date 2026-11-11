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
 for(const id of ['admin','admin/calendar','admin/players']){
  const path='/'+id,file=id+'/index.html';
  assert.equal(parseRoute(path)?.canonical,path);
  assert.equal(buildRoute({kind:'page',id}),path);
  assert.equal(publicRequestFile(path),file);
  assert.ok(isAllowlistedPublicPath(file),file);
  assert.ok(planPublicFiles().includes(file));
  assert.match(readFileSync(new URL('../'+file,import.meta.url),'utf8'),/<section\b[^>]*id="app-admin"[^>]*\bhidden/);
 }
 const home=readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');
 assert.match(home,/data-admin-directory/);
 assert.equal((home.match(/class="app-panel admin-directory-card"/g)||[]).length,2,'Two separate Admin boxes');
 assert.equal((home.match(/class="app-link app-link-primary"/g)||[]).length,2,'Each Admin box has a clear navigation button');
 assert.match(home,/href="\/admin\/calendar"/);
 assert.match(home,/href="\/admin\/players"/);
 assert.doesNotMatch(home,/data-admin-world|data-admin-players-form|\/assets\/admin-settings\.js/);
 const calendar=readFileSync(new URL('../admin/calendar/index.html',import.meta.url),'utf8');
 assert.match(calendar,/data-admin-world/);
 for(const child of [calendar,readFileSync(new URL('../admin/players/index.html',import.meta.url),'utf8')]){
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
 assert.doesNotMatch(players,/data-admin-world|\/assets\/admin-settings\.js/);
 for(const html of [home,calendar,players]){
  assert.doesNotMatch(html,/<a[^>]*id="app-nav-divisions"[^>]*(?:is-active|aria-current="page")/,'No unrelated sidebar selection at first paint');
 }
 const css=readFileSync(new URL('../assets/admin-settings.css',import.meta.url),'utf8');
 assert.match(css,/\.app-admin-view\{[^}]*max-width:none/,'Admin pages must use the whole content width');
 assert.match(css,/\.admin-players-dropdown[^}]*\{/,'Players dropdowns must use the site styling');
 assert.match(css,/\.app-admin-view \.admin-players form\{[^}]*max-width:none/,'Players form must not inherit the legacy 30rem limit');
 assert.match(css,/\.app-admin-view\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(css,/\.app-admin-view > \.admin-players,[^}]*width:100%/);
 assert.match(css,/\.app-admin-view \.admin-players-fields label,[^}]*outline:none/);
 assert.match(css,/\.app-admin-view \.admin-players-fields :is\(input\[data-players-option\],\.language-trigger\):focus-visible/);
 for(const name of 'count seed primarySuitability primaryNationality secondaryMode secondaryCountry secondaryAllowed firstName lastName primaryPosition allowedPositions preferredFoot secondaryCount secondaryPositions allowedSecondaries age height developmentAptitude'.split(' '))
  assert.ok(players.includes('data-players-option="'+name+'"'),name);
 for(const a of 'speed strength stamina agility passing technique dribbling shooting crossing tackling marking heading vision positioning decisions composure gk_reflexes gk_handling gk_positioning gk_aerial'.split(' '))
  assert.ok(players.includes('data-players-option="attribute.'+a+'"'),a);
 const autos=players.match(/data-players-option="(?:count|seed|primarySuitability)"[^>]+/g)||[];
 assert.equal(autos.length,3,'No Players field begins with a manual value');
 assert.ok(autos.every(field=>!field.includes('value=')),autos.join('\n'));
});
