import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {renderSidebar} from '../tools/render-sidebar.mjs';
test('shared sidebar renders Profile directly below Settings',()=>{
 const template=readFileSync(new URL('../templates/app-page.html',import.meta.url),'utf8').replace('@@FA_LINE_044@@','<a id="app-nav-settings" href="/settings">').replace('@@FA_WORLD_LINK@@','<a id="app-nav-divisions" href="/competitions">');
 const html=renderSidebar(template),settings=html.indexOf('id="app-nav-settings"'),profile=html.indexOf('id="app-nav-profile"');
 assert.ok(profile>settings);
 assert.match(html.slice(settings,profile),/Settings<\/span>\s*<\/a>\s*<a class="fa-shell-link" $/);
 assert.equal((html.match(/id="app-nav-profile"/g)||[]).length,1);
 assert.match(html,/id="app-nav-profile" href="\/account"/);
});

test('account uses the shared app shell with a profile table and a collapsed password form',()=>{
 const html=readFileSync(new URL('../account/index.html',import.meta.url),'utf8');
 assert.match(html,/<header class="fa-shell-topbar">/);
 assert.match(html,/<nav class="fa-shell-nav" data-nav01-static/);
 assert.match(html,/<h1[^>]*>Profile<\/h1>/);
 assert.match(html,/id="protected" aria-busy="true" inert/);
 assert.doesNotMatch(html,/Checking your session/);
 assert.equal((html.match(/class="app-skeleton-bar" aria-hidden="true"/g)||[]).length,5);
 assert.match(html,/<table class="app-profile-table"[\s\S]*?<th scope="row" id="username-label">[\s\S]*?id="identity"[\s\S]*?<tr id="nationality-row"[\s\S]*?id="city-row">/);
 for(const field of ['username','nationality','city']){
  assert.match(html,new RegExp(`data-profile-edit="${field}" aria-labelledby="profile-edit-label ${field}-label"`));
 }
 assert.match(html,/id="profile-tab" role="tab" aria-selected="true"/);
 assert.match(html,/id="security-panel" role="tabpanel" aria-labelledby="security-tab" hidden/);
 assert.match(html,/id="edit-profile-form"[\s\S]*?id="security-panel"[\s\S]*?id="change-email-form"/);
 assert.match(html,/<symbol id="profile-pencil-icon" viewBox="0 0 24 24">/);
 assert.match(html,/<table class="app-profile-table" aria-labelledby="security-tab">[\s\S]*?id="security-email-label"[\s\S]*?id="change-email-form" hidden[\s\S]*?id="security-password-label"[\s\S]*?id="security-password-mask" aria-hidden="true">\*{8}<\/span>[\s\S]*?id="change-form" hidden/);
 assert.equal((html.match(/<use href="#profile-pencil-icon"/g)||[]).length,5);
 assert.match(html,/src="\/assets\/competition-tabs.js" defer/);
 assert.match(html,/id="profile-nationality-control" data-account-select-control hidden[\s\S]*?id="profile-nationality-trigger" role="combobox"[\s\S]*?id="profile-nationality-menu" role="listbox"/);
 assert.doesNotMatch(html,/id="(?:security|sessions-summary|revoke-button|delete-form)"/);
 assert.match(html,/<button[^>]*id="logout-button"/);
});

test('profile can load the shared dropdown binder without the competition model',()=>{
 const script=readFileSync(new URL('../assets/competition-tabs.js',import.meta.url),'utf8');
 const window={};
 runInNewContext(script,{window,document:{querySelector:()=>({})}});
 assert.equal(typeof window.faBindCompetitionMenu,'function');
});

test('public pages reuse the Admin permission snapshot across full route navigations, not a second 401',()=>{
 const require=createRequire(import.meta.url);
 const {publicPermissionsCache}=require('../assets/profile-navigation.js');
 const data=new Map();
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 const page=type=>({sessionStorage:storage,performance:{getEntriesByType:()=>[{type}]}});
 const first=publicPermissionsCache(page('navigate'));
 assert.equal(first.read(),null);
 first.write([]);
 assert.deepEqual(publicPermissionsCache(page('navigate')).read(),[]);
 first.write(['admin.access','admin.world.read']);
 assert.deepEqual(publicPermissionsCache(page('navigate')).read(),['admin.access','admin.world.read']);
 assert.equal(publicPermissionsCache(page('reload')).read(),null);
});
test('public sidebar cannot treat malformed cached values as Admin authorization',()=>{
 const require=createRequire(import.meta.url);
 const {publicPermissionsCache}=require('../assets/profile-navigation.js');
 const data=new Map([['fa:admin:permissions:v1',JSON.stringify({version:1,permissions:['<script>']})]]);
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 const cache=publicPermissionsCache({sessionStorage:storage,performance:{getEntriesByType:()=>[{type:'navigate'}]}});
 assert.equal(cache.read(),null);
 assert.equal(data.has('fa:admin:permissions:v1'),false);
 const nav=readFileSync(new URL('../assets/profile-navigation.js',import.meta.url),'utf8');
 assert.doesNotMatch(nav,/pageshow[^\n]*check\(/);
});

test('anonymous Profile navigation avoids redundant 401 requests on Login',()=>{
 const nav=readFileSync(new URL('../assets/profile-navigation.js',import.meta.url),'utf8');
 const login=readFileSync(new URL('../assets/account-login.js',import.meta.url),'utf8');
 const profile=readFileSync(new URL('../assets/account-settings.js',import.meta.url),'utf8');
 assert.match(nav,/else if\(accountPage\)[\s\S]*?show\(canAccessAdmin\(permissionsCache\.read\(\)\)\)/);
 assert.match(nav,/fa:player:anonymous:v1/);
 assert.match(nav,/fa:player:skip-login-session-probe:v1/);
 assert.match(login,/const skip=window\.sessionStorage\.getItem\(key\)==='1'/);
 assert.match(login,/if\(skip\)return/);
 assert.match(login,/fa:player:anonymous:v1/);
 assert.match(profile,/window\.sessionStorage\.setItem\('fa:player:skip-login-session-probe:v1','1'\)/);
});
