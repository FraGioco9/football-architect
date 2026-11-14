import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRoute,buildRoute} from '../assets/routes-registry.mjs';
import {publicRequestFile,isAllowlistedPublicPath,planPublicFiles} from '../tools/publication-guard.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('#577 match URL uses a positive numeric immutable public identity',()=>{
 assert.equal(buildRoute({kind:'match',id:1}),'/matches/1');
 assert.equal(parseRoute('/matches/42')?.kind,'match');
 assert.equal(parseRoute('/matches/42/')?.canonical,'/matches/42');
 for(const p of ['/matches/0','/matches/01','/matches/-1','/matches/1.5','/matches/%34','/matches/42/other','/matches/9007199254740992'])
  assert.equal(parseRoute(p),null,p);
 assert.equal(publicRequestFile('/matches/42'),'matches/_shared/index.html');
 assert.equal(publicRequestFile('/matches/42/'),'matches/_shared/index.html');
});
test('#577 official match is a single guarded, generated shell',()=>{
 for(const path of ['matches/_shared/index.html','assets/match-detail.js','assets/match-detail.css'])assert.equal(isAllowlistedPublicPath(path),true,path);
 assert.ok(planPublicFiles().includes('matches/_shared/index.html'));
 const html=read('matches/_shared/index.html');
 assert.match(html,/data-match-detail/);
 for(const section of ['overview','lineups','stats'])assert.match(html,new RegExp('data-match-panel="'+section+'"'));
 assert.match(html,/app-competition-tabs/);
 assert.doesNotMatch(html,/\btemporary-score-v1\b|<script\b[^>]*src="https?:/);
 const renderer=read('tools/generate-app-pages.mjs');
 assert.match(renderer,/writeOutput\("matches\/_shared\/index\.html"/);
});
test('#577 uses authoritative match API and never synthesizes results or confirmation',()=>{
 const js=read('assets/match-detail.js');
 assert.match(js,/fetch\('\/api\/matches\/'\+matchId/);
 assert.match(js,/data\.status==='completed'\?data\.result:null/);
 assert.match(js,/v\?\.confirmed===true&&Array\.isArray\(v\.starters\)&&v\.starters\.length===11/);
 assert.match(js,/const s=data\.status;/);
 assert.match(js,/s==='scheduled'&&validLineup\(data\.lineups\?\.home\)&&validLineup\(data\.lineups\?\.away\)/);
 assert.match(js,/if\(!numeric\(matchId\)\)/);
 assert.doesNotMatch(js,/Math\.random|mockMatch|demoFixture/);
});
