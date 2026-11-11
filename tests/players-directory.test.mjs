import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isAllowlistedPublicPath,planPublicFiles} from '../tools/publication-guard.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Players static shell loads the D1 directory renderer and reserves the empty table row',()=>{
 const html=read('players/index.html');
 assert.match(html,/src="\/assets\/players-directory\.js" defer/);
 assert.match(html,/data-players-status role="status"/);
 assert.doesNotMatch(html,/data-app-i18n="playersDirectoryHeading">No players available/);
 for(const header of ['playersNationality','playersColumnPlayer','playersColumnAge','playersColumnPositions','playersColumnHeight','playersColumnFoot'])
  assert.ok(html.includes(header));
 const generator=read('tools/generate-app-pages.mjs');
 assert.match(generator,/players-directory\.js/);
 assert.match(generator,/data-players-status/);
});
test('renderer is read-only, sanitizes output and uses only documented public fields',()=>{
 const code=read('assets/players-directory.js');
 assert.match(code,/fetch\('\/api\/players\/page\/'/);
 assert.match(code,/credentials:'omit'/);
 assert.match(code,/textContent=/);
 assert.doesNotMatch(code,/innerHTML|\/api\/admin\/players/);
 assert.match(code,/app-players-nationality-flag/);
});

test('Players script is served by the local allowlist and included in publication artifacts',()=>{
 const asset='assets/players-directory.js';
 assert.equal(isAllowlistedPublicPath(asset),true,'local DEV HTTP server must not return 404 for Players renderer');
 assert.ok(planPublicFiles().includes(asset),'public static bundle must include Players renderer');
 assert.equal(isAllowlistedPublicPath('assets/players-directory-private.js'),false,'no broad assets/* allowance');
});
