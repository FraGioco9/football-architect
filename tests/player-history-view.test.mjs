import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderPlayerDetailPage} from '../tools/render-player-detail.mjs';
import {historyWords,projectPlayerClubHistory} from '../assets/player-history.mjs';
import {isAllowlistedPublicPath,planPublicFiles,publicRequestFile} from '../tools/publication-guard.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const verify=(season,competitions)=>({season,status:'available',provenance:{kind:'authoritative',sourceRef:'player-stats:current:season:'+season},data:{total:{appearances:competitions.reduce((s,x)=>s+x.appearances,0)},competitions}});
const rec=(clubId,competitionId,appearances)=>({clubId,competitionId,appearances});
test('#579 player History is public, generated, first-paint-safe; draft remains disabled',()=>{
 const html=renderPlayerDetailPage(read('players/index.html'),'public');
 assert.equal(html,read('players/_shared/index.html'));
 assert.match(html,/data-detail-view="history"[^>]*aria-controls="player-detail-history-panel"/);
 assert.match(html,/get\("view"\)==="history"/);
 assert.match(html,/data-detail-panel="history" data-detail-history/);
 assert.equal((html.match(/class="app-player-history-row app-player-history-loading"/g)||[]).length,2);
 assert.doesNotMatch(html,/data-detail-view="history"[^>]*disabled/);
 const preview=renderPlayerDetailPage(read('admin/players/preview/index.html'),'preview');
 assert.equal(preview,read('admin/players/preview/player/index.html'));
 assert.match(preview,/data-detail-view="history"[^>]*disabled/);
 assert.doesNotMatch(preview,/data-detail-history/);
});
test('#579 group by actual recorded club, not current affiliation; multi-competition is additive',()=>{
 const rows=projectPlayerClubHistory({status:'available',seasons:[
  verify(2,[rec('IT-2','IT-1',7),rec('IT-1','int-1',3),rec('IT-1','IT-1',9)]),
  verify(1,[rec('IT-1','IT-1',12)])
 ]}).rows;
 assert.deepEqual(rows.map(x=>[x.season,x.clubId,x.appearances,x.competitions]),[
  [2,'IT-1',12,['IT-1','int-1']],[2,'IT-2',7,['IT-1']],[1,'IT-1',12,['IT-1']]]);
});
test('#579 Season 0, missing evidence, verified zero and unsupported evidence stay distinct',()=>{
 assert.deepEqual(projectPlayerClubHistory({status:'empty',seasons:[]}),{status:'empty',rows:[]});
 assert.deepEqual(projectPlayerClubHistory({status:'available',seasons:[verify(3,[]),{season:2,status:'empty'},{season:1,status:'unavailable'}]}).rows.map(x=>x.kind),['none','pending','unavailable']);
 assert.equal(projectPlayerClubHistory({status:'unavailable',seasons:[]}).status,'unavailable');
 assert.deepEqual(projectPlayerClubHistory({status:'available',seasons:[{season:1,status:'partial',provenance:{kind:'authoritative',resultAuthority:'confirmed-entrants-v1',sourceRef:'world:entrants'},data:{entrantsOnly:true}}]}).rows.map(x=>x.kind),['pending']);
});
test('#579 no duplicated clubs, false totals, invalid records or unpublished evidence',()=>{
 const malformed=verify(1,[rec('IT-1','IT-1',2),rec('IT-1','IT-1',2)]);
 assert.throws(()=>projectPlayerClubHistory({status:'available',seasons:[malformed]}),/Duplicate/);
 const inconsistent=verify(1,[rec('IT-1','IT-1',2)]);inconsistent.data.total.appearances=3;
 assert.throws(()=>projectPlayerClubHistory({status:'available',seasons:[inconsistent]}),/Incomplete/);
 assert.throws(()=>projectPlayerClubHistory({status:'available',seasons:[verify(1,[rec('UNKNOWN','IT-1',2)])]}),/Invalid/);
 assert.throws(()=>projectPlayerClubHistory({status:'available',seasons:[{season:1,status:'available',data:{total:{appearances:0},competitions:[]}}]}),/Unverified/);
});
test('#579 reuses current player Stats API; translations and URL handling',()=>{
 const js=read('assets/player-detail.js'),css=read('assets/player-detail.css');
 assert.match(js,/import\('\/assets\/player-history\.mjs'\)/);
 assert.match(js,/fetchStats:readPlayerStatistics/);
 assert.match(js,/history\.pushState/);
 assert.match(css,/html\[data-player-detail-view="history"\]/);
 for(const locale of ['en','de','es','fr','it'])assert.equal(historyWords[locale].head.length,4);
});

test('#579 History module ships in the public artifact and resolves at its imported URL',()=>{
 assert.equal(publicRequestFile('/assets/player-history.mjs'),'assets/player-history.mjs');
 assert.equal(isAllowlistedPublicPath('assets/player-history.mjs'),true);
 assert.ok(planPublicFiles().includes('assets/player-history.mjs'));
 assert.match(read('assets/player-detail.js'),/import\('\/assets\/player-history\.mjs'\)/);
});
