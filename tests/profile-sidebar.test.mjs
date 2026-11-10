import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderSidebar} from '../tools/render-sidebar.mjs';
test('shared sidebar renders Profile directly below Settings',()=>{
 const template=readFileSync(new URL('../templates/app-page.html',import.meta.url),'utf8').replace('@@FA_LINE_044@@','<a id="app-nav-settings" href="/settings">').replace('@@FA_WORLD_LINK@@','<a id="app-nav-divisions" href="/competitions">');
 const html=renderSidebar(template),settings=html.indexOf('id="app-nav-settings"'),profile=html.indexOf('id="app-nav-profile"');
 assert.ok(profile>settings);
 assert.match(html.slice(settings,profile),/Settings<\/span>\s*<\/a>\s*<a class="fa-shell-link" $/);
 assert.equal((html.match(/id="app-nav-profile"/g)||[]).length,1);
 assert.match(html,/id="app-nav-profile" href="\/account"/);
});

test('account uses the shared app shell and shows email, password change and sign out',()=>{
 const html=readFileSync(new URL('../account/index.html',import.meta.url),'utf8');
 assert.match(html,/<header class="fa-shell-topbar">/);
 assert.match(html,/<nav class="fa-shell-nav" data-nav01-static/);
 assert.match(html,/<h1[^>]*>Profile<\/h1>/);
 assert.match(html,/<p id="identity">/);
 assert.doesNotMatch(html,/id="(?:security|sessions-summary|revoke-button|delete-form)"/);
 assert.match(html,/<form method="post" id="change-form">[\s\S]*?<button[^>]*id="logout-button"/);
});
