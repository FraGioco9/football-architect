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

test('Transfers market value is read-only, global and reserved before hydration',()=>{
 const html=read('transfers/index.html'),source=read('assets/transfers-page.mjs'),template=read('templates/transfers-content.html');
 for(const id of ['transfers-value-min','transfers-value-max','transfers-value-sort'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(source,/import '\.\/market-value-format\.js'/);
 assert.equal((template.match(/fa-transfers-skeleton-value/g)||[]).length,(template.match(/class="fa-transfers-loading-row"/g)||[]).length);
 assert.match(template,/Market value \(Min, \$ARC\)/);
 assert.match(source,/valuation\.format\(player\.market_value_arc,currentLocale\(\)\)/);
 assert.match(source,/navigate\(\{\.\.\.state,sort:order\?'market_value_arc':'',order,offset:0\}\)/);
 assert.doesNotMatch(source,/\.players\.sort\(/);
});

test('#763 all market value table tracks reserve seven-digit amounts without shrinking identity columns',()=>{
 const css=read('assets/app.css'),transfers=read('assets/transfers-page.css'),template=read('templates/transfers-content.html');
 const block=css.slice(css.indexOf('/* #763: Public Overview'));
 const widths=[...block.matchAll(/--app-players-market-width:(\d+)px/g)].map(m=>Number(m[1]));
 assert.deepEqual(widths,[196,172,172]);
 assert.match(transfers,/--fa-transfers-value-width:196px;min-width:824px/);
 assert.match(transfers,/--fa-transfers-value-width:172px;min-width:800px/);
 assert.match(transfers,/@media\(max-width:700px\)\{\.fa-transfers-table\{min-width:684px\}/);
 assert.match(transfers,/\.fa-transfers-table th,\.fa-transfers-table td\{box-sizing:border-box\}/);
 assert.match(transfers,/\.fa-transfers-table \.fa-transfers-value\{width:var\(--fa-transfers-value-width\);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums\}/);
 assert.match(transfers,/\.fa-transfers-skeleton-value\{width:13ch;max-width:100%;margin-left:auto\}/);
 assert.match(transfers,/\.fa-transfers-value \.app-players-sort-chevron\{left:auto;right:calc\(100% \+ 5px\)\}/);
 assert.equal((template.match(/class="fa-transfers-value"><span class="fa-transfers-skeleton fa-transfers-skeleton-value"/g)||[]).length,7);
 // Budget seven digits, separators, space, currency token, cell padding and
 // a separate localized header/sort-arrow allowance. This is a conservative
 // static budget, not a browser font measurement.
 for(const [track,padding] of [[196,32],[172,32],[172,20],[172,12]]){
  assert.ok(track-padding>=140);
 }
});
