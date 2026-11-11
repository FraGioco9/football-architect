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
