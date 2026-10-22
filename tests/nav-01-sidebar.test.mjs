// NAV-01: canonical navigation regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveSubpage} from '../assets/subpage-routes.mjs';
import {publicRequestFile} from '../tools/publication-guard.mjs';
const directory=readFileSync(new URL('../assets/clubs-directory.js',import.meta.url),'utf8');
const sidebar=readFileSync(new URL('../assets/sidebar-evolution.js',import.meta.url),'utf8');
test('NAV-01B directory links use canonical country/id/overview paths',()=>{
 assert.ok(directory.includes("+'/'+c.clubId+'/overview"));
 assert.ok(!directory.includes('href="/clubs/\'+c.countryId.toLowerCase()+\'-\'+c.clubId'));
 for(const country of ['it','eng','es','de','fr','pt','nl','br'])for(const id of [1,16,17,32,40]){
  const r=resolveSubpage('/clubs/'+country+'/'+id+'/overview');
  assert.equal(r?.kind,'club');assert.equal(r?.redirect,false);
 }
});
test('NAV-01A sidebar keeps five language keys and accessible expansion',()=>{
 for(const code of ['en','de','es','fr','it'])assert.ok(sidebar.includes(code+':['));
 assert.ok(sidebar.includes("button.addEventListener('click'"));
 assert.ok(sidebar.includes('aria-expanded'));
 assert.ok(sidebar.includes('sessionStorage'));
});

test('NAV-01C localized accessible controls in five languages',()=>{
 for(const code of ['en','de','es','fr','it']){
  assert.ok(sidebar.includes(code+':'));
  assert.ok(directory.includes(code+':'));
 }
 assert.ok(sidebar.includes('expandLabels'));
 assert.ok(sidebar.includes('collapseLabels'));
 assert.ok(directory.includes("setAttribute('aria-label',filterLabels"));
});

test('NAV-01C public server resolves the extensionless directory route',()=>{
 assert.equal(publicRequestFile('/clubs'),'clubs/index.html');
 assert.equal(publicRequestFile('/clubs/'),'clubs/index.html');
});

test('NAV-01 first paint ships complete navigation before deferred scripts',()=>{
 for(const file of ['dashboard/index.html','calendar/index.html','settings/index.html','competitions/index.html','competitions/_shared/index.html','clubs/index.html','clubs/_shared/index.html']){
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const nav=html.slice(html.indexOf('<nav class="fa-shell-nav"'),html.indexOf('</nav>'));
  for(const href of ['/clubs','/guide','/competitions#domestic','/competitions#international'])assert.ok(nav.includes('href="'+href+'"'),file+' lacks initial '+href);
  assert.match(nav,/aria-expanded="false"[^>]*aria-controls="nav01-children"/);
  assert.ok(html.indexOf('<script data-nav01-bootstrap>')>html.indexOf('</nav>'));
  assert.ok(html.indexOf('<script data-nav01-bootstrap>')<html.indexOf('<main'));
 }
});
