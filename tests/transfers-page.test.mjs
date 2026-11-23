import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRoute,buildRoute} from '../assets/routes-registry.mjs';
import {isAllowlistedPublicPath,publicRequestFile} from '../tools/publication-guard.mjs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Transfers route, generator and public artifact are canonical',()=>{
 assert.deepEqual(parseRoute('/transfers'),{kind:'page',canonical:'/transfers',redirect:false});
 assert.equal(buildRoute({kind:'page',id:'transfers'}),'/transfers');
 assert.equal(publicRequestFile('/transfers'),'transfers/index.html');
 for(const file of ['transfers/index.html','assets/transfers-page.css','assets/transfers-page.mjs','assets/transfers-discovery.mjs'])
  assert.equal(isAllowlistedPublicPath(file),true,file);
 const gen=read('tools/generate-app-pages.mjs');
 assert.match(gen,/writeOutput\("transfers\/index\.html",html\)/);
 const html=read('transfers/index.html');
 assert.match(html,/<title>Transfers — Football Architect<\/title>/);
 assert.match(html,/id="transfers-filters"/);
 assert.match(html,/id="transfers-rows"/);
 assert.match(html,/src="\/assets\/transfers-page\.mjs"/);
 const players=read('players/index.html');
 const content=read('templates/transfers-content.html');
 assert.doesNotMatch(players, /fa-transfers-from-players|href="\/transfers"/);
 assert.doesNotMatch(content, /href="\/players"|data-transfers-text="directory"/);
 assert.doesNotMatch(html, /fa-transfers-directory-link|data-transfers-text="directory"/);
 assert.doesNotMatch(html, /const onPlayers=path==='\/transfers'/);
 assert.doesNotMatch(html,/href="\/transfer-market"|\bBuy now\b|\bPlace bid\b/);
});

test('Transfers discovery only reads the public API and handles navigation safely',()=>{
 const source=read('assets/transfers-page.mjs');
 const discovery=read('assets/transfers-discovery.mjs');
 assert.match(source,/credentials:'omit'/);
 assert.match(source,/window\.addEventListener\('popstate'/);
 assert.match(source,/AbortController/);
 assert.match(source,/data-transfers-text/);
 assert.match(source,/document\.createElement\('a'\)/);
 assert.match(discovery,/\/api\/players\?/);
 assert.doesNotMatch(source,/method:'POST'|\/api\/market|transferFee|auction|wallet|buyNow/);
 for(const locale of ['en','de','es','fr','it']) assert.match(source,new RegExp('\\b'+locale+':\\{'));
});
